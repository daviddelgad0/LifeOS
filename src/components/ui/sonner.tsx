"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      // Sonner's own internal stacking/height measurement for toasts beyond
      // the front one is unreliable in this version — two toasts firing
      // together (e.g. "+XP" and an achievement unlock on finishing your
      // first workout) can leave a second toast rendered with a wildly
      // oversized height, showing as a large empty dark box over the page.
      // Capping to 1 visible toast keeps the rest queued (opacity: 0, not
      // rendered visibly) until the front one dismisses, avoiding that path
      // entirely — this is a common real scenario, not an edge case.
      visibleToasts={1}
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
