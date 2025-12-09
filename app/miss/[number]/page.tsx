
import { TestKindButton } from "@/components/ui/test-kind-button";
import { Box, Button, HStack, Link, VStack, Text } from "@chakra-ui/react";


export default async function Page({
    params,
}: {
    params: Promise<{ kind: string, number: string }>
}) {

    const { kind, number } = await params;

    return (
        <>
            <Text>{kind} - {number}</Text>
        </>
    );
}
