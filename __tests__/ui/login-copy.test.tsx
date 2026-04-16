import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginForm } from "@/app/(auth)/login/login-form";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Mock auth-client to avoid real API calls
vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { email: vi.fn() } },
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("LoginForm — UI-SPEC Copywriting Contract", () => {
  it("renders German labels and CTA", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("E-Mail")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("name@beispiel.de")).toBeInTheDocument();
    expect(screen.getByLabelText("Passwort")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Anmelden" })
    ).toBeInTheDocument();
  });

  it("does NOT render deferred affordances", () => {
    render(<LoginForm />);
    expect(screen.queryByText(/registrieren/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/passwort vergessen/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/remember me/i)).not.toBeInTheDocument();
  });
});
