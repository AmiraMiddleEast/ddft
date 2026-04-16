import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/(app)/page";

describe("HomePage — UI-SPEC Copywriting Contract", () => {
  it("renders Willkommen heading and subtext verbatim", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { name: "Willkommen" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Die Dokumentenverarbeitung steht in der nächsten Version zur Verfügung."
      )
    ).toBeInTheDocument();
  });
});
