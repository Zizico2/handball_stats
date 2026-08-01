import z from "zod";
import { playerEventsCollection } from "@/collections";
import {
  type ClientId,
  type PlayerEvent,
  playerEventSchema,
} from "@/datamodel";

export type PersistableWrite = {
  event: PlayerEvent;
  isPersisted: { promise: Promise<unknown> };
};

export function insertPlayerEvent(partialEvent: unknown): PersistableWrite {
  try {
    const parsedEvent = playerEventSchema.parse(partialEvent);
    const transaction = playerEventsCollection.insert(parsedEvent);
    return {
      event: parsedEvent,
      isPersisted: transaction.isPersisted,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.issues);
    } else {
      console.error("Failed to insert player event:", error);
    }
    throw error;
  }
}

export async function awaitPlayerEventPersistence(
  tx: PersistableWrite,
): Promise<void> {
  try {
    await tx.isPersisted.promise;
  } catch (error) {
    try {
      await playerEventsCollection.utils.refetch();
      const persisted = playerEventsCollection.get(tx.event.id);
      if (persisted && hasSamePlayerEventIntent(persisted, tx.event)) {
        return;
      }
    } catch (reconcileError) {
      console.error(
        "Failed to reconcile player event persistence",
        reconcileError,
      );
    }
    throw error;
  }
}

export async function awaitPlayerEventDeletionPersistence(
  tx: { isPersisted: { promise: Promise<unknown> } },
  eventId: ClientId,
): Promise<void> {
  try {
    await tx.isPersisted.promise;
  } catch (error) {
    try {
      await playerEventsCollection.utils.refetch();
      if (playerEventsCollection.get(eventId) === undefined) {
        return;
      }
    } catch (reconcileError) {
      console.error(
        "Failed to reconcile player event deletion",
        reconcileError,
      );
    }
    throw error;
  }
}

function hasSamePlayerEventIntent(actual: PlayerEvent, expected: PlayerEvent) {
  return (
    actual.id === expected.id &&
    actual.game_id === expected.game_id &&
    actual.player === expected.player &&
    actual.half === expected.half &&
    actual.eventType === expected.eventType &&
    actual.eventGroup === expected.eventGroup &&
    JSON.stringify("event" in actual ? actual.event : null) ===
      JSON.stringify("event" in expected ? expected.event : null)
  );
}
