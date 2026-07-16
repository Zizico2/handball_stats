import z from "zod";
import { playerEventsCollection } from "@/collections";
import { playerEventSchema } from "@/datamodel";

export type PersistableWrite = {
  isPersisted: { promise: Promise<unknown> };
};

export function insertPlayerEvent(partialEvent: unknown): PersistableWrite {
  try {
    const parsedEvent = playerEventSchema.parse(partialEvent);
    return playerEventsCollection.insert(parsedEvent);
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
  await tx.isPersisted.promise;
}
