"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { sendMagicLink, requestAdminAccess } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [showAdminOption, setShowAdminOption] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await sendMagicLink(email);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Check your email for a sign-in link.");
      }
    });
  }

  function handleAdminRequest() {
    startTransition(async () => {
      const result = await requestAdminAccess(email);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Check your email to finish verifying admin access.");
      }
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-6">
      <div className="ambient-glow" aria-hidden />
      <div className="animate-fade-up flex flex-col items-center gap-1">
        <span className="font-heading text-5xl leading-none text-primary [text-shadow:0_0_24px_var(--primary)]">
          TOPG
        </span>
        <span className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Good Lines, Better People
        </span>
      </div>
      <Card
        className="stagger-in w-full max-w-sm"
        style={{ "--stagger": "150ms" } as React.CSSProperties}
      >
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Sending..." : "Send magic link"}
            </Button>
          </form>

          {showAdminOption ? (
            <div className="animate-fade-up mt-4 flex flex-col gap-2 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                League admins only — verifies the same email above.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={handleAdminRequest}
              >
                Request admin access
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAdminOption(true)}
              className="mt-4 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Admin? Request access instead
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
