"use client";

import { useSyncExternalStore } from "react";
import { IconMoon, IconSun, IconSunMoon } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

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

  // Writes the preference and hands off. The root layout's script owns the
  // class, the `theme-color` meta tags and the OS-change listener; duplicating
  // that resolution here is how the two drifted apart in the first place —
  // choosing `system` re-read the media query once and then stopped listening.
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
    <div
      role="group"
      aria-label="Theme selection"
      className="flex items-center gap-0.5 rounded-lg border p-0.5"
    >
      {/* Icon only. Three spelled-out labels made a preference control the
          widest thing in the header, ahead of the product's own name. */}
      {OPTIONS.map(({ icon: Icon, label, mode }) => (
        <Button
          key={mode}
          type="button"
          variant={theme === mode ? "secondary" : "ghost"}
          size="icon-sm"
          className="size-7"
          onClick={() => applyTheme(mode)}
          aria-pressed={theme === mode}
          aria-label={label}
          title={label}
        >
          <Icon className="size-4" />
        </Button>
      ))}
    </div>
  );
}
