import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { IMPORT_MAX_FILE_BYTES } from "@/gameImport/csvContract";
import type { ImportDiagnostic } from "@/gameImport/types";
import type { ApiEnv } from "@/server/api/types";
import { getDb } from "@/server/db";
import {
  confirmGameImport,
  GameImportExactDuplicateError,
  GameImportInvalidError,
  GameImportLikelyDuplicateError,
  GameImportStalePreviewError,
  GameImportTeamNotFoundError,
  prepareGameImport,
} from "@/server/gameImport";

const ALLOWED_MIME_TYPES = new Set([
  "",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/plain",
]);

type ParsedUpload = {
  fileText: string;
  filename: string;
  homeTeamId: number | null;
  matchDate: string | null;
  opponent: string | null;
  previewFingerprint: string | null;
  allowLikelyDuplicate: boolean;
};

function fileLevelDiagnostic(code: string, message: string): ImportDiagnostic {
  return {
    code,
    severity: "error",
    row: null,
    column: null,
    value: null,
    message,
  };
}

async function parseUpload(request: Request): Promise<ParsedUpload> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HTTPException(415, {
      message: "Expected a multipart/form-data request with one CSV file.",
    });
  }

  const files = form.getAll("file");
  if (files.length !== 1 || !(files[0] instanceof File)) {
    throw new HTTPException(415, {
      message: "Exactly one CSV file must be uploaded in the 'file' field.",
    });
  }

  const file = files[0];

  if (file.size === 0) {
    throw new HTTPException(415, { message: "The uploaded file is empty." });
  }
  if (file.size > IMPORT_MAX_FILE_BYTES) {
    throw new HTTPException(413, {
      message: `The file exceeds the ${IMPORT_MAX_FILE_BYTES / (1024 * 1024)} MiB limit.`,
    });
  }
  if (!ALLOWED_MIME_TYPES.has(file.type.split(";")[0].trim().toLowerCase())) {
    throw new HTTPException(415, {
      message: `Unsupported file type "${file.type}". Upload a .csv file.`,
    });
  }
  if (!/\.csv$/i.test(file.name)) {
    throw new HTTPException(415, {
      message: "The file must have a .csv extension.",
    });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let fileText: string;
  try {
    fileText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new HTTPException(422, {
      message: "The file is not valid UTF-8 text.",
    });
  }

  const readField = (name: string): string | null => {
    const value = form.get(name);
    if (typeof value !== "string" || value.trim() === "") {
      return null;
    }
    return value.trim();
  };

  const homeTeamIdRaw = readField("homeTeamId");
  let homeTeamId: number | null = null;
  if (homeTeamIdRaw !== null) {
    const parsed = Number(homeTeamIdRaw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new HTTPException(422, {
        message: "homeTeamId must be a positive integer.",
      });
    }
    homeTeamId = parsed;
  }

  return {
    fileText,
    filename: file.name,
    homeTeamId,
    matchDate: readField("matchDate"),
    opponent: readField("opponent"),
    previewFingerprint: readField("previewFingerprint"),
    allowLikelyDuplicate: readField("allowLikelyDuplicate") === "true",
  };
}

export const gameImportsRoutes = new Hono<ApiEnv>()
  .post("/preview", async (c) => {
    const { userId } = c.env;
    const upload = await parseUpload(c.req.raw);
    const db = await getDb();

    try {
      const prepared = await prepareGameImport(db, userId, {
        fileText: upload.fileText,
        filename: upload.filename,
        metadata: {
          homeTeamId: upload.homeTeamId,
          matchDate: upload.matchDate,
          opponent: upload.opponent,
        },
      });

      if (prepared.status === "needs_metadata") {
        return c.json({
          status: "needs_metadata" as const,
          formatVersion: prepared.formatVersion,
          missing: prepared.missing,
        });
      }

      if (prepared.status === "invalid") {
        return c.json(
          { status: "invalid" as const, diagnostics: prepared.diagnostics },
          422,
        );
      }

      const { canonical: _canonical, ...preview } = prepared;
      return c.json(preview);
    } catch (error) {
      if (error instanceof GameImportTeamNotFoundError) {
        throw new HTTPException(404, { message: error.message });
      }
      throw error;
    }
  })
  .post("/confirm", async (c) => {
    const { userId } = c.env;
    const upload = await parseUpload(c.req.raw);

    if (upload.previewFingerprint === null) {
      return c.json(
        {
          status: "invalid" as const,
          diagnostics: [
            fileLevelDiagnostic(
              "MISSING_PREVIEW_FINGERPRINT",
              "previewFingerprint is required to confirm an import.",
            ),
          ],
        },
        422,
      );
    }

    const db = await getDb();

    try {
      const { gameId } = await confirmGameImport(db, userId, {
        fileText: upload.fileText,
        filename: upload.filename,
        metadata: {
          homeTeamId: upload.homeTeamId,
          matchDate: upload.matchDate,
          opponent: upload.opponent,
        },
        previewFingerprint: upload.previewFingerprint,
        allowLikelyDuplicate: upload.allowLikelyDuplicate,
      });

      return c.json({ gameId, source: "imported" as const }, 201);
    } catch (error) {
      if (error instanceof GameImportTeamNotFoundError) {
        throw new HTTPException(404, { message: error.message });
      }
      if (error instanceof GameImportInvalidError) {
        return c.json(
          { status: "invalid" as const, diagnostics: error.diagnostics },
          422,
        );
      }
      if (error instanceof GameImportStalePreviewError) {
        return c.json(
          { status: "conflict" as const, code: "PREVIEW_STALE" as const },
          409,
        );
      }
      if (error instanceof GameImportExactDuplicateError) {
        return c.json(
          {
            status: "conflict" as const,
            code: "EXACT_DUPLICATE" as const,
            existingGameId: error.existingGameId,
          },
          409,
        );
      }
      if (error instanceof GameImportLikelyDuplicateError) {
        return c.json(
          {
            status: "conflict" as const,
            code: "LIKELY_DUPLICATE" as const,
            existingGameId: error.existingGameId,
          },
          409,
        );
      }
      throw error;
    }
  });
