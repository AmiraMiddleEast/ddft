import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b border-border bg-muted flex items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold">
            Angela
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/cases"
              className="font-medium text-muted-foreground hover:text-foreground"
            >
              Fälle
            </Link>
            <Link
              href="/upload"
              className="font-medium text-muted-foreground hover:text-foreground"
            >
              Hochladen
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold">{session.user.email}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
