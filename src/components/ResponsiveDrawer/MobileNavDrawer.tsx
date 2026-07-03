"use client";

import { Drawer } from "@heroui/react";
import { NavLinks } from "@/components/ResponsiveDrawer/NavLinks";

interface MobileNavDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNavDrawer({
  isOpen,
  onOpenChange,
}: MobileNavDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content className="w-60 sm:hidden" placement="left">
        <Drawer.Dialog>
          <Drawer.Header>
            <Drawer.Heading>Arcazzi</Drawer.Heading>
          </Drawer.Header>
          <Drawer.Body>
            <NavLinks onNavigate={() => onOpenChange(false)} />
          </Drawer.Body>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
