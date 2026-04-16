import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("shadcn Button", () => {
  it("renders children", () => {
    render(<Button>Anmelden</Button>);
    expect(screen.getByRole("button", { name: "Anmelden" })).toBeInTheDocument();
  });
});
