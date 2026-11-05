"use client";

import { useSyncExternalStore } from "react";
import { IconMoon, IconSun, IconSunMoon } from "@tabler/icons-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

type ThemeMode = "light" | "system" | "dark";

const STORAGE_KEY = "eventpass-theme";

// The stored preference lives in localStorage, which the server cannot read.
// Reading it while rendering made the server and the client disagree about
// which button was pressed and produced a hydration mismatch on every page, so
// it is modelled as what it actually is: an external store with its own server
// snapshot. The inline script in the root layout has already applied the class
// by this point; the only thing left to reconcile is this control's own state.
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  // Another tab changing the preference is the same event as this one changing
  // it, so both paths notify through here.
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

// Returns a primitive, so React's identity check is stable without caching.
function getSnapshot(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function getServerSnapshot(): ThemeMode {
  return "system";
}

const OPTIONS = [
  { mode: "light", icon: IconSun, label: "Light theme" },
  { mode: "system", icon: IconSunMoon, label: "Match system theme" },
  { mode: "dark", icon: IconMoon, label: "Dark theme" },
] as const;

export function ThemeSwitcher() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const activeOption =
    OPTIONS.find((option) => option.mode === theme) ?? OPTIONS[1];
  const ActiveIcon = activeOption.icon;

  // Writes the preference and hands off. The root layout script owns the class,
  // the `theme-color` meta tags and the OS change listener.
  function applyTheme(mode: ThemeMode) {
    if (mode === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, mode);
    }

    window.__eventpassTheme?.();
    for (const listener of listeners) listener();
  }

  return (
    <Select
      value={theme}
      onValueChange={(mode) => {
        if (mode === "light" || mode === "system" || mode === "dark")
          applyTheme(mode);
      }}
    >
      <SelectTrigger
        aria-label={`Theme: ${activeOption.label}. Change theme`}
        title="Change theme"
        className="size-11 shrink-0 justify-center bg-transparent p-0 [&>svg:last-child]:hidden"
      >
        <span>
          <ActiveIcon aria-hidden="true" className="size-4" />
        </span>
      </SelectTrigger>
      <SelectContent
        align="end"
        alignItemWithTrigger={false}
        className="w-56 rounded-xl data-open:duration-(--duration-fast) data-closed:duration-(--duration-quick) ease-(--ease-smooth-out)"
      >
        <SelectGroup>
          {OPTIONS.map(({ icon: Icon, label, mode }) => (
            <SelectItem key={mode} value={mode} className="min-h-11 rounded-md">
              <Icon aria-hidden="true" />
              {label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
