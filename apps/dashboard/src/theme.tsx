import React, { createContext, useMemo, useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";

export const ColorModeContext = createContext({ toggle: () => {}, mode: "dark" as "light"|"dark" });

export function ColorModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<"light"|"dark">("dark");
  const value = useMemo(() => ({ mode, toggle: () => setMode((m) => m === "dark" ? "light" : "dark") }), [mode]);
  const theme = useMemo(() => createTheme({
    palette: { mode, primary: { main: mode === "dark" ? "#7dd3fc" : "#0369a1" }, background: { default: mode === "dark" ? "#0b1220" : "#f6f8fb" } },
    shape: { borderRadius: 10 },
  }), [mode]);
  return <ColorModeContext.Provider value={value}><ThemeProvider theme={theme}>{children}</ThemeProvider></ColorModeContext.Provider>;
}
