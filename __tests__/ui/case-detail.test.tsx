import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import CaseDetailPage from "@/app/(app)/cases/[id]/page";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: { id: "user-1", name: "Test", email: "test@example.com" },
        session: {},
      }),
    },
  },
}));

vi.mock("@/db/client", () => ({ db: {} }));

vi.mock("@/lib/cases/queries", () => ({
  getCaseForUser: vi.fn(),
  listCaseDocuments: vi.fn(),
  listAssignableDocuments: vi.fn(),
}));

vi.mock("@/lib/laufliste/queries", () => ({
  listLauflistenForCase: vi.fn(),
}));

// The detail page imports CaseDetailClient, which imports generateLauflisteAction
// from lib/laufliste/actions.ts; that module in turn imports server-only via
// build-input. Mock the whole action module so Vite does not try to load
// the server-only chain under happy-dom.
vi.mock("@/lib/laufliste/actions", () => ({
  generateLauflisteAction: vi.fn(),
}));

// The cases actions module imports server-only transitively via drizzle
// server pieces — mock too.
vi.mock("@/lib/cases/actions", () => ({
  createCaseAction: vi.fn(),
  addDocumentsToCaseAction: vi.fn(),
  removeDocumentFromCaseAction: vi.fn(),
  reorderCaseDocumentsAction: vi.fn(),
}));

import {
  getCaseForUser,
  listCaseDocuments,
  listAssignableDocuments,
} from "@/lib/cases/queries";
import { listLauflistenForCase } from "@/lib/laufliste/queries";

describe("CaseDetailPage — UI-SPEC Copywriting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty-case blocker banner and disables the generate CTA", async () => {
    vi.mocked(getCaseForUser).mockResolvedValueOnce({
      id: "case-1",
      userId: "user-1",
      personName: "Max Mustermann",
      personBirthdate: null,
      notes: null,
      status: "open",
      createdAt: new Date("2026-04-10T10:00:00Z"),
      updatedAt: new Date("2026-04-15T10:00:00Z"),
    });
    vi.mocked(listCaseDocuments).mockResolvedValueOnce([]);
    vi.mocked(listAssignableDocuments).mockResolvedValueOnce([]);
    vi.mocked(listLauflistenForCase).mockResolvedValueOnce([]);

    const Page = await CaseDetailPage({
      params: Promise.resolve({ id: "case-1" }),
    });
    render(Page);

    // Heading is the person name.
    expect(
      screen.getByRole("heading", { name: "Max Mustermann", level: 1 }),
    ).toBeInTheDocument();

    // Blocker banner copy verbatim.
    expect(
      screen.getByText("Bitte mindestens ein Dokument hinzufügen."),
    ).toBeInTheDocument();

    // Section headings.
    expect(
      screen.getByRole("heading", { name: "Dokumente", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Laufliste", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Historie", level: 2 }),
    ).toBeInTheDocument();

    // Generate CTA exists and is disabled (empty case).
    const generateBtn = screen.getByRole("button", {
      name: /Laufliste generieren/,
    });
    expect(generateBtn).toBeDisabled();

    // Historie empty state.
    expect(
      screen.getByText("Noch keine früheren Lauflisten vorhanden."),
    ).toBeInTheDocument();

    // Person meta shows empty placeholders for birthdate + notes.
    expect(screen.getAllByText("— nicht hinterlegt").length).toBe(2);
  });

  it("renders unreviewed-docs banner when at least one doc is not approved", async () => {
    vi.mocked(getCaseForUser).mockResolvedValueOnce({
      id: "case-2",
      userId: "user-1",
      personName: "Erika Example",
      personBirthdate: "1985-06-15",
      notes: "Eilfall",
      status: "open",
      createdAt: new Date("2026-04-10T10:00:00Z"),
      updatedAt: new Date("2026-04-15T10:00:00Z"),
    });
    vi.mocked(listCaseDocuments).mockResolvedValueOnce([
      {
        caseDocumentId: "cd-1",
        caseId: "case-2",
        documentId: "doc-1",
        position: 1,
        addedAt: new Date("2026-04-12T08:00:00Z"),
        filename: "geburtsurkunde.pdf",
        extractionStatus: "done",
        reviewStatus: "pending",
        uploadedAt: new Date("2026-04-11T08:00:00Z"),
        lookupStatus: null,
        resolvedAuthorityId: null,
      },
    ]);
    vi.mocked(listAssignableDocuments).mockResolvedValueOnce([]);
    vi.mocked(listLauflistenForCase).mockResolvedValueOnce([]);

    const Page = await CaseDetailPage({
      params: Promise.resolve({ id: "case-2" }),
    });
    render(Page);

    expect(
      screen.getByText(
        "Mindestens ein Dokument ist noch nicht geprüft.",
      ),
    ).toBeInTheDocument();

    // Document row visible with unreviewed badge.
    expect(screen.getByText("geburtsurkunde.pdf")).toBeInTheDocument();
    expect(screen.getByText("Noch nicht geprüft")).toBeInTheDocument();

    // Notes visible.
    expect(screen.getByText("Eilfall")).toBeInTheDocument();

    // Generate disabled because of unreviewed doc.
    const generateBtn = screen.getByRole("button", {
      name: /Laufliste generieren/,
    });
    expect(generateBtn).toBeDisabled();
  });
});
