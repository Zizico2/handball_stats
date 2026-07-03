"use client";

import { Button } from "@heroui/react";
import { Download } from "lucide-react";

interface PastGameCsvDownloadButtonProps {
  csv: string;
  fileName: string;
}

export function PastGameCsvDownloadButton({
  csv,
  fileName,
}: PastGameCsvDownloadButtonProps) {
  const handleDownload = () => {
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
