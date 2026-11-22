import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/sign-out-button";
import { NavLink } from "@/components/nav-link";
import { PageTransition } from "@/components/page-transition";

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
      <div className="ambient-glow" aria-hidden />
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-primary/30 bg-background/95 px-4 py-2.5 shadow-[0_1px_20px_-4px_var(--primary)] backdrop-blur">
        <div className="flex items-center gap-4 overflow-x-auto">
          <Link
            href="/"
            className="group flex shrink-0 items-baseline gap-1.5 transition-transform duration-200 active:scale-95"
          >
            <span className="font-heading text-2xl leading-none text-primary transition-[text-shadow] duration-300 [text-shadow:0_0_14px_var(--primary)] group-hover:[text-shadow:0_0_22px_var(--primary)]">
              TOPG
            </span>
            <span className="hidden text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase sm:inline">
              Sportsbook
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink href="/">Board</NavLink>
            <NavLink href="/my-bets">My Bets</NavLink>
            <NavLink href="/league">League</NavLink>
            {profile.role === "admin" && (
              <>
                <NavLink href="/admin/lines-studio">Lines Studio</NavLink>
                <NavLink href="/admin/grade-settle">Grade &amp; Settle</NavLink>
                <NavLink href="/admin/settings">Settings</NavLink>
              </>
            )}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Badge
            variant={profile.role === "admin" ? "default" : "secondary"}
            className="uppercase transition-all"
          >
            {profile.role}
          </Badge>
          <SignOutButton />
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <PageTransition>{children}</PageTransition>
      </main>
      <footer className="border-t border-border px-4 py-3 text-center text-[0.65rem] tracking-[0.25em] text-muted-foreground/60 uppercase">
        Good Lines, Better People
      </footer>
    </div>
  );
}
