import { Box, Button, HStack, VStack } from "@chakra-ui/react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  redirect(`/main`);
}

