"use client";

import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import type { PlayerEvent } from "@/datamodel";

interface EventLogProps {
  events: PlayerEvent[];
  getPlayerLabel: (number: number) => string;
}

export function EventLog({ events, getPlayerLabel }: EventLogProps) {
  const formatElapsed = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const getEventGroupColor = (
    group: string,
  ):
    | "default"
    | "primary"
    | "secondary"
    | "error"
    | "info"
    | "success"
    | "warning" => {
    switch (group) {
      case "attack":
        return "warning";
      case "defense":
        return "primary";
      case "sanction":
        return "error";
      case "substitution":
        return "success";
      default:
        return "default";
    }
  };

  const sortedEvents = [...events].sort((a, b) => b.id - a.id);

  return (
    <Box sx={{ mt: 4, width: "100%", maxWidth: 600, mx: "auto" }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: "bold" }}>
        Match Log
      </Typography>
      <Box
        sx={{
          maxHeight: 400,
          overflowY: "auto",
          pr: 1,
          "&::-webkit-scrollbar": {
            width: "6px",
          },
          "&::-webkit-scrollbar-track": {
            background: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "rgba(0, 0, 0, 0.1)",
            borderRadius: "4px",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            background: "rgba(0, 0, 0, 0.2)",
          },
        }}
      >
        <Stack spacing={1.5}>
          {sortedEvents.length === 0 ? (
            <Typography
              color="text.secondary"
              textAlign="center"
              sx={{ py: 4 }}
            >
              No events recorded yet.
            </Typography>
          ) : (
            sortedEvents.map((event) => (
              <Card
                key={event.id}
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  boxShadow: "0px 1px 3px rgba(0,0,0,0.05)",
                  borderColor: "divider",
                }}
              >
                <CardContent
                  sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    spacing={2}
                  >
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: "monospace",
                          fontWeight: "bold",
                          color: "text.secondary",
                          bgcolor: "action.selected",
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                        }}
                      >
                        {formatElapsed(event.ellapsed_seconds)}
                      </Typography>
                      <Chip
                        size="small"
                        label={event.eventGroup.toUpperCase()}
                        color={getEventGroupColor(event.eventGroup)}
                        variant="outlined"
                        sx={{ fontWeight: "medium", fontSize: "0.7rem" }}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {event.half === "firstHalf" ? "1st Half" : "2nd Half"}
                    </Typography>
                  </Stack>

                  <Divider sx={{ my: 1 }} />

                  {event.eventType === "substitution" ? (
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{ mt: 0.5 }}
                    >
                      <Typography
                        variant="body1"
                        sx={{ fontWeight: "medium", color: "error.main" }}
                      >
                        {getPlayerLabel(event.player)}
                      </Typography>
                      <SwapHorizIcon color="action" />
                      <Typography
                        variant="body1"
                        sx={{ fontWeight: "medium", color: "success.main" }}
                      >
                        {getPlayerLabel(event.event.playerIn)}
                      </Typography>
                    </Stack>
                  ) : (
                    <Box sx={{ mt: 0.5 }}>
                      <Typography variant="body1" sx={{ fontWeight: "medium" }}>
                        {getPlayerLabel(event.player)} —{" "}
                        <span style={{ textTransform: "capitalize" }}>
                          {event.eventType.replace(/([A-Z])/g, " $1")}
                        </span>
                      </Typography>
                      {"event" in event && event.eventType === "shot" && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 0.5 }}
                        >
                          Goal:{" "}
                          <strong>{event.event.goal ? "Yes" : "No"}</strong>
                          {event.event.direction &&
                            ` | Direction: ${event.event.direction}`}
                          {event.event.aim && ` | Aim: ${event.event.aim}`}
                        </Typography>
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      </Box>
    </Box>
  );
}
