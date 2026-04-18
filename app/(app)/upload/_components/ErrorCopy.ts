import type { UploadErrorCode } from "@/lib/uploads/errors";

export const ERROR_COPY: Record<UploadErrorCode | "not_found", string> = {
  unauthenticated: "Analyse fehlgeschlagen. Bitte erneut versuchen.",
  file_too_large: "Datei ist größer als 10 MB.",
  invalid_pdf: "Datei ist kein gültiges PDF.",
  encrypted_pdf: "PDF ist passwortgeschützt und kann nicht analysiert werden.",
  batch_limit: "Maximal 25 Dateien gleichzeitig.",
  rate_limited: "Zu viele Anfragen. Bitte in einer Minute erneut versuchen.",
  unknown: "Analyse fehlgeschlagen. Bitte erneut versuchen.",
  not_found: "Dokument konnte nicht analysiert werden.",
};
