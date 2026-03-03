"use client";
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  // 1. Enable CSS variables and map them to the "data" attribute
  cssVariables: {
    colorSchemeSelector: "data",
  },
  typography: {
    fontFamily: "var(--font-roboto)",
  },
  // 2. Explicitly enable the dark color scheme
  colorSchemes: {
    light: true,
    dark: true,
  },
  // ... the rest of your custom palette, typography, etc.
});

export default theme;
