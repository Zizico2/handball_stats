import { Box, Button, VStack, Text } from "@chakra-ui/react";
import Link from "next/link";

const shotOptions = [
    { kind: "goal", label: "Goal", color: "green", next: "/main/choose_player?kind=goal" },
    { kind: "miss", label: "Miss", color: "red", next: "/main/choose_player?kind=miss" },
    { kind: "save", label: "Save", color: "blue", next: "/main/choose_player?kind=save" },
    { kind: "block", label: "Block", color: "orange", next: "/main/choose_player?kind=block" },
];


export default function TestPage() {
    return (
        <>
            <Text>Shot</Text>
            <Box style={{ height: '100vh' }}>
                <VStack style={{ height: '80%' }}>
                    {shotOptions.map(option => (
                        <Button
                            key={option.kind}
                            style={{ width: '90%', height: '70px', backgroundColor: option.color }}
                            asChild
                        >
                            <Link href={option.next}>
                                {option.label}
                            </Link>
                        </Button>
                    ))}
                </VStack>

            </Box>
        </>
    );
}