"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { EventPassMark } from "@/components/eventpass-mark";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/features/staff-identity/sign-out-button";
import { cn } from "@/lib/utils";

/**
 * The signed-in chrome, shared by the event workspace and the administration
 * surface.
 *
 * It lived inside the `(workspace)` route group, which put `/admin` — the one
 * page in the product that can suspend an account — on a screen with no
 * wordmark, no way back to the events list, no theme control and no sign-out.
 *
 * The `Events` link also carried a hardcoded active underline, so it read as
 * the current section while you were standing on `/admin`.
 */
export function WorkspaceHeader({
  email,
  signOutAction,
  showAdmin,
}: {
  email: string;
  signOutAction: () => void | Promise<void>;
  showAdmin: boolean;
}) {
  const pathname = usePathname();
  const links = [
    { href: "/events", label: "Events", active: pathname.startsWith("/events") },
    ...(showAdmin
      ? [{ href: "/admin", label: "Admin", active: pathname.startsWith("/admin") }]
      : []),
  ];

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/events"
          aria-label="EventPass home"
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <EventPassMark />
        </Link>
        <nav
          className="hidden h-full items-center gap-4 border-l pl-6 sm:flex"
          aria-label="Primary"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.active ? "page" : undefined}
              className={cn(
                "flex h-full items-center border-b-2 px-2 text-sm font-medium transition-colors",
                link.active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <ThemeSwitcher />
          <Badge variant="secondary" className="hidden max-w-52 sm:inline-flex">
            <span className="truncate">{email}</span>
          </Badge>
          <form action={signOutAction}>
            <SignOutButton />
          </form>
        </div>
      </div>
    </header>
  );
}
