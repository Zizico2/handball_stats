import { describe, expect, test } from "bun:test";
import { createActor, fromPromise, waitFor } from "xstate";
import type { PlayerEvent } from "./datamodel";
import { eventMachine } from "./event_form_fsm";
import type { DeepPartial } from "./utils";

const START = {
  type: "START" as const,
  eventGroup: "attack" as const,
  ellapsed_seconds: 42,
  game_id: 5,
  id: 9,
  half: "firstHalf" as const,
};

function createTestActor(
  persist: (event: DeepPartial<PlayerEvent>) => Promise<void> = async () => {},
) {
  return createActor(
    eventMachine.provide({
      actors: {
        persistEvent: fromPromise(
          async ({ input }: { input: DeepPartial<PlayerEvent> }) => {
            await persist(input);
          },
        ),
      },
    }),
  );
}

async function waitForPersistedIdle(
  actor: ReturnType<typeof createTestActor>,
  persisted: DeepPartial<PlayerEvent>[],
  count = 1,
) {
  await waitFor(
    actor,
    (snapshot) => snapshot.matches("idle") && persisted.length === count,
  );
}

describe("event form state machine", () => {
  test("persists on-target goals and completes off-target shots as misses", async () => {
    const persisted: DeepPartial<PlayerEvent>[] = [];
    const actor = createTestActor(async (event) => {
      persisted.push(event);
    });
    actor.start();

    actor.send(START);
    actor.send({ type: "PICK_ATTACK_EVENT_TYPE", eventType: "shot" });
    actor.send({ type: "PICK_PLAYER", player: 7 });
    actor.send({ type: "PICK_SHOT_POSITION", position: "9m+" });
    actor.send({
      type: "PICK_SHOT_DIRECTION",
      pick: { direction: "OnTarget", aim: "TopLeft" },
    });
    actor.send({ type: "PICK_GOAL_OR_NO_GOAL", goal: true });
    await waitForPersistedIdle(actor, persisted);

    expect(persisted[0]).toEqual({
      eventGroup: "attack",
      ellapsed_seconds: 42,
      game_id: 5,
      id: 9,
      half: "firstHalf",
      eventType: "shot",
      player: 7,
      event: {
        position: "9m+",
        direction: "OnTarget",
        aim: "TopLeft",
        goal: true,
      },
    });

    actor.send({ ...START, id: 10, ellapsed_seconds: 51 });
    actor.send({ type: "PICK_ATTACK_EVENT_TYPE", eventType: "shot" });
    actor.send({ type: "PICK_PLAYER", player: 12 });
    actor.send({ type: "PICK_SHOT_POSITION", position: "leftWing" });
    actor.send({
      type: "PICK_SHOT_DIRECTION",
      pick: { direction: "OffTarget" },
    });
    await waitForPersistedIdle(actor, persisted, 2);

    expect(persisted[1]).toMatchObject({
      id: 10,
      eventType: "shot",
      player: 12,
      event: {
        position: "leftWing",
        direction: "OffTarget",
        goal: false,
      },
    });
    actor.stop();
  });

  test("persists representative non-shot groups and substitutions", async () => {
    const scenarios = [
      {
        group: "attack",
        pick: { type: "PICK_ATTACK_EVENT_TYPE", eventType: "lostBall" },
      },
      {
        group: "defense",
        pick: { type: "PICK_DEFENSE_EVENT_TYPE", eventType: "interception" },
      },
      {
        group: "sanction",
        pick: { type: "PICK_SANCTION_EVENT_TYPE", eventType: "yellowCard" },
      },
    ] as const;

    for (const [index, scenario] of scenarios.entries()) {
      const persisted: DeepPartial<PlayerEvent>[] = [];
      const actor = createTestActor(async (event) => {
        persisted.push(event);
      });
      actor.start();
      actor.send({
        ...START,
        id: 20 + index,
        eventGroup: scenario.group,
      });
      actor.send(scenario.pick);
      actor.send({ type: "PICK_PLAYER", player: 7 });
      await waitForPersistedIdle(actor, persisted);
      expect(persisted[0]).toMatchObject({
        eventGroup: scenario.group,
        eventType: scenario.pick.eventType,
        player: 7,
      });
      actor.stop();
    }

    const persisted: DeepPartial<PlayerEvent>[] = [];
    const substitution = createTestActor(async (event) => {
      persisted.push(event);
    });
    substitution.start();
    substitution.send({ ...START, id: 30, eventGroup: "substitution" });
    substitution.send({ type: "PICK_PLAYER", player: 7 });
    substitution.send({ type: "PICK_PLAYER", player: 12 });
    await waitForPersistedIdle(substitution, persisted);
    expect(persisted[0]).toMatchObject({
      eventGroup: "substitution",
      eventType: "substitution",
      player: 7,
      event: { playerIn: 12 },
    });
    substitution.stop();
  });

  test("cancel resets partial context and allows a clean restart", async () => {
    const persisted: DeepPartial<PlayerEvent>[] = [];
    const actor = createTestActor(async (event) => {
      persisted.push(event);
    });
    actor.start();

    actor.send(START);
    actor.send({ type: "PICK_ATTACK_EVENT_TYPE", eventType: "shot" });
    actor.send({ type: "PICK_PLAYER", player: 7 });
    expect(actor.getSnapshot().context.playerEvent).toMatchObject({
      eventType: "shot",
      player: 7,
    });

    actor.send({ type: "CANCEL" });
    expect(actor.getSnapshot().matches("idle")).toBe(true);
    expect(actor.getSnapshot().context.playerEvent).toEqual({});

    actor.send({
      ...START,
      eventGroup: "defense",
      id: 40,
      ellapsed_seconds: 3,
      half: "secondHalf",
    });
    actor.send({
      type: "PICK_DEFENSE_EVENT_TYPE",
      eventType: "blockedShot",
    });
    actor.send({ type: "PICK_PLAYER", player: 12 });
    await waitForPersistedIdle(actor, persisted);
    expect(persisted[0]).toEqual({
      eventGroup: "defense",
      ellapsed_seconds: 3,
      game_id: 5,
      id: 40,
      half: "secondHalf",
      eventType: "blockedShot",
      player: 12,
    });
    expect(actor.getSnapshot().context.playerEvent).toEqual({});
    actor.stop();
  });

  test("ignores messages that are invalid for the current state", () => {
    const actor = createTestActor();
    actor.start();

    actor.send({ type: "PICK_PLAYER", player: 99 });
    expect(actor.getSnapshot().matches("idle")).toBe(true);
    expect(actor.getSnapshot().context.playerEvent).toEqual({});

    actor.send(START);
    expect(actor.getSnapshot().matches("startingAttack")).toBe(true);
    const before = actor.getSnapshot().context.playerEvent;
    actor.send({
      type: "PICK_DEFENSE_EVENT_TYPE",
      eventType: "interception",
    });
    actor.send({
      type: "PICK_ATTACK_EVENT_TYPE",
      eventType: "interception",
    });
    expect(actor.getSnapshot().matches("startingAttack")).toBe(true);
    expect(actor.getSnapshot().context.playerEvent).toEqual(before);
    actor.stop();
  });

  test("retries the same event after persistence rejects", async () => {
    const attempts: DeepPartial<PlayerEvent>[] = [];
    const actor = createTestActor(async (event) => {
      attempts.push(event);
      if (attempts.length === 1) {
        throw new Error("temporary persistence failure");
      }
    });
    actor.start();

    actor.send({ ...START, eventGroup: "sanction" });
    actor.send({
      type: "PICK_SANCTION_EVENT_TYPE",
      eventType: "twoMinuteSuspension",
    });
    actor.send({ type: "PICK_PLAYER", player: 7 });
    await waitFor(actor, (snapshot) => snapshot.matches("persistFailed"));
    expect(attempts).toHaveLength(1);

    actor.send({ type: "RETRY" });
    await waitFor(
      actor,
      (snapshot) => snapshot.matches("idle") && attempts.length === 2,
    );
    expect(attempts[1]).toEqual(attempts[0]);
    actor.stop();
  });
});
