"use client";

import { Button } from "@heroui/react";
import { Download } from "lucide-react";
import type { PlayerEvent } from "@/datamodel";
import { playerEventsToCsv } from "@/lib/gameHistory";

interface PastGameCsvDownloadButtonProps {
  events: PlayerEvent[];
  fileName: string;
}

export function PastGameCsvDownloadButton({
  events,
  fileName,
}: PastGameCsvDownloadButtonProps) {
  const handleDownload = () => {
    const csv = playerEventsToCsv(events);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Button className="self-start" variant="outline" onPress={handleDownload}>
      <Download className="size-4" />
      Export event log CSV
    </Button>
  );
}
