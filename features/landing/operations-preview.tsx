import {
  IconCircleCheck,
  IconCloudUpload,
  IconCopyCheck,
  IconPointFilled,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// The hero image, built from the product rather than captured from it. The left
// half is the scanner surface a volunteer actually stares at; the right half is
// what the organizer sees at the same moment. Putting them in one frame is the
// only honest way to show that the two agree.

const activity = [
  {
    name: "Amara Okafor",
    code: "3JD8M–P2K7C",
    time: "19:42:06",
    label: "Checked in",
    variant: "success" as const,
    icon: IconCircleCheck,
  },
  {
    name: "Leo Martinez",
    code: "8RW2F–N6Q4A",
    time: "19:41:51",
    label: "Not confirmed",
    variant: "provisional" as const,
    icon: IconCloudUpload,
  },
  {
    name: "Maya Singh",
    code: "5TC9B–H7X3E",
    time: "19:41:28",
    label: "Repeat scan",
    variant: "warning" as const,
    icon: IconCopyCheck,
  },
];

export function OperationsPreview() {
  return (
    <figure className="overflow-hidden rounded-xl border bg-card text-card-foreground">
      {/* Not flex-wrap: on a phone the status badge dropped to its own line and
          lost the `ml-auto` that was keeping it opposite the event name. */}
      <div className="flex items-center gap-3 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            Robotics Society Winter Showcase
          </p>
          <p className="text-xs text-muted-foreground">North entrance</p>
        </div>
        <Badge variant="success" className="ml-auto shrink-0">
          <IconPointFilled data-icon="inline-start" />
          Online
        </Badge>
      </div>

      <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
        <div className="signal-surface flex min-h-96 flex-col justify-between bg-signal-success p-6 text-signal-success-text sm:p-8">
          <div className="flex items-center justify-between gap-4 text-sm font-medium">
            <span>Latest scan</span>
            <span className="font-mono">19:42:18</span>
          </div>

          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <IconCircleCheck aria-hidden="true" className="size-24" />
            <div className="flex flex-col gap-2">
              <p className="text-4xl font-semibold">Checked in</p>
              <p className="text-2xl font-medium">Priya Raman</p>
              <p className="font-mono text-sm tracking-code opacity-80">
                7QM4X–K3B9T
              </p>
            </div>
          </div>

          <p className="text-sm opacity-90">
            Let them through. This ticket will not scan again.
          </p>
        </div>

        <div className="flex flex-col">
          <div className="border-b p-5 sm:p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Arrivals</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  183 of 240 registered
                </p>
              </div>
              <p className="font-mono text-2xl font-medium">76%</p>
            </div>
            <div
              className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Arrivals"
              aria-valuemin={0}
              aria-valuemax={240}
              aria-valuenow={183}
            >
              <div
                className="animate-meter-fill h-full rounded-full bg-foreground"
                style={{ width: "76.25%" }}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span>57 still expected</span>
              <span>2 doors open</span>
            </div>
          </div>

          <div className="flex flex-1 flex-col">
            <p className="px-5 py-4 text-sm font-medium sm:px-6">
              Recent scans
            </p>
            <ul className="divide-y border-y">
              {activity.map(
                ({ code, icon: Icon, label, name, time, variant }, index) => (
                  <li
                    // Only the newest row moves: one scan landing, not a
                    // staggered list reveal.
                    className={cn(
                      "flex items-center gap-3 px-5 py-3 sm:px-6",
                      index === 0 && "animate-scan-arrive",
                    )}
                    key={code}
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {code} · {time}
                      </p>
                    </div>
                    <Badge variant={variant}>{label}</Badge>
                  </li>
                ),
              )}
            </ul>
            <p className="mt-auto px-5 py-4 text-sm text-muted-foreground sm:px-6">
              Everything on this door is up to date.
            </p>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-5">
        Example event.
      </figcaption>
    </figure>
  );
}
