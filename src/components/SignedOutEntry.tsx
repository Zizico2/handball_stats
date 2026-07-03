import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button, Card, Separator, Typography } from "@heroui/react";

const alphaNotes = [
  "Track games live without a setup ceremony.",
  "Build teams quickly and keep the match moving.",
  "Expect rough edges. This is still an alpha.",
];

export default function SignedOutEntry() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%),linear-gradient(180deg,rgba(18,18,18,0.98)_0%,rgba(12,12,12,1)_100%)] px-4 py-8">
      <Card className="w-full max-w-[520px] border border-separator p-6 sm:p-8">
        <Card.Header className="flex flex-col items-start gap-0 pb-0">
          <Typography.Paragraph
            color="muted"
            className="text-xs uppercase tracking-wide"
          >
            Arcazzi alpha
          </Typography.Paragraph>
          <Typography.Heading level={3} className="mt-1">
            Handball stats, minus the ceremony.
          </Typography.Heading>
        </Card.Header>
        <Card.Content className="flex flex-col gap-6 pt-4">
          <Typography.Paragraph className="text-muted">
            Sign in if you already have access, or create an account and start
            poking at the edges.
          </Typography.Paragraph>

          <ul className="flex flex-col gap-1">
            {alphaNotes.map((note) => (
              <li key={note}>
                <Typography.Paragraph>{note}</Typography.Paragraph>
              </li>
            ))}
          </ul>

          <Separator />

          <div className="flex flex-col gap-3 sm:flex-row">
            <SignInButton>
              <Button className="w-full" size="lg" variant="primary">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton>
              <Button className="w-full" size="lg" variant="outline">
                Create account
              </Button>
            </SignUpButton>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
