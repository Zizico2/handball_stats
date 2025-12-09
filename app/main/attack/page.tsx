import { Box, Button, HStack, VStack, Text } from "@chakra-ui/react";
import Image from "next/image";
import Link from "next/link";

const attackOptions = [
    { kind: "shot", label: "Shot", color: "green", next: "/main/attack/shot" },
    { kind: "7m_provoked", label: "7m Provoked", color: "red", next: "/main/choose_player?kind=7m_provoked" },
    { kind: "2min_provoked", label: "2min Provoked", color: "orange", next: "/main/choose_player?kind=2min_provoked" },
    { kind: "turnover", label: "Turnover", color: "purple", next: "/main/choose_player?kind=turnover" },
];

export default function Home() {
    return (
        <>
            <Text>Attack</Text>
            <Box style={{ height: '100vh' }}>
                <VStack style={{ height: '80%' }}>
                    {attackOptions.map(option => (
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
                    {/* <Button style={{ width: '90%', height: '70px', backgroundColor: 'green' }}>
                        Goal
                    </Button>
                    <Button style={{ width: '90%', height: '70px', backgroundColor: 'red' }}>
                        Save
                    </Button>
                    <Button style={{ width: '90%', height: '70px', backgroundColor: 'blue' }}
                        asChild>
                        <Link href="/miss/choose_player">
                            Miss
                        </Link>
                    </Button>
                    <Button style={{ width: '90%', height: '70px', backgroundColor: 'orange' }}>
                        Block
                    </Button>
                    {/* <Button style={{ width: '90%', height: '70px', backgroundColor: 'yellow' }}>
            Technical Foul
          </Button>
                    <Button style={{ width: '90%', height: '70px', backgroundColor: 'purple' }}>
                        Turnover
                    </Button>
                 */}
                </VStack>
            </Box>
        </>
    );
}
