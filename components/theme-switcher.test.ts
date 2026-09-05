import { describe, expect, it } from "vitest";

function determineAppliedTheme(
  userSelection: "light" | "system" | "dark" | null,
  systemPrefersDark: boolean,
): "light" | "dark" {
  if (userSelection === "dark") return "dark";
  if (userSelection === "light") return "light";
  return systemPrefersDark ? "dark" : "light";
}

describe("Theme Selection & Persistence Logic", () => {
  it("defaults to system setting when no explicit selection exists", () => {
    expect(determineAppliedTheme(null, true)).toBe("dark");
    expect(determineAppliedTheme(null, false)).toBe("light");
    expect(determineAppliedTheme("system", true)).toBe("dark");
    expect(determineAppliedTheme("system", false)).toBe("light");
  });

  it("overrides system setting when light or dark is explicitly selected", () => {
    expect(determineAppliedTheme("light", true)).toBe("light");
    expect(determineAppliedTheme("dark", false)).toBe("dark");
  });
});
