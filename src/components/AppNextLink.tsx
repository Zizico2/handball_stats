import NextLink from "next/link";
import type { ComponentProps } from "react";

type AppNextLinkProps = ComponentProps<typeof NextLink>;

export function AppNextLink(props: AppNextLinkProps) {
  return <NextLink prefetch={true} {...props} />;
}
