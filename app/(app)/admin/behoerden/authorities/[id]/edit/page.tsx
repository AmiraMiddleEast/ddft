import Link from "next/link";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { getAuthorityByIdAdmin } from "@/lib/admin/queries";

import { EditAuthorityForm } from "./EditAuthorityForm";

export const metadata = { title: "Behörde bearbeiten — Angela" };

export default async function EditAuthorityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const authority = await getAuthorityByIdAdmin(id);
  if (!authority) notFound();

  return (
    <main className="mx-auto w-full max-w-[760px] px-6 pt-8 pb-16">
      <nav className="mb-2 text-sm text-muted-foreground">
        <Link href="/admin/behoerden" className="underline-offset-2 hover:underline">
          Behörden
        </Link>
        {" / "}
        <Link
          href="/admin/behoerden/authorities"
          className="underline-offset-2 hover:underline"
        >
          Behörden bearbeiten
        </Link>
        {" / "}
        <span aria-current="page">{authority.name}</span>
      </nav>

      <section className="mb-6">
        <h1 className="text-2xl font-semibold leading-tight">
          Behörde bearbeiten
        </h1>
        <p className="mt-1 text-base text-muted-foreground">{authority.name}</p>
      </section>

      <EditAuthorityForm authority={authority} />
    </main>
  );
}
