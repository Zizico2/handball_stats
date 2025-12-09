
import { TestKindButton } from "@/components/ui/test-kind-button";
import { Box, Button, HStack, Link, VStack } from "@chakra-ui/react";
import { Union, Literal, Static } from 'runtypes';

const Kind = Union(
    Literal('miss'),
    Literal('save'),
    Literal('goal'),
    Literal('block'),
    Literal('penalty'),
    Literal('7m_provoked'),
    Literal('2min_provoked'),
    Literal('turnover')
);


type Kind = Static<typeof Kind>;
// type Kind = "miss" | "save" | "penalty" | "7m_provoked" | "2min_provoked" | "turnover";

const choosePlayerOptions = [
    {
        key: "1",
        label: "1 - Joao Salavessa",

    },
    {
        key: "2",
        label: "2 - Luis Borges",

    },
    {
        key: "3",
        label: "3 - Afonso Casinha",

    },
    {
        key: "4",
        label: "4 - Guilherme Pereira",

    },
    {
        key: "5",
        label: "5 - Sabino Sequeira",

    },
    {
        key: "6",
        label: "6 - Dario Coelho",

    },
    {
        key: "7",
        label: "7 - Carlos Cabo",

    },
    {
        key: "8",
        label: "8 - Andre Costa",

    },
    {
        key: "9",
        label: "9 - Diogo Lopes",

    },
    {
        key: "10",
        label: "10 - Goncalo Silva",

    },
    {
        key: "27",
        label: "27 - Bernardo Agua",

    },
    {
        key: "11",
        label: "11 - Goncalo Santos",

    },
    {
        key: "12",
        label: "12 - Bruno Sousa",

    },
    {
        key: "13",
        label: "13 - Henrique Franco",

    }];

function playerOptionHref(kind: Kind, playerKey: string) {
    switch (kind) {
        case "miss":
            // go to choose court location page
            return `/main/choose_court_location?kind=${kind}&player=${playerKey}`;
        case "save":
            // go to choose court location page
            return `/main/choose_court_location?kind=${kind}&player=${playerKey}`;
        case "goal":
            // go to choose court location page
            return `/main/choose_court_location?kind=${kind}&player=${playerKey}`;
        case "block":
            // go to choose court location page
            return `/main/choose_court_location?kind=${kind}&player=${playerKey}`;
        case "penalty":
            return `/main/score/${playerKey}`;
        case "7m_provoked":
            // back to main page as this event does not need further info. onNavigate or onClick should complete the event creation
            return "/main";
        case "2min_provoked":
            // back to main page as this event does not need further info. onNavigate or onClick should complete the event creation
            return "/main";
        case "turnover":
            return "/main";
    }
}


export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const kind: Kind = Kind.check((await searchParams).kind);

    return (
        <>
            <Box style={{ height: '100vh' }}>
                <VStack style={{ height: '80%' }}>
                    {choosePlayerOptions.map(option => (
                        <Button
                            key={option.key}
                            style={{ width: '90%', height: '70px', backgroundColor: 'gray' }}
                            asChild
                        >
                            <Link href={playerOptionHref(kind, option.key)}>
                                {option.label}
                            </Link>
                        </Button>
                    ))}
                </VStack>
            </Box>
        </>
    );
}

type Stage = "choose_player";
// type Kind = "miss" | "save" | "goal" | "penalty";

// const A: Option = "penalty";

enum OptionType {
    CourtPosition,
    ShotPosition,
    Player,
}

interface PlayerNumberOption {
    playerNumber: number;
}

interface ShotOptions extends PlayerNumberOption {
    outcome: ShotOutcome;
    // player: number;
}
interface PenaltyOptions extends PlayerNumberOption {
    // outcome: "miss" | "save" | "goal";
    outcome: PenaltyOutcome;
    // player: number;
}

enum ShotOutcome {
    Miss,
    Save,
    Goal,
    Block,
}

type PenaltyOutcome = Exclude<ShotOutcome, ShotOutcome.Block>;



// | save (shot)
// | goal (shot)
// | miss (shot)
// | block (shot)
// | 7m (shot)
// | red card (sanction)
// | yellow card (sanction)
// | two minutes (sanction)
// | 
// | substitution
// | passive play
// | timeout
// | end of half
// | start of half
