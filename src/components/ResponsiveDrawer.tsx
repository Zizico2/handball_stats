"use client";

import MailIcon from "@mui/icons-material/Mail";
import MenuIcon from "@mui/icons-material/Menu";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import InboxIcon from "@mui/icons-material/MoveToInbox";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useAtomValue } from "jotai";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
import { useState } from "react";
import { inGameControlsAtom } from "@/inGameControlsAtoms";

const drawerWidth = 240;

export default function ResponsiveDrawer({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const inGameControls = useAtomValue(inGameControlsAtom);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [controlsAnchorEl, setControlsAnchorEl] = useState<HTMLElement | null>(
    null,
  );

  const isInGamePage = pathname === "/in-game";
  const isControlsMenuOpen = controlsAnchorEl !== null;

  const handleDrawerClose = () => {
    setIsClosing(true);
    setMobileOpen(false);
  };

  const handleDrawerTransitionEnd = () => {
    setIsClosing(false);
  };

  const handleDrawerToggle = () => {
    if (!isClosing) {
      setMobileOpen(!mobileOpen);
    }
  };

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

  const drawer = (
    <>
      <Toolbar />
      <Divider />
      <List>
        {[
          { text: "Home", href: "/" },
          { text: "In Game", href: "/in-game" },
          { text: "Create Teams", href: "/create-teams" },
          // { text: "Inbox", href: "/inbox" },
          // { text: "Starred", href: "/starred" },
          // { text: "Send email", href: "/send-email" },
          // { text: "Drafts", href: "/drafts" },
        ].map((item, index) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton component={NextLink} href={item.href}>
              <ListItemIcon>
                {index % 2 === 0 ? <InboxIcon /> : <MailIcon />}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      {/* <Divider />
      <List>
        {["All mail", "Trash", "Spam"].map((text, index) => (
          <ListItem key={text} disablePadding>
            <ListItemButton>
              <ListItemIcon>
                {index % 2 === 0 ? <InboxIcon /> : <MailIcon />}
              </ListItemIcon>
              <ListItemText primary={text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List> */}
    </>
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        width: "100%",
        height: "100%",
      }}
    >
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        {/* The implementation can be swapped with js to avoid SEO duplication of links. */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onTransitionEnd={handleDrawerTransitionEnd}
          onClose={handleDrawerClose}
          sx={{
            display: { xs: "block", sm: "none" },
            // "& .MuiDrawer-paper": {
            //   boxSizing: "border-box",
            //   width: drawerWidth,
            // },
          }}
          slotProps={{
            root: {
              keepMounted: true, // Better open performance on mobile.
            },
            paper: {
              sx: {
                boxSizing: "border-box",
                width: drawerWidth,
              },
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          slotProps={{
            paper: {
              sx: {
                boxSizing: "border-box",
                width: drawerWidth,
              },
            },
          }}
          sx={{
            display: { xs: "none", sm: "block" },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
        }}
      >
        <AppBar
          // position="fixed"
          //position="absolute"
          position="static"
          sx={{
            // width: { sm: `calc(100% - ${drawerWidth}px)` },
            // ml: { sm: `${drawerWidth}px` },
            height: "min-content",
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { sm: "none" } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{ flexGrow: 1 }}
            >
              Arcazzi
            </Typography>
            {isInGamePage && (
              <>
                <IconButton
                  color="inherit"
                  aria-label="match controls"
                  aria-controls={
                    isControlsMenuOpen ? "match-controls-menu" : undefined
                  }
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
                    onClick={() =>
                      runActionAndCloseMenu(inGameControls.onStartFirstHalf)
                    }
                    disabled={inGameControls.matchStatus !== null}
                  >
                    Start First Half
                  </MenuItem>
                  <MenuItem
                    onClick={() =>
                      runActionAndCloseMenu(inGameControls.onStartHalftime)
                    }
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
                    onClick={() =>
                      runActionAndCloseMenu(inGameControls.onTogglePause)
                    }
                    disabled={
                      inGameControls.matchStatus === null ||
                      inGameControls.matchStatus === "halftime"
                    }
                  >
                    {inGameControls.isRunning ? "Pause Match" : "Resume Match"}
                  </MenuItem>
                  <MenuItem
                    onClick={() =>
                      runActionAndCloseMenu(inGameControls.onClearGame)
                    }
                  >
                    Clear Game
                  </MenuItem>
                </Menu>
              </>
            )}
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: { sm: `calc(100% - ${drawerWidth}px)` },
            display: "flex",
            flexDirection: "column",
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
