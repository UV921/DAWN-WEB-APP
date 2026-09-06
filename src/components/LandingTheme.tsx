"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type LandingTheme = "dark" | "light";

const KEY = "dawn-landing-theme";

const Ctx = createContext<{
  theme: LandingTheme;
  toggle: () => void;
}>({
  theme: "dark",
  toggle: () => undefined,
});

export function useLandingTheme() {
  return useContext(Ctx);
}

function readTheme(): LandingTheme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  return "dark";
}

export function LandingThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<LandingTheme>("dark");

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
    document.documentElement.dataset.landingTheme = theme;
  }, [theme]);

  return (
    <Ctx.Provider
      value={{
        theme,
        toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
