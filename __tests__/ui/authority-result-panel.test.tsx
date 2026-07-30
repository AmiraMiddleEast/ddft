import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AuthorityResultPanel } from "@/app/(app)/documents/[id]/review/_components/AuthorityResultPanel";
import type { AuthorityRow } from "@/lib/behoerden/resolve";

function makeAuthority(overrides: Partial<AuthorityRow> = {}): AuthorityRow {
  return {
    id: "auth-1",
    stateId: "bayern",
    regierungsbezirkId: "bayern-oberbayern",
    documentTypeId: "geburtsurkunde",
    name: "Standesamt München",
    address: "Ruppertstr. 11\n80337 München",
    phone: "+49 89 233-96010",
    email: "standesamt@muenchen.de",
    website: "https://stadt.muenchen.de/standesamt",
    officeHours: "Mo–Fr 08:00–12:00",
    notes: null,
    specialRules: null,
    needsReview: false,
    ...overrides,
  } as AuthorityRow;
}

describe("AuthorityResultPanel — matched", () => {
  it("renders name, routing breadcrumb, contact block, and no review banner", () => {
    render(
      <AuthorityResultPanel
        result={{
          status: "matched",
          authority: makeAuthority(),
          routing_path: ["Bayern", "Oberbayern", "Geburtsurkunde"],
          special_rules: null,
          needs_review: false,
        }}
        onChooseAuthority={vi.fn()}
        onAdjustInputs={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Responsible authority found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Standesamt München" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Bayern › Oberbayern › Geburtsurkunde"),
    ).toBeInTheDocument();

    // Labels
    expect(screen.getByText("Address")).toBeInTheDocument();
    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Website")).toBeInTheDocument();
    expect(screen.getByText("Office hours")).toBeInTheDocument();

    // External link has security attributes
    const link = screen.getByRole("link", {
      name: "https://stadt.muenchen.de/standesamt",
    });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    // PRÜFEN banner absent
    expect(
      screen.queryByText("Please verify these details"),
    ).not.toBeInTheDocument();
  });

  it("renders review banner when needs_review=true", () => {
    render(
      <AuthorityResultPanel
        result={{
          status: "matched",
          authority: makeAuthority(),
          routing_path: ["Hamburg", "Geburtsurkunde"],
          special_rules: null,
          needs_review: true,
        }}
        onChooseAuthority={vi.fn()}
        onAdjustInputs={vi.fn()}
      />,
    );

    expect(screen.getByText("Please verify these details")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The source record is flagged for review. Please verify before using it.",
      ),
    ).toBeInTheDocument();
  });

  it("renders special-case callout when special_rules is present", () => {
    render(
      <AuthorityResultPanel
        result={{
          status: "matched",
          authority: makeAuthority({
            specialRules: "Führungszeugnis geht direkt zur Apostille.",
          }),
          routing_path: ["Bayern", "Oberbayern", "Führungszeugnis"],
          special_rules: "Führungszeugnis geht direkt zur Apostille.",
          needs_review: false,
        }}
        onChooseAuthority={vi.fn()}
        onAdjustInputs={vi.fn()}
      />,
    );

    expect(screen.getByText("Special case")).toBeInTheDocument();
    expect(
      screen.getByText("Führungszeugnis geht direkt zur Apostille."),
    ).toBeInTheDocument();
  });

  it("renders '— not provided' placeholder for missing contact fields", () => {
    render(
      <AuthorityResultPanel
        result={{
          status: "matched",
          authority: makeAuthority({
            phone: null,
            email: null,
            website: null,
            officeHours: null,
          }),
          routing_path: ["Hamburg", "Geburtsurkunde"],
          special_rules: null,
          needs_review: false,
        }}
        onChooseAuthority={vi.fn()}
        onAdjustInputs={vi.fn()}
      />,
    );

    expect(
      screen.getAllByText("— not provided").length,
    ).toBeGreaterThanOrEqual(4);
  });
});

describe("AuthorityResultPanel — ambiguous", () => {
  it("renders candidate list and triggers onChooseAuthority on click", async () => {
    const onChoose = vi.fn();
    render(
      <AuthorityResultPanel
        result={{
          status: "ambiguous",
          candidates: [
            makeAuthority({ id: "a1", name: "Landratsamt A" }),
            makeAuthority({ id: "a2", name: "Landratsamt B" }),
          ],
          routing_path: ["Bayern", "Geburtsurkunde"],
        }}
        onChooseAuthority={onChoose}
        onAdjustInputs={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Several authorities possible" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Candidates")).toBeInTheDocument();
    expect(screen.getByText("Landratsamt A")).toBeInTheDocument();
    expect(screen.getByText("Landratsamt B")).toBeInTheDocument();

    const buttons = screen.getAllByRole("button", {
      name: "Use this authority",
    });
    expect(buttons).toHaveLength(2);

    await userEvent.click(buttons[1]);
    expect(onChoose).toHaveBeenCalledWith("a2");
  });
});

describe("AuthorityResultPanel — not_found", () => {
  it("renders destructive heading and invokes onAdjustInputs", async () => {
    const onAdjust = vi.fn();
    render(
      <AuthorityResultPanel
        result={{
          status: "not_found",
          reason: "no_authority_for_combination",
        }}
        onChooseAuthority={vi.fn()}
        onAdjustInputs={onAdjust}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "No authority found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No authority found. Please check the inputs."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Check the document type, federal state and place of issue, then try again.",
      ),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Adjust inputs" }),
    );
    expect(onAdjust).toHaveBeenCalledTimes(1);
  });
});
