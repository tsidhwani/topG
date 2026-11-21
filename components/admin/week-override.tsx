"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateWeekOverride } from "@/lib/actions/league-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WeekOverride({
  currentWeek,
  override,
}: {
  currentWeek: number;
  override: number | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(override ?? currentWeek));
  const [isPending, startTransition] = useTransition();

  function handleSet() {
    const week = Number(value);
    if (!Number.isInteger(week) || week <= 0) {
      toast.error("Enter a valid week number.");
      return;
    }
    startTransition(async () => {
      await updateWeekOverride(week);
      toast.success(`Week overridden to ${week}.`);
      router.refresh();
    });
  }

  function handleClear() {
    startTransition(async () => {
      await updateWeekOverride(null);
      setValue(String(currentWeek));
      toast.success("Override cleared — back to ESPN's week.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-20"
      />
      <Button type="button" size="sm" onClick={handleSet} disabled={isPending}>
        Override
      </Button>
      {override != null && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleClear}
          disabled={isPending}
        >
          Clear override
        </Button>
      )}
    </div>
  );
}
