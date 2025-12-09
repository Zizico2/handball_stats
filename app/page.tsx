import { Box, Button, HStack, VStack } from "@chakra-ui/react";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <Box style={{ height: '100vh' }}>
        <VStack style={{ height: '80%' }}>
          <Button style={{ width: '90%', height: '70px', backgroundColor: 'green' }}>
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
          </Button> */}
          <Button style={{ width: '90%', height: '70px', backgroundColor: 'purple' }}>
            Turnover
          </Button>
          {/* <Button style={{ width: '90%', height: '70px', backgroundColor: 'gray' }}>
            Sanction
          </Button> */}
        </VStack>
        <HStack style={{ height: '20%', justifyContent: 'space-between' }}>
          <Button style={{ width: '45%', height: '70px', backgroundColor: 'black', color: 'white' }}>
            Sanction
          </Button>
          <Button style={{ width: '45%', height: '70px', backgroundColor: 'brown', color: 'white' }}>
            Technical Foul
          </Button>
        </HStack>
      </Box>
    </>
  );
}
