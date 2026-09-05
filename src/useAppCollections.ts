"use client";

import { useDbClient } from "@tanstack/react-db";
import { useMemo } from "react";
import { materializeCollections } from "@/collections";

export function useAppCollections() {
  const client = useDbClient();
  return useMemo(() => materializeCollections(client), [client]);
}
