import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Top G Sportsbook</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Scaffold is up. Auth, lines, and bet slip pages come next — see{" "}
          <code className="rounded bg-muted px-1 py-0.5">CLAUDE.md</code> for
          the build order.
        </CardContent>
      </Card>
    </div>
  );
}
