"use client";

export function useNextLocalId<
  T extends { id: number } | null | undefined,
>(result: { data: T }): number {
  return (result.data?.id ?? 0) + 1;
}
