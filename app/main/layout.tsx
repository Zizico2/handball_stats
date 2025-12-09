import { Button } from "@chakra-ui/react";
import Link from "next/link";

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>
        <Button asChild><Link href="/main">Return to Main</Link></Button>
        {children}</>;
}