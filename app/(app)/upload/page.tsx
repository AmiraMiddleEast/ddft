import { UploadClient } from "./_components/UploadClient";

export const metadata = {
  title: "Dokumente hochladen — Angela",
};

export default function UploadPage() {
  return (
    <main className="mx-auto w-full max-w-[720px] px-6 pt-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold leading-tight">
          Dokumente hochladen
        </h1>
        <p className="mt-2 text-base leading-normal text-muted-foreground">
          PDF-Dateien per Drag-and-Drop oder über den Button auswählen. Maximal
          25 Dateien, je 10 MB.
        </p>
      </header>
      <UploadClient />
    </main>
  );
}
