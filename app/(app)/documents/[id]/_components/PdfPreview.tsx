export function PdfPreview({ id, filename }: { id: string; filename: string }) {
  const src = `/api/documents/${id}/pdf`;
  return (
    <div className="min-h-[480px] w-full">
      <iframe
        src={src}
        title={`Vorschau: ${filename}`}
        className="h-full min-h-[480px] w-full"
      >
        <p className="text-base">
          Dokument kann nicht angezeigt werden.{" "}
          <a href={src} className="underline">
            Als PDF öffnen
          </a>
        </p>
      </iframe>
    </div>
  );
}
