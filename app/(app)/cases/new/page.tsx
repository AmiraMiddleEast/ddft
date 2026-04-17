import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

import { CreateCaseForm } from "./CreateCaseForm";

export const metadata = { title: "Neuen Fall anlegen — Angela" };

export default async function CreateCasePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-[560px] px-6 pt-8">
      <nav className="mb-2 text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-2 hover:underline">
          Übersicht
        </Link>
        {" / "}
        <Link href="/cases" className="underline-offset-2 hover:underline">
          Fälle
        </Link>
        {" / "}
        <span aria-current="page">Neuer Fall</span>
      </nav>

      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold leading-tight">
          Neuen Fall anlegen
        </h1>
        <p className="text-base text-muted-foreground">
          Geben Sie die Person an, auf die sich die Laufliste bezieht.
        </p>
      </header>

      <Card>
        <CardContent>
          <CreateCaseForm />
        </CardContent>
      </Card>
    </main>
  );
}
