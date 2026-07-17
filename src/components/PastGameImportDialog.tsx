"use client";

import {
  Alert,
  Button,
  Checkbox,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
  Typography,
} from "@heroui/react";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FullscreenModal } from "@/components/ui/FullscreenModal";
import type { Team } from "@/datamodel";
import {
  IMPORT_MAX_DATA_ROWS,
  IMPORT_MAX_FILE_BYTES,
} from "@/gameImport/csvContract";
import type { ImportDiagnostic } from "@/gameImport/types";
import {
  confirmGameImportMutation,
  type GameImportPreviewResponse,
  listTeamsQuery,
  previewGameImportMutation,
} from "@/server/api/client";

type ReadyPreview = Extract<GameImportPreviewResponse, { status: "ready" }>;

type WizardState =
  | { step: "choose" }
  | { step: "metadata"; formatVersion: string; missing: string[] }
  | { step: "invalid"; diagnostics: ImportDiagnostic[] }
  | { step: "preview"; preview: ReadyPreview }
  | { step: "success"; gameId: number };

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

function DiagnosticsList({ diagnostics }: { diagnostics: ImportDiagnostic[] }) {
  return (
    <div className="max-h-72 overflow-y-auto rounded-lg border border-separator">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-separator">
            <th className="p-2">Row</th>
            <th className="p-2">Column</th>
            <th className="p-2">Problem</th>
          </tr>
        </thead>
        <tbody>
          {diagnostics.map((diagnostic, index) => (
            <tr
              // biome-ignore lint/suspicious/noArrayIndexKey: static diagnostic list
              key={`${diagnostic.code}-${index}`}
              className="border-b border-separator last:border-b-0 align-top"
            >
              <td className="p-2">{diagnostic.row ?? "—"}</td>
              <td className="p-2">{diagnostic.column ?? "—"}</td>
              <td className="p-2">
                {diagnostic.message}
                {diagnostic.value !== null ? (
                  <span className="block text-muted">
                    Value: {diagnostic.value}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PastGameImportDialog() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [wizard, setWizard] = useState<WizardState>({ step: "choose" });
  const [file, setFile] = useState<File | null>(null);
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [homeTeamId, setHomeTeamId] = useState<number | null>(null);
  const [matchDate, setMatchDate] = useState("");
  const [opponent, setOpponent] = useState("");
  const [allowLikelyDuplicate, setAllowLikelyDuplicate] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const resetAll = () => {
    setWizard({ step: "choose" });
    setFile(null);
    setHomeTeamId(null);
    setMatchDate("");
    setOpponent("");
    setAllowLikelyDuplicate(false);
    setRequestError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const open = async () => {
    setIsOpen(true);
    resetAll();
    try {
      const nextTeams = await listTeamsQuery();
      setTeams(nextTeams);
      // Single-team accounts (including E2E) skip the flaky Select interaction.
      if (nextTeams.length === 1) {
        setHomeTeamId(nextTeams[0].id);
      }
    } catch {
      setTeams([]);
    }
  };

  const close = () => {
    setIsOpen(false);
    resetAll();
  };

  const runPreview = async (selectedFile: File) => {
    setIsBusy(true);
    setRequestError(null);
    try {
      const { body } = await previewGameImportMutation({
        file: selectedFile,
        homeTeamId: homeTeamId ?? undefined,
        matchDate: matchDate || undefined,
        opponent: opponent || undefined,
      });

      if (body.status === "needs_metadata") {
        setWizard({
          step: "metadata",
          formatVersion: body.formatVersion,
          missing: body.missing,
        });
      } else if (body.status === "invalid") {
        setWizard({ step: "invalid", diagnostics: body.diagnostics });
      } else {
        setAllowLikelyDuplicate(false);
        setWizard({ step: "preview", preview: body });
      }
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "The preview request failed.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleFileChange = (nextFile: File | null) => {
    setFile(nextFile);
    setWizard({ step: "choose" });
    setRequestError(null);
    if (!nextFile) {
      return;
    }
    if (nextFile.size > IMPORT_MAX_FILE_BYTES) {
      setRequestError(
        `The file exceeds the ${IMPORT_MAX_FILE_BYTES / (1024 * 1024)} MiB limit.`,
      );
      return;
    }
    void runPreview(nextFile);
  };

  const handleConfirm = async () => {
    if (!file || wizard.step !== "preview") {
      return;
    }
    setIsBusy(true);
    setRequestError(null);
    try {
      const { httpStatus, body } = await confirmGameImportMutation(
        {
          file,
          homeTeamId: homeTeamId ?? undefined,
          matchDate: matchDate || undefined,
          opponent: opponent || undefined,
        },
        {
          previewFingerprint: wizard.preview.fingerprint,
          allowLikelyDuplicate,
        },
      );

      if (httpStatus === 201 && "gameId" in body) {
        setAnnouncement("Game imported successfully.");
        setWizard({ step: "success", gameId: body.gameId });
        router.refresh();
        setIsOpen(false);
        resetAll();
        router.push(`/past-games/${body.gameId}`);
        return;
      }

      if ("status" in body && body.status === "invalid") {
        setWizard({ step: "invalid", diagnostics: body.diagnostics });
        return;
      }

      if ("status" in body && body.status === "conflict") {
        if (body.code === "PREVIEW_STALE") {
          setRequestError(
            "The file or metadata changed since the preview. Preview again.",
          );
        } else if (body.code === "EXACT_DUPLICATE") {
          setRequestError(
            "This file was already imported. Open the existing game from Past Games.",
          );
        } else {
          setRequestError(
            "A likely duplicate exists. Tick the acknowledgement checkbox to import anyway.",
          );
        }
      }
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "The import request failed.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const needsMatchDate =
    wizard.step === "metadata" && wizard.missing.includes("matchDate");

  return (
    <>
      <Button variant="secondary" onPress={() => void open()}>
        <Upload className="size-4" />
        Import game from CSV
      </Button>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
      <FullscreenModal
        isOpen={isOpen}
        onClose={close}
        title="Import game from CSV"
      >
        <Typography.Paragraph color="muted">
          Upload an Arcazzi CSV export (max{" "}
          {IMPORT_MAX_FILE_BYTES / (1024 * 1024)} MiB /{" "}
          {IMPORT_MAX_DATA_ROWS.toLocaleString()} rows). See the{" "}
          <a className="link" href="/examples/arcazzi-game-v1.csv" download>
            downloadable template
          </a>{" "}
          for the expected format.
        </Typography.Paragraph>

        <div className="flex flex-col gap-2">
          <label className="font-medium text-sm" htmlFor="game-import-file">
            CSV file
          </label>
          <input
            ref={fileInputRef}
            accept=".csv,text/csv"
            className="rounded-lg border border-separator p-2 text-sm"
            disabled={teams === null}
            id="game-import-file"
            type="file"
            onChange={(event) =>
              handleFileChange(event.target.files?.[0] ?? null)
            }
          />
        </div>

        {wizard.step === "metadata" && (
          <div className="flex flex-col gap-4">
            <Select
              fullWidth
              placeholder="Select your team"
              value={homeTeamId?.toString() ?? null}
              onChange={(nextValue) => {
                setHomeTeamId(nextValue ? Number(nextValue) : null);
              }}
            >
              <Label>Tracked team</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {(teams ?? []).map((team) => (
                    <ListBox.Item
                      key={team.id}
                      id={team.id.toString()}
                      textValue={team.name}
                    >
                      {team.name}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            {needsMatchDate ? (
              <TextField fullWidth value={matchDate} onChange={setMatchDate}>
                <Label>Match date</Label>
                <Input placeholder="YYYY-MM-DD" type="date" />
              </TextField>
            ) : null}

            {wizard.step === "metadata" ? (
              <TextField fullWidth value={opponent} onChange={setOpponent}>
                <Label>Opponent (optional)</Label>
                <Input />
              </TextField>
            ) : null}

            {wizard.step === "metadata" ? (
              <Button
                isDisabled={
                  isBusy ||
                  !file ||
                  homeTeamId === null ||
                  (needsMatchDate && matchDate === "")
                }
                isPending={isBusy}
                variant="primary"
                onPress={() => {
                  if (file) {
                    void runPreview(file);
                  }
                }}
              >
                Preview import
              </Button>
            ) : null}
          </div>
        )}

        {wizard.step === "invalid" ? (
          <div className="flex flex-col gap-3">
            <Alert status="danger">
              <Alert.Content>
                <Alert.Title>The file failed validation</Alert.Title>
                <Alert.Description>
                  Fix the problems below and choose the file again. Nothing was
                  imported.
                </Alert.Description>
              </Alert.Content>
            </Alert>
            <DiagnosticsList diagnostics={wizard.diagnostics} />
          </div>
        ) : null}

        {wizard.step === "preview" ? (
          <div className="flex flex-col gap-3">
            <Alert status="success">
              <Alert.Content>
                <Alert.Title>Ready to import</Alert.Title>
                <Alert.Description>
                  Review the summary below, then confirm the import.
                </Alert.Description>
              </Alert.Content>
            </Alert>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted">Team</dt>
              <dd>{wizard.preview.trackedTeamName}</dd>
              <dt className="text-muted">Opponent</dt>
              <dd>{wizard.preview.opponentName ?? "—"}</dd>
              <dt className="text-muted">Date</dt>
              <dd>{formatDate(wizard.preview.matchStartedAt)}</dd>
              <dt className="text-muted">Players</dt>
              <dd>{wizard.preview.playerCount}</dd>
              <dt className="text-muted">Events</dt>
              <dd>{wizard.preview.eventCount}</dd>
              <dt className="text-muted">Goals</dt>
              <dd>{wizard.preview.goalCount}</dd>
              <dt className="text-muted">Format</dt>
              <dd>{wizard.preview.formatVersion}</dd>
              <dt className="text-muted">File</dt>
              <dd>{wizard.preview.sanitizedFilename}</dd>
            </dl>

            {wizard.preview.warnings.length > 0 ? (
              <Alert status="warning">
                <Alert.Content>
                  <Alert.Title>Warnings</Alert.Title>
                  <Alert.Description>
                    {wizard.preview.warnings
                      .map((warning) => warning.message)
                      .join(" ")}
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}

            {wizard.preview.duplicate.kind === "exact" ? (
              <Alert status="danger">
                <Alert.Content>
                  <Alert.Title>Already imported</Alert.Title>
                  <Alert.Description>
                    This exact file was already imported.{" "}
                    <a
                      className="link"
                      href={`/past-games/${wizard.preview.duplicate.existingGameId}`}
                    >
                      Open the existing game
                    </a>{" "}
                    or cancel.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}

            {wizard.preview.duplicate.kind === "likely" ? (
              <div className="flex flex-col gap-2">
                <Alert status="warning">
                  <Alert.Content>
                    <Alert.Title>Likely duplicate</Alert.Title>
                    <Alert.Description>
                      A game with the same team, date and opponent already
                      exists.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
                <Checkbox
                  isSelected={allowLikelyDuplicate}
                  onChange={setAllowLikelyDuplicate}
                >
                  <Checkbox.Indicator />
                  <Label>
                    Import anyway; I know this looks like a duplicate
                  </Label>
                </Checkbox>
              </div>
            ) : null}

            <Button
              isDisabled={
                isBusy ||
                wizard.preview.duplicate.kind === "exact" ||
                (wizard.preview.duplicate.kind === "likely" &&
                  !allowLikelyDuplicate)
              }
              isPending={isBusy}
              variant="primary"
              onPress={() => void handleConfirm()}
            >
              Import completed game
            </Button>
          </div>
        ) : null}

        {requestError !== null ? (
          <Alert status="danger">
            <Alert.Content>
              <Alert.Title>Import failed</Alert.Title>
              <Alert.Description>{requestError}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        <Button variant="ghost" onPress={close}>
          Cancel
        </Button>
      </FullscreenModal>
    </>
  );
}
