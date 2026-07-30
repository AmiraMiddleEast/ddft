import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

import { CreateCaseForm } from "./CreateCaseForm";

export const metadata = { title: "Create new case — DDFT" };

export default async function CreateCasePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-[560px] px-6 pt-8">
      <nav className="mb-2 text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-2 hover:underline">
          Overview
        </Link>
        {" / "}
        <Link href="/cases" className="underline-offset-2 hover:underline">
          Cases
        </Link>
        {" / "}
        <span aria-current="page">New case</span>
      </nav>

      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold leading-tight">
          Create new case
        </h1>
        <p className="text-base text-muted-foreground">
          Specify the person this Laufliste refers to.
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
