import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // rounded-full is permitted here: a badge is a status chip, one of the three
  // shapes exempt from the radius scale.
  //
  // The base reserves the border width only. `border-transparent` in the base
  // outranked every variant's `border-*` on emit order rather than on the class
  // list, which quietly erased the hairline that gives each outcome family its
  // edge against a subtle surface — the one place in the product where colour is
  // load-bearing. Border colour is a variant decision now.
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "border-transparent hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
        // Outcome families. Each pairs a subtle surface with its accessible text
        // and border, so a status reads the same wherever it appears. Always
        // pair these with an icon or label — color is never the only signal.
        success:
          "border-success-border bg-success-subtle text-success-text",
        warning:
          "border-warning-border bg-warning-subtle text-warning-text",
        destructive:
          "border-destructive-border bg-destructive-subtle text-destructive-text focus-visible:ring-destructive/25",
        info: "border-info-border bg-info-subtle text-info-text",
        // A provisional acceptance is a qualified yes, never a shade of success.
        provisional:
          "border-provisional-border bg-provisional-subtle text-provisional-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
