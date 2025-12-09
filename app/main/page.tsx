import { Box, Button, HStack, VStack } from "@chakra-ui/react";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <Box style={{ height: '100vh', width: '90%', margin: 'auto' }}>
        <VStack style={{ height: '80%', display: 'flex', width: '100%' }}>
          <Button style={{ width: '100%', backgroundColor: 'aqua', flexGrow: 1 }} asChild>
            <Link href="/main/defense">Defense</Link>

          </Button>
          <Button style={{ width: '100%', backgroundColor: 'pink', flexGrow: 1 }} asChild>
            <Link href="/main/attack">Attack</Link>
          </Button>
        </VStack>
        <HStack style={{ height: '20%', justifyContent: 'space-between', paddingTop: '50px', paddingBottom: '50px', width: '100%' }}>
          <Button style={{ height: '100%', backgroundColor: 'gray', color: 'white', flexGrow: 1 }}>
            Sanction
          </Button>
          <Button style={{ height: '100%', backgroundColor: 'brown', color: 'white', flexGrow: 1 }}>
            Technical Foul
          </Button>
        </HStack>
      </Box>
    </>
  );
}
