"use client";

import { CloseButton, Modal } from "@heroui/react";
import type { ReactNode } from "react";

export function FullscreenModal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        isDismissable={false}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
      >
        <Modal.Container size="full">
          <Modal.Dialog>
            <Modal.Header className="flex items-center gap-2">
              <CloseButton aria-label="Close" onPress={onClose} />
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">{children}</Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
