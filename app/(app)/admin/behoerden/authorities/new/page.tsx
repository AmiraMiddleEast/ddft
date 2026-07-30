import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import {
  listDocumentTypesAdmin,
  listRegierungsbezirkeAdmin,
  listStatesAdmin,
} from "@/lib/admin/queries";

import { NewAuthorityForm } from "./NewAuthorityForm";

export const metadata = { title: "New authority — DDFT" };

export default async function NewAuthorityPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [states, docTypes, regierungsbezirke] = await Promise.all([
    listStatesAdmin(),
    listDocumentTypesAdmin(),
    listRegierungsbezirkeAdmin(),
  ]);

  return (
    <main className="mx-auto w-full max-w-[800px] px-6 pt-8 pb-16">
      <nav className="mb-2 text-sm text-muted-foreground">
        <Link
          href="/admin/behoerden/authorities"
          className="underline-offset-2 hover:underline"
        >
          Edit authorities
        </Link>
        {" / "}
        <span aria-current="page">New authority</span>
      </nav>

      <section className="mb-6">
        <h1 className="text-2xl font-semibold leading-tight">New authority</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Add an additional certification office for a federal state and
          eine Dokumentenart an.
        </p>
      </section>

      <NewAuthorityForm
        states={states}
        docTypes={docTypes.map((d) => ({ id: d.id, displayName: d.displayName }))}
        regierungsbezirke={regierungsbezirke}
      />
    </main>
  );
}
