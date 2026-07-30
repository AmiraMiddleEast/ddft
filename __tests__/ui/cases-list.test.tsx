import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import CasesListPage from "@/app/(app)/cases/page";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
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

// listCasesForUser is called directly; mock the module.
vi.mock("@/lib/cases/queries", () => ({
  listCasesForUser: vi.fn(),
}));

// Any `db.select()...groupBy()` count query needs a chain mock.
vi.mock("@/db/client", () => {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.groupBy = vi.fn().mockResolvedValue([]);
  return { db: chain };
});

import { listCasesForUser } from "@/lib/cases/queries";

describe("CasesListPage — UI-SPEC Copywriting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state with exact German copy", async () => {
    vi.mocked(listCasesForUser).mockResolvedValueOnce([]);
    const Page = await CasesListPage();
    render(Page);

    expect(
      screen.getByRole("heading", { name: "Cases", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Cases group one person's documents into a single Laufliste.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("No cases yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Create a case to group documents for one person together.",
      ),
    ).toBeInTheDocument();
    // Two "Create new case" links are expected (header CTA + empty-state CTA).
    expect(screen.getAllByText("Create new case").length).toBeGreaterThan(0);
  });

  it("renders cases table with person + status + Öffnen action", async () => {
    vi.mocked(listCasesForUser).mockResolvedValueOnce([
      {
        id: "case-1",
        userId: "user-1",
        personName: "Dr. Sandra Hertel",
        personBirthdate: null, beruf: null, wohnsitzBundesland: null, arbeitsortBundesland: null, nrwSubregion: null,
        notes: null,
        status: "open",
        createdAt: new Date("2026-04-10T10:00:00Z"),
        updatedAt: new Date("2026-04-15T10:00:00Z"),
      },
    ]);

    const Page = await CasesListPage();
    render(Page);

    expect(screen.getByText("Dr. Sandra Hertel")).toBeInTheDocument();
    // Status badge — open → "In Bearbeitung".
    expect(screen.getByText("In Bearbeitung")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    // Column headers.
    expect(
      screen.getByRole("columnheader", { name: "Person" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Status" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Updated" }),
    ).toBeInTheDocument();
  });
});
