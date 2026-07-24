import { UploadClient } from "./_components/UploadClient";

export const metadata = {
  title: "Upload documents — DDFT",
};

export default function UploadPage() {
  return (
    <main className="mx-auto w-full max-w-[720px] px-6 pt-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold leading-tight">
          Upload documents
        </h1>
        <p className="mt-2 text-base leading-normal text-muted-foreground">
          Drag and drop PDF files, or pick them with the button. Up to 25
          files, 10 MB each.
        </p>
      </header>
      <UploadClient />
    </main>
  );
}
