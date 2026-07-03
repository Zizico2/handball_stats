"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export function clientOnly<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>,
) {
  return dynamic(loader, { ssr: false });
}
