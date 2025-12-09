"use client";

import { Button } from "@chakra-ui/react";


type TestKindButtonProps = {
    kind: string;
};

export function TestKindButton({ kind }: TestKindButtonProps) {
    return (
        <Button
            onClick={() => {
                // test
                console.log('kind is', kind);
            }}
        >
            27 - Bernardo
        </Button>
    );
}