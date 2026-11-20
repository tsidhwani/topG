import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentProfile();

  if (!current) {
    redirect("/login");
  }

  const { profile } = current;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <nav className="flex items-center gap-4">
          <Link href="/" className="font-semibold">
            Top G Sportsbook
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            This Week
          </Link>
          <Link
            href="/my-bets"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            My Bets
          </Link>
          {profile.role === "admin" && (
            <Link
              href="/admin/lines"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Admin
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{profile.role}</Badge>
          <SignOutButton />
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
