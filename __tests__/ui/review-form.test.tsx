import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ReviewForm } from "@/app/(app)/documents/[id]/review/_components/ReviewForm";

// Server Actions — must be mocked (they import next/headers etc.)
const approveAndResolveMock = vi.fn();
const chooseAmbiguousAuthorityMock = vi.fn();

vi.mock("@/lib/review/actions", () => ({
  approveAndResolve: (...args: unknown[]) =>
    approveAndResolveMock(...(args as [])),
  chooseAmbiguousAuthority: (...args: unknown[]) =>
    chooseAmbiguousAuthorityMock(...(args as [])),
}));

// Sonner is client-side only; neutralize it in tests.
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const original = {
  dokumenten_typ: { value: "Geburtsurkunde", confidence: "high" as const },
  ausstellende_behoerde: {
    value: "Standesamt München",
    confidence: "medium" as const,
  },
  ausstellungsort: { value: "München", confidence: "high" as const },
  bundesland: { value: "Bayern", confidence: "high" as const },
  ausstellungsdatum: { value: "2020-01-15", confidence: "low" as const },
  voller_name: { value: "Max Mustermann", confidence: "high" as const },
};

const documentTypes = [
  { id: "geburtsurkunde", displayName: "Geburtsurkunde" },
  { id: "approbationsurkunde", displayName: "Approbationsurkunde" },
];
const states = [
  { id: "bayern", name: "Bayern" },
  { id: "berlin", name: "Berlin" },
];

describe("ReviewForm — UI-SPEC Copywriting Contract", () => {
  beforeEach(() => {
    approveAndResolveMock.mockReset();
    chooseAmbiguousAuthorityMock.mockReset();
  });

  it("renders all 6 German field labels and both CTAs", () => {
    render(
      <ReviewForm
        documentId="doc-1"
        original={original}
        documentTypes={documentTypes}
        states={states}
      />,
    );

    // German labels from UI-SPEC
    expect(screen.getByText("Dokumenttyp")).toBeInTheDocument();
    expect(screen.getByText("Ausstellende Behörde")).toBeInTheDocument();
    expect(screen.getByText("Ausstellungsort")).toBeInTheDocument();
    expect(screen.getByText("Bundesland")).toBeInTheDocument();
    expect(screen.getByText("Ausstellungsdatum")).toBeInTheDocument();
    expect(screen.getByText("Voller Name")).toBeInTheDocument();

    // CTAs
    expect(
      screen.getByRole("button", { name: "Speichern & Behörde ermitteln" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verwerfen" })).toBeInTheDocument();
  });

  it("disables 'Verwerfen' when no field has been edited", () => {
    render(
      <ReviewForm
        documentId="doc-1"
        original={original}
        documentTypes={documentTypes}
        states={states}
      />,
    );

    const discard = screen.getByRole("button", { name: "Verwerfen" });
    expect(discard).toBeDisabled();
  });

  it("shows 'Ursprünglich: …' caption and enables Verwerfen when a field is edited", async () => {
    render(
      <ReviewForm
        documentId="doc-1"
        original={original}
        documentTypes={documentTypes}
        states={states}
      />,
    );

    const ort = screen.getByLabelText("Ausstellungsort") as HTMLInputElement;
    fireEvent.change(ort, { target: { value: "Nürnberg" } });

    expect(
      screen.getByText("Ursprünglich: München"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verwerfen" })).not.toBeDisabled();
  });

  it("calls approveAndResolve with corrected values and renders matched panel on success", async () => {
    approveAndResolveMock.mockResolvedValue({
      ok: true,
      data: {
        status: "matched",
        authority: {
          id: "auth-1",
          stateId: "bayern",
          regierungsbezirkId: "bayern-oberbayern",
          documentTypeId: "geburtsurkunde",
          name: "Standesamt München",
          address: "Ruppertstr. 11\n80337 München",
          phone: "+49 89 233-96010",
          email: "standesamt@muenchen.de",
          website: "https://stadt.muenchen.de/rathaus/standesamt.html",
          officeHours: "Mo–Fr 08:00–12:00",
          notes: null,
          specialRules: null,
          needsReview: false,
        },
        routing_path: ["Bayern", "Oberbayern", "Geburtsurkunde"],
        special_rules: null,
        needs_review: false,
      },
    });

    const user = userEvent.setup();
    render(
      <ReviewForm
        documentId="doc-1"
        original={original}
        documentTypes={documentTypes}
        states={states}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Speichern & Behörde ermitteln" }),
    );

    await waitFor(() => {
      expect(approveAndResolveMock).toHaveBeenCalledTimes(1);
    });
    const arg = approveAndResolveMock.mock.calls[0][0];
    expect(arg.documentId).toBe("doc-1");
    expect(arg.corrected.dokumenten_typ).toBe("Geburtsurkunde");
    expect(arg.corrected.bundesland).toBe("Bayern");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Zuständige Behörde ermittelt" }),
      ).toBeInTheDocument();
    });
  });

  it("opens the discard confirmation dialog with UI-SPEC copy", async () => {
    const user = userEvent.setup();
    render(
      <ReviewForm
        documentId="doc-1"
        original={original}
        documentTypes={documentTypes}
        states={states}
      />,
    );

    // Make a field dirty to enable Verwerfen
    fireEvent.change(screen.getByLabelText("Ausstellungsort"), {
      target: { value: "Nürnberg" },
    });

    await user.click(screen.getByRole("button", { name: "Verwerfen" }));

    expect(
      screen.getByRole("alertdialog", { name: "Änderungen verwerfen?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Ihre Anpassungen an den extrahierten Daten werden entfernt.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Verwerfen" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Abbrechen" }),
    ).toBeInTheDocument();
  });
});
