"use client";

import DownloadIcon from "@mui/icons-material/Download";
import { Button } from "@mui/material";

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
    <Button
      onClick={handleDownload}
      startIcon={<DownloadIcon />}
      variant="outlined"
      sx={{ alignSelf: "flex-start" }}
    >
      Export event log CSV
    </Button>
  );
}
