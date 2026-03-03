"use client";
import { Box, Button } from "@mui/material";
import {
  createCollection,
  localStorageCollectionOptions,
  useLiveQuery,
  useLiveSuspenseQuery,
} from "@tanstack/react-db";
import { useRef, useState } from "react";
import z from "zod";

const todoSchema = z.object({
  id: z.number(),
  name: z.string(),
  // text: z.string(),
  // completed: z.boolean().default(false),
  // created_at: z.string().transform(val => new Date(val)),  // string → Date
  // priority: z.number().default(0)
});

const userPreferencesCollection = createCollection(
  localStorageCollectionOptions({
    id: "user-preferences",
    storageKey: "app-user-prefs",
    schema: todoSchema,
    getKey: (item) => item.id,
  }),
);

export default function InGame(
  // { data, columns }
) {
  const activeUsers = useLiveSuspenseQuery((q) =>
    q.from({ user: userPreferencesCollection }),
  );
  const userIdCounter = useRef(1);

  return (
    <Box sx={{ backgroundColor: "blue", height: "100%", width: "100%" }}>
      sa
      <h1>In Game</h1>
      <Button
        onClick={() => {
          userPreferencesCollection.insert({
            id: userIdCounter.current,
            name: "John Doe",
          });
          userIdCounter.current += 1;
        }}
      >
        Test User Preferences Collection
      </Button>
      <Box>
        hi
        {activeUsers.data.map((user) => (
          <div key={user.id}>
            {user.id}:{user.name}
          </div>
        ))}
      </Box>
    </Box>
  );
}
