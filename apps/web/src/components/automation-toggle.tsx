"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";

type AutomationToggleProps = {
  initialValue: boolean | null;
};

export function AutomationToggle({ initialValue }: AutomationToggleProps) {
  const [enabled, setEnabled] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function updateAutomation(nextValue: boolean) {
    if (enabled === null || isSaving) return;
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/settings/automation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextValue }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Could not update automatic replies.");
        return;
      }

      setEnabled(nextValue);
      router.refresh();
    } catch {
      setError("Connection failed. Automatic replies were not changed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="automation-control">
      <div className="automation-control-row">
        <span className="automation-control-label" aria-hidden="true">
          {enabled === null ? "—" : enabled ? "On" : "Off"}
        </span>
        <Switch
          checked={enabled ?? false}
          onCheckedChange={(checked) => void updateAutomation(checked)}
          disabled={enabled === null || isSaving}
          aria-label={enabled ? "Turn off automatic replies" : "Turn on automatic replies"}
        />
      </div>
      {error ? (
        <span className="automation-control-error" role="alert">{error}</span>
      ) : enabled === null ? (
        <span className="automation-control-note">Could not load setting</span>
      ) : isSaving ? (
        <span className="automation-control-note" role="status">Saving…</span>
      ) : null}
    </div>
  );
}
