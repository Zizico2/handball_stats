import { SignInButton, SignUpButton } from "@clerk/nextjs";
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

const alphaNotes = [
  "Track games live without a setup ceremony.",
  "Build teams quickly and keep the match moving.",
  "Expect rough edges. This is still an alpha.",
];

export default function SignedOutEntry() {
  // TODO: this is a placeholder. some styles here are duplicated from signed in and from layout. should make this good
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        px: 2,
        py: 4,
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at top, rgba(255, 255, 255, 0.08), transparent 35%), linear-gradient(180deg, rgba(18, 18, 18, 0.98) 0%, rgba(12, 12, 12, 1) 100%)",
      }}
    >
      <Paper
        elevation={4}
        sx={{
          width: "100%",
          maxWidth: 520,
          p: { xs: 3, sm: 4 },
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          backgroundColor: "background.paper",
        }}
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Arcazzi alpha
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>
              Handball stats, minus the ceremony.
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1.5 }}>
              Sign in if you already have access, or create an account and start
              poking at the edges.
            </Typography>
          </Box>

          <List disablePadding>
            {alphaNotes.map((note) => (
              <ListItem
                key={note}
                disableGutters
                sx={{ alignItems: "flex-start", py: 0.5 }}
              >
                <ListItemText primary={note} />
              </ListItem>
            ))}
          </List>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <SignInButton>
              <Button fullWidth variant="contained" size="large">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton>
              <Button fullWidth variant="outlined" size="large">
                Create account
              </Button>
            </SignUpButton>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
