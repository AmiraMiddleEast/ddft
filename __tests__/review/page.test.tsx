/**
 * Integration test for app/(app)/documents/[id]/review/page.tsx.
 *
 * The review page is an async Server Component. We exercise its four
 * data-loading and branching outcomes by:
 *   - mocking next/navigation so redirect() / notFound() throw identifiable
 *     errors we can assert on
 *   - mocking @/lib/auth so session state is swappable per-test
 *   - mocking @/lib/documents/queries and @/lib/behoerden/queries so the page
 *     can "fetch" without touching a real DB
 *   - mocking the PdfPreview client component (its iframe has no role in this
 *     test) so we can assert its testid in the happy-path render
 *
 * The rendered JSX is materialised via a small shim: `const jsx = await Page(...)`
 * then `render(jsx)` — this avoids pulling in next-test-utils while still
 * exercising every non-trivial branch.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// -- next/navigation: redirect/notFound throw identifiable errors.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

// -- next/headers: no Next request context in node/happy-dom.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

// -- auth session holder, swap per test.
const sessionHolder: {
  current:
    | null
    | { user: { id: string; email: string }; session: { id: string } };
} = { current: null };

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => sessionHolder.current),
    },
  },
}));

// -- DB queries: swap per test.
type DocRow = {
  id: string;
  userId: string;
  filename: string;
  uploadedAt: Date;
  extractionStatus: "pending" | "extracting" | "done" | "error";
} | null;

const queriesHolder: {
  doc: DocRow;
  extractions: Array<{
    fieldName: string;
    fieldValue: string | null;
    confidence: "high" | "medium" | "low";
    reasoning: string | null;
  }>;
} = {
  doc: null,
  extractions: [],
};

vi.mock("@/lib/documents/queries", () => ({
  getDocumentForUser: vi.fn(async () => queriesHolder.doc),
  getExtractionsForDocument: vi.fn(async () => queriesHolder.extractions),
}));

// -- Behörden dropdown loaders.
vi.mock("@/lib/behoerden/queries", () => ({
  listDocumentTypes: vi.fn(async () => [
    { id: "geburtsurkunde", displayName: "Geburtsurkunde" },
    { id: "approbationsurkunde", displayName: "Approbationsurkunde" },
  ]),
  listStates: vi.fn(async () => [
    { id: "bayern", name: "Bayern" },
    { id: "berlin", name: "Berlin" },
  ]),
}));

// -- PdfPreview: the iframe + /api/documents/[id]/pdf route are out of scope.
vi.mock(
  "@/app/(app)/documents/[id]/_components/PdfPreview",
  () => ({
    PdfPreview: ({ id }: { id: string }) => (
      <div data-testid="pdf-preview" data-docid={id} />
    ),
  }),
);
// Also stub the relative import used from inside the review page.
vi.mock("../../app/(app)/documents/[id]/_components/PdfPreview", () => ({
  PdfPreview: ({ id }: { id: string }) => (
    <div data-testid="pdf-preview" data-docid={id} />
  ),
}));

// Server-only marker is a no-op in tests.
vi.mock("server-only", () => ({}));

// Import the Server Component AFTER all mocks are registered.
// Using dynamic import so mocks apply deterministically.
async function importPage() {
  const mod = await import(
    "@/app/(app)/documents/[id]/review/page"
  );
  return mod.default as (props: {
    params: Promise<{ id: string }>;
  }) => Promise<React.ReactElement>;
}

beforeEach(() => {
  sessionHolder.current = null;
  queriesHolder.doc = null;
  queriesHolder.extractions = [];
});

describe("ReviewPage — Server Component branching", () => {
  it("redirects to /sign-in when session is null", async () => {
    const Page = await importPage();
    await expect(
      Page({ params: Promise.resolve({ id: "doc1" }) }),
    ).rejects.toThrow("REDIRECT:/sign-in");
  });

  it("calls notFound() when the document does not belong to the caller", async () => {
    sessionHolder.current = {
      user: { id: "u-a", email: "a@x.de" },
      session: { id: "s-a" },
    };
    // DB returns null — ownership query found nothing for this user.
    queriesHolder.doc = null;

    const Page = await importPage();
    await expect(
      Page({ params: Promise.resolve({ id: "doc1" }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("redirects to /documents/[id] when extractionStatus is not 'done'", async () => {
    sessionHolder.current = {
      user: { id: "u-a", email: "a@x.de" },
      session: { id: "s-a" },
    };
    queriesHolder.doc = {
      id: "doc1",
      userId: "u-a",
      filename: "transcript.pdf",
      uploadedAt: new Date("2026-04-01T10:00:00Z"),
      extractionStatus: "pending",
    };

    const Page = await importPage();
    await expect(
      Page({ params: Promise.resolve({ id: "doc1" }) }),
    ).rejects.toThrow("REDIRECT:/documents/doc1");
  });

  it("renders breadcrumb + heading + PdfPreview + form section for a done, owned document", async () => {
    sessionHolder.current = {
      user: { id: "u-a", email: "a@x.de" },
      session: { id: "s-a" },
    };
    queriesHolder.doc = {
      id: "doc1",
      userId: "u-a",
      filename: "transcript.pdf",
      uploadedAt: new Date("2026-04-01T10:00:00Z"),
      extractionStatus: "done",
    };
    queriesHolder.extractions = [
      {
        fieldName: "dokumenten_typ",
        fieldValue: "Geburtsurkunde",
        confidence: "high",
        reasoning: "title",
      },
      {
        fieldName: "bundesland",
        fieldValue: "Bayern",
        confidence: "medium",
        reasoning: "inferred",
      },
    ];

    const Page = await importPage();
    const jsx = await Page({ params: Promise.resolve({ id: "doc1" }) });
    render(jsx);

    // Breadcrumb — Übersicht / Dokument / Überprüfung
    expect(screen.getByText("Übersicht")).toBeInTheDocument();
    expect(screen.getByText("Dokument")).toBeInTheDocument();
    // "Überprüfung" appears in both breadcrumb and <h1>; assert >= 1.
    expect(screen.getAllByText("Überprüfung").length).toBeGreaterThanOrEqual(1);

    // Main heading
    const h1 = screen.getByRole("heading", { level: 1, name: "Überprüfung" });
    expect(h1).toBeInTheDocument();

    // PDF preview testid (via mocked component)
    expect(screen.getByTestId("pdf-preview")).toBeInTheDocument();

    // Form section heading
    expect(
      screen.getByRole("heading", { level: 2, name: "Extrahierte Daten" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Originaldokument" }),
    ).toBeInTheDocument();

    // Field labels from UI-SPEC
    expect(screen.getByText("Dokumenttyp")).toBeInTheDocument();
    expect(screen.getByText("Bundesland")).toBeInTheDocument();
  });
});
