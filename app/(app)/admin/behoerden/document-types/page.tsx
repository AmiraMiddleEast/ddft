import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listDocumentTypesAdmin } from "@/lib/admin/queries";

import { DocumentTypesClient } from "./DocumentTypesClient";

export const metadata = { title: "Dokumentenarten — Angela" };

export default async function DocumentTypesAdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const docTypes = await listDocumentTypesAdmin();

  return (
    <main className="mx-auto w-full max-w-[800px] px-6 pt-8 pb-16">
      <nav className="mb-2 text-sm text-muted-foreground">
        <Link href="/admin/behoerden" className="underline-offset-2 hover:underline">
          Behörden
        </Link>
        {" / "}
        <span aria-current="page">Dokumentenarten</span>
      </nav>

      <section className="mb-6">
        <h1 className="text-2xl font-semibold leading-tight">Dokumentenarten</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Alle Dokumententypen verwalten. Anzeigenamen können bearbeitet, neue
          Typen hinzugefügt werden.
        </p>
      </section>

      <DocumentTypesClient initialDocTypes={docTypes} />
    </main>
  );
}
