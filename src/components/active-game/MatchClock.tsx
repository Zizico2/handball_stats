import { Typography } from "@heroui/react";
import { formatClockDigits } from "@/lib/display/formatMatchTime";

interface MatchClockProps {
  minutes: number;
  seconds: number;
}

export function MatchClock({ minutes, seconds }: MatchClockProps) {
  return (
    <div>
      <Typography.Heading level={4}>Match Clock</Typography.Heading>
      <Typography.Paragraph>
        {formatClockDigits(minutes, seconds)}
      </Typography.Paragraph>
    </div>
  );
}
