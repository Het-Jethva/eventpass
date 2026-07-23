"use client";

import { useState } from "react";
import { IconMoon, IconSun, IconSunMoon } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

type ThemeMode = "light" | "system" | "dark";

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    const stored = localStorage.getItem("eventpass-theme") as ThemeMode | null;
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : "system";
  });

  function applyTheme(mode: ThemeMode) {
    setTheme(mode);
    if (mode === "system") {
      localStorage.removeItem("eventpass-theme");
      const systemDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      if (systemDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      localStorage.setItem("eventpass-theme", mode);
      if (mode === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }

  return (
    <div
      role="group"
      aria-label="Theme selection"
      className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1"
    >
      <Button
        type="button"
        variant={theme === "light" ? "secondary" : "ghost"}
        size="sm"
        className="h-8 px-2.5 text-xs"
        onClick={() => applyTheme("light")}
        aria-pressed={theme === "light"}
        aria-label="Light theme"
      >
        <IconSun className="mr-1.5 size-3.5" />
        Light
      </Button>
      <Button
        type="button"
        variant={theme === "system" ? "secondary" : "ghost"}
        size="sm"
        className="h-8 px-2.5 text-xs"
        onClick={() => applyTheme("system")}
        aria-pressed={theme === "system"}
        aria-label="System theme"
      >
        <IconSunMoon className="mr-1.5 size-3.5" />
        System
      </Button>
      <Button
        type="button"
        variant={theme === "dark" ? "secondary" : "ghost"}
        size="sm"
        className="h-8 px-2.5 text-xs"
        onClick={() => applyTheme("dark")}
        aria-pressed={theme === "dark"}
        aria-label="Dark theme"
      >
        <IconMoon className="mr-1.5 size-3.5" />
        Dark
      </Button>
    </div>
  );
}
