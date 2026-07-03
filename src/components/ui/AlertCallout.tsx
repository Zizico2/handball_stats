import { Button, Surface, Typography } from "@heroui/react";
import type { ReactNode } from "react";

interface AlertCalloutProps {
  variant: "danger" | "warning";
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

const variantClasses = {
  danger: "border-danger/30 bg-danger/10 text-danger",
  warning: "border-warning/30 bg-warning/10 text-warning",
} as const;

export function AlertCallout({
  variant,
  children,
  action,
  className = "",
}: AlertCalloutProps) {
  return (
    <Surface
      className={`flex flex-col items-center gap-3 rounded-xl border p-4 ${variantClasses[variant]} ${className}`}
      variant="secondary"
    >
      <Typography.Paragraph
        className={`text-center font-medium ${variant === "danger" ? "text-danger" : "text-warning"}`}
      >
        {children}
      </Typography.Paragraph>
      {action}
    </Surface>
  );
}

interface AlertCalloutButtonProps {
  children: ReactNode;
  onPress: () => void;
}

export function AlertCalloutButton({
  children,
  onPress,
}: AlertCalloutButtonProps) {
  return (
    <Button size="sm" variant="primary" onPress={onPress}>
      {children}
    </Button>
  );
}
