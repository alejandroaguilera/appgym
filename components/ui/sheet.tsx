"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

// Bottom sheet, not a blocking "¿estás seguro?" modal — spec §8 forbids
// interrupting execution with confirmation dialogs, but a dismissable sheet
// for secondary actions (molestia, sustituir ejercicio, cierre de sesión)
// is the sanctioned pattern. Slides from the bottom (spatial consistency —
// it enters and exits from the edge it's anchored to), ease-out entrance,
// snappier exit (emil-design-eng skill). Radix's Presence waits for these
// CSS transitions to finish before unmounting, so both directions animate.
function Sheet({ open, onOpenChange, title, children, className }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 bg-black/60 z-40 transition-opacity duration-200",
            "data-[state=open]:ease-[var(--ease-out)] data-[state=open]:opacity-100",
            "data-[state=closed]:duration-150 data-[state=closed]:opacity-0"
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-5 pb-8 focus:outline-none",
            "transition-transform duration-250 ease-[var(--ease-out)]",
            "data-[state=open]:translate-y-0",
            "data-[state=closed]:translate-y-full data-[state=closed]:duration-200",
            className
          )}
        >
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
          <Dialog.Title className="mb-4 text-lg font-semibold">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { Sheet };
