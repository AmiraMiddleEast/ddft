import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/(app)/page";

// next/headers and next/navigation are not available in the test environment
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Mock auth so the session check passes
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: { id: "test-user-id", name: "Test User", email: "test@example.com" },
        session: {},
      }),
    },
  },
}));

// Mock the document query — return empty list (exercises the empty-state branch)
vi.mock("@/lib/documents/queries", () => ({
  listRecentDocumentsForUser: vi.fn().mockResolvedValue([]),
}));

describe("HomePage — UI-SPEC Copywriting Contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Übersicht heading and upload CTA verbatim", async () => {
    const Page = await HomePage();
    render(Page);

    expect(
      screen.getByRole("heading", { name: "Übersicht" })
    ).toBeInTheDocument();

    // Upload CTA button (appears in the top bar)
    expect(screen.getAllByText("Dokumente hochladen").length).toBeGreaterThan(0);

    // Section heading for the recent-documents list
    expect(
      screen.getByRole("heading", { name: "Zuletzt hochgeladen" })
    ).toBeInTheDocument();
  });
});
