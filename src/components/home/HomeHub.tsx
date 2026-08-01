"use client";

import { Button, Chip, Typography } from "@heroui/react";
import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  activeGameCollection,
  gamesCollection,
  pauseTogglesCollection,
  teamPlayersCollection,
  teamsCollection,
} from "@/collections";
import { AppNextLink } from "@/components/AppNextLink";
import { resolveHomeHubState } from "@/components/home/resolveHomeHubState";
import type { MatchStatus } from "@/inGameControlsAtoms";
import {
  formatClockRunningState,
  formatMatchPhase,
} from "@/lib/display/formatMatchPhase";
import { formatClockDigits } from "@/lib/display/formatMatchTime";
import { buildMatchClockSnapshot } from "@/server/matchClockLogic";
import { useNow } from "@/useNow";

function matchStatusFromGame(game: {
  firstHalfStartedAtMs: number | null;
  halftimeStartedAtMs: number | null;
  secondHalfStartedAtMs: number | null;
}): MatchStatus | null {
  if (game.secondHalfStartedAtMs != null) {
    return "secondHalf";
  }
  if (game.halftimeStartedAtMs != null) {
    return "halftime";
  }
  if (game.firstHalfStartedAtMs != null) {
    return "firstHalf";
  }
  return null;
}

function HomeHub() {
  const router = useRouter();
  const teams = useLiveSuspenseQuery((q) => q.from({ team: teamsCollection }));
  const teamPlayers = useLiveSuspenseQuery((q) =>
    q.from({ player: teamPlayersCollection }),
  );
  const games = useLiveSuspenseQuery((q) => q.from({ game: gamesCollection }));
  const activeGame = useLiveSuspenseQuery((q) =>
    q.from({ activeGame: activeGameCollection }).findOne(),
  );
  const pauseToggles = useLiveSuspenseQuery((q) =>
    q.from({ pauseToggle: pauseTogglesCollection }),
  );

  const activeGameData = activeGame.data ?? null;
  const activeGameRecord = useMemo(() => {
    if (!activeGameData) {
      return null;
    }
    return games.data.find((game) => game.id === activeGameData.gameId) ?? null;
  }, [activeGameData, games.data]);

  const activeTeamName = useMemo(() => {
    if (!activeGameData) {
      return null;
    }
    return (
      teams.data.find((team) => team.id === activeGameData.homeTeamId)?.name ??
      null
    );
  }, [activeGameData, teams.data]);

  const matchStatus = activeGameRecord
    ? matchStatusFromGame({
        firstHalfStartedAtMs: activeGameRecord.firstHalfStartedAtMs ?? null,
        halftimeStartedAtMs: activeGameRecord.halftimeStartedAtMs ?? null,
        secondHalfStartedAtMs: activeGameRecord.secondHalfStartedAtMs ?? null,
      })
    : null;

  const isRunning = useMemo(() => {
    if (
      !activeGameRecord ||
      matchStatus === null ||
      matchStatus === "halftime"
    ) {
      return false;
    }
    const halfToggles = pauseToggles.data.filter(
      (toggle) =>
        toggle.gameId === activeGameRecord.id && toggle.half === matchStatus,
    );
    return halfToggles.length % 2 === 0;
  }, [activeGameRecord, matchStatus, pauseToggles.data]);

  const clockIsTicking = Boolean(
    activeGameRecord &&
      matchStatus !== null &&
      matchStatus !== "halftime" &&
      isRunning,
  );
  const nowMs = useNow(clockIsTicking, 1000);

  const clockDigits = useMemo(() => {
    if (!activeGameRecord) {
      return formatClockDigits(0, 0);
    }
    const snapshot = buildMatchClockSnapshot({
      gameId: activeGameRecord.id,
      nowMs: clockIsTicking ? nowMs : Date.now(),
      firstHalfStartedAtMs: activeGameRecord.firstHalfStartedAtMs ?? null,
      halftimeStartedAtMs: activeGameRecord.halftimeStartedAtMs ?? null,
      secondHalfStartedAtMs: activeGameRecord.secondHalfStartedAtMs ?? null,
      pauseToggles: pauseToggles.data
        .filter((toggle) => toggle.gameId === activeGameRecord.id)
        .map((toggle) => ({
          half: toggle.half,
          toggledAtMs: toggle.toggledAtMs,
        })),
    });
    const total = snapshot.activeElapsedSeconds;
    return formatClockDigits(Math.floor(total / 60), total % 60);
  }, [activeGameRecord, clockIsTicking, nowMs, pauseToggles.data]);

  const readyTeamPlayerCount = useMemo(() => {
    if (teams.data.length === 0) {
      return 0;
    }
    const counts = new Map<string, number>();
    for (const player of teamPlayers.data) {
      counts.set(player.teamId, (counts.get(player.teamId) ?? 0) + 1);
    }
    return Math.max(0, ...teams.data.map((team) => counts.get(team.id) ?? 0));
  }, [teamPlayers.data, teams.data]);

  const recentGame = useMemo(() => {
    const activeId = activeGameData?.gameId;
    const past = games.data
      .filter((game) => game.id !== activeId)
      .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latest = past[0];
    if (!latest) {
      return null;
    }
    const homeTeamName =
      teams.data.find((team) => team.id === latest.homeTeamId)?.name ??
      `Team #${latest.homeTeamId.slice(-8)}`;
    return { id: latest.id, homeTeamName };
  }, [activeGameData?.gameId, games.data, teams.data]);

  const hub = resolveHomeHubState({
    teamCount: teams.data.length,
    readyTeamPlayerCount,
    hasActiveGame: activeGameData != null,
    activeTeamName,
    recentGame,
  });

  return (
    <main
      className="px-4 py-6 sm:px-6"
      data-hub-kind={hub.kind}
      data-testid="home-hub"
    >
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Typography.Heading level={2}>{hub.title}</Typography.Heading>
          <Typography.Paragraph color="muted">
            {hub.description}
          </Typography.Paragraph>
        </div>

        {hub.kind === "resume-match" ? (
          <div
            className="flex flex-wrap items-center gap-2"
            data-testid="home-hub-match-status"
          >
            <Chip size="sm" variant="secondary">
              {formatMatchPhase(matchStatus)}
            </Chip>
            <Chip
              color={isRunning ? "success" : "warning"}
              size="sm"
              variant="secondary"
            >
              {formatClockRunningState(matchStatus, isRunning)}
            </Chip>
            <Typography.Paragraph className="font-mono text-lg">
              {clockDigits}
            </Typography.Paragraph>
          </div>
        ) : null}

        <Button
          className="min-h-11 w-full sm:w-auto sm:self-start"
          variant="primary"
          onPress={() => {
            router.push(hub.ctaHref);
          }}
        >
          {hub.ctaLabel}
        </Button>

        {hub.recentGame ? (
          <Typography.Paragraph color="muted" className="text-sm">
            Recent:{" "}
            <AppNextLink
              className="link"
              href={`/past-games/${hub.recentGame.id}`}
            >
              {hub.recentGame.homeTeamName} (game #{hub.recentGame.id})
            </AppNextLink>
          </Typography.Paragraph>
        ) : null}
      </div>
    </main>
  );
}

export default HomeHub;
