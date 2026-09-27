import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border px-4 py-3 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      // Outcome variants sit on their family's subtle surface rather than on
      // plain card stock, so a status is legible as a region and not only as
      // coloured text. Descriptions inherit the family text colour at reduced
      // weight instead of falling back to muted-foreground, which would drop
      // contrast against a tinted surface.
      variant: {
        default: "bg-card text-card-foreground",
        success:
          "border-success-border bg-success-subtle text-success-text *:data-[slot=alert-description]:text-success-text/90",
        warning:
          "border-warning-border bg-warning-subtle text-warning-text *:data-[slot=alert-description]:text-warning-text/90",
        destructive:
          "border-destructive-border bg-destructive-subtle text-destructive-text *:data-[slot=alert-description]:text-destructive-text/90",
        info: "border-info-border bg-info-subtle text-info-text *:data-[slot=alert-description]:text-info-text/90",
        provisional:
          "border-provisional-border bg-provisional-subtle text-provisional-text *:data-[slot=alert-description]:text-provisional-text/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2.5 right-3", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
