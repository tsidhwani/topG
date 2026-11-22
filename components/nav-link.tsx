"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-2.5 py-1 text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-primary/15 text-primary shadow-[0_0_12px_-4px_var(--primary)]"
          : "text-muted-foreground hover:scale-105 hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
