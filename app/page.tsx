import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Top G Sportsbook</CardTitle>
          <Badge variant="secondary">{profile?.role ?? "user"}</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
          <p>Signed in as {profile?.display_name ?? user.email}.</p>
          <p>Lines, bet slip, and My Bets come next.</p>
          {profile?.role === "admin" && (
            <Link
              href="/admin/lines"
              className={buttonVariants({ variant: "outline" })}
            >
              Lines Builder
            </Link>
          )}
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}
