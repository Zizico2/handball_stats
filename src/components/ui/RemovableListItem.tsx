import { Button, Typography } from "@heroui/react";
import type { ReactNode } from "react";

interface RemovableListItemProps {
  children: ReactNode;
  onRemove: () => void;
  removeLabel?: string;
}

export function RemovableListItem({
  children,
  onRemove,
  removeLabel = "Remove",
}: RemovableListItemProps) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <Typography.Paragraph>{children}</Typography.Paragraph>
      <Button size="sm" variant="outline" onPress={onRemove}>
        {removeLabel}
      </Button>
    </div>
  );
}
