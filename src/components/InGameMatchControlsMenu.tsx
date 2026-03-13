"use client";

import MoreVertIcon from "@mui/icons-material/MoreVert";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { inGameControlsAtom } from "@/inGameControlsAtoms";

export default function InGameMatchControlsMenu() {
  const inGameControls = useAtomValue(inGameControlsAtom);
  const [controlsAnchorEl, setControlsAnchorEl] = useState<HTMLElement | null>(
    null,
  );

  const isControlsMenuOpen = controlsAnchorEl !== null;

  const handleOpenControlsMenu = (event: React.MouseEvent<HTMLElement>) => {
    setControlsAnchorEl(event.currentTarget);
  };

  const handleCloseControlsMenu = () => {
    setControlsAnchorEl(null);
  };

  const runActionAndCloseMenu = (action: () => void) => {
    action();
    handleCloseControlsMenu();
  };

  return (
    <>
      <IconButton
        color="inherit"
        aria-label="match controls"
        aria-controls={isControlsMenuOpen ? "match-controls-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={isControlsMenuOpen ? "true" : undefined}
        onClick={handleOpenControlsMenu}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        id="match-controls-menu"
        anchorEl={controlsAnchorEl}
        open={isControlsMenuOpen}
        onClose={handleCloseControlsMenu}
        keepMounted
      >
        <MenuItem
          onClick={() => runActionAndCloseMenu(inGameControls.onStartFirstHalf)}
          disabled={inGameControls.matchStatus !== null}
        >
          Start First Half
        </MenuItem>
        <MenuItem
          onClick={() => runActionAndCloseMenu(inGameControls.onStartHalftime)}
          disabled={inGameControls.matchStatus !== "firstHalf"}
        >
          Start Halftime
        </MenuItem>
        <MenuItem
          onClick={() =>
            runActionAndCloseMenu(inGameControls.onStartSecondHalf)
          }
          disabled={inGameControls.matchStatus !== "halftime"}
        >
          Start Second Half
        </MenuItem>
        <MenuItem
          onClick={() => runActionAndCloseMenu(inGameControls.onTogglePause)}
          disabled={
            inGameControls.matchStatus === null ||
            inGameControls.matchStatus === "halftime"
          }
        >
          {inGameControls.isRunning ? "Pause Match" : "Resume Match"}
        </MenuItem>
        <MenuItem
          onClick={() => runActionAndCloseMenu(inGameControls.onClearGame)}
        >
          Clear Game
        </MenuItem>
      </Menu>
    </>
  );
}
