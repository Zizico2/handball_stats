"use client";

import { Button, Typography } from "@heroui/react";
import type { ReactNode } from "react";
import { FullscreenModal } from "./FullscreenModal";

export interface ListSelectionOption<T> {
  text: string;
  label?: ReactNode;
  key: string;
  value: T;
  group?: string;
  disabled?: boolean;
}

export function ListSelectionModal<T>({
  isOpen,
  title,
  options,
  onPickOption,
}: {
  isOpen: boolean;
  title: string;
  options: ListSelectionOption<T>[];
  onPickOption: (option: T | null) => void;
}) {
  return (
    <FullscreenModal
      isOpen={isOpen}
      onClose={() => onPickOption(null)}
      title={title}
    >
      {options.every((option) => !option.group)
        ? options.map((option) => (
            <Button
              key={option.key}
              isDisabled={option.disabled}
              variant="primary"
              onPress={() => onPickOption(option.value)}
            >
              {option.label ?? option.text}
            </Button>
          ))
        : Array.from(new Set(options.map((option) => option.group || ""))).map(
            (groupName) => (
              <div key={groupName} className="flex flex-col gap-2">
                {groupName ? (
                  <Typography.Paragraph
                    color="muted"
                    className="mt-1 font-bold"
                  >
                    {groupName}
                  </Typography.Paragraph>
                ) : null}
                <div className="flex flex-col gap-3">
                  {options
                    .filter((option) => (option.group || "") === groupName)
                    .map((option) => (
                      <Button
                        key={option.key}
                        isDisabled={option.disabled}
                        variant="primary"
                        onPress={() => onPickOption(option.value)}
                      >
                        {option.label ?? option.text}
                      </Button>
                    ))}
                </div>
              </div>
            ),
          )}
    </FullscreenModal>
  );
}
