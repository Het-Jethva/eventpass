"use client";

import { useState } from "react";
import { IconAlertTriangle, IconCheck, IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";

interface AdminActionDialogProps {
  title: string;
  description: string;
  actionLabel: string;
  isDestructive?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function AdminActionDialog({
  title,
  description,
  actionLabel,
  isDestructive = false,
  isOpen,
  onClose,
  onConfirm,
}: AdminActionDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("An explicit reason is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(trimmed);
      setReason("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-labelledby="admin-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-lg rounded-xl border bg-background p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            {isDestructive ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <IconAlertTriangle className="h-5 w-5" />
              </div>
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <IconCheck className="h-5 w-5" />
              </div>
            )}
            <div>
              <h2 id="admin-dialog-title" className="text-lg font-semibold tracking-tight">
                {title}
              </h2>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="admin-reason-input" className="text-xs font-medium text-foreground">
              Explicit Reason <span className="text-destructive">*</span>
            </label>
            <textarea
              id="admin-reason-input"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder="State the explicit operational or support reason..."
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
              required
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={isDestructive ? "destructive" : "default"}
              disabled={isSubmitting || !reason.trim()}
            >
              {isSubmitting ? "Processing..." : actionLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
