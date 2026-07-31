import {
  IconCircleCheck,
  IconCloudUpload,
  IconCopyCheck,
  IconDeviceMobile,
  IconPointFilled,
  IconQrcode,
  IconUsers,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";

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
    label: "Provisional",
    variant: "provisional" as const,
    icon: IconCloudUpload,
  },
  {
    name: "Maya Singh",
    code: "5TC9B–H7X3E",
    time: "19:41:28",
    label: "Duplicate",
    variant: "warning" as const,
    icon: IconCopyCheck,
  },
];

export function OperationsPreview() {
  return (
    <figure className="overflow-hidden rounded-xl border bg-card text-card-foreground">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <IconQrcode aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              Robotics Society Winter Showcase
            </p>
            <p className="text-xs text-muted-foreground">North entrance</p>
          </div>
        </div>
        <Badge variant="success" className="ml-auto">
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
              <p className="text-4xl font-semibold tracking-tight">
                Checked in
              </p>
              <p className="text-2xl font-medium">Priya Raman</p>
              <p className="font-mono text-sm tracking-wider opacity-80">
                7QM4X–K3B9T
              </p>
            </div>
          </div>

          <p className="text-sm leading-6 opacity-90">
            Admission recorded. This ticket cannot be used again while the
            check-in is active.
          </p>
        </div>

        <div className="flex flex-col">
          <div className="border-b p-5 sm:p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Arrival progress</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  183 of 240 registered attendees
                </p>
              </div>
              <p className="font-mono text-2xl font-medium">76%</p>
            </div>
            <div
              className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Arrival progress"
              aria-valuemin={0}
              aria-valuemax={240}
              aria-valuenow={183}
            >
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: "76.25%" }}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <IconUsers aria-hidden="true" className="size-4" />
                57 expected
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IconDeviceMobile aria-hidden="true" className="size-4" />
                2 door devices
              </span>
            </div>
          </div>

          <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
              <p className="text-sm font-medium">Recent activity</p>
              <p className="text-xs text-muted-foreground">Sample data</p>
            </div>
            <ul className="divide-y border-y">
              {activity.map(
                ({ code, icon: Icon, label, name, time, variant }) => (
                  <li
                    className="flex items-center gap-3 px-5 py-3 sm:px-6"
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
            <div className="mt-auto flex items-center gap-2 px-5 py-4 text-xs text-muted-foreground sm:px-6">
              <IconCloudUpload aria-hidden="true" className="size-4" />
              All admission records synchronized
            </div>
          </div>
        </div>
      </div>

      <figcaption className="border-t bg-muted/30 px-4 py-3 text-xs text-muted-foreground sm:px-5">
        A representative organizer view using EventPass admission states and
        synthetic data.
      </figcaption>
    </figure>
  );
}
