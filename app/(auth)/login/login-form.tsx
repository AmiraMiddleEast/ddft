"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { loginSchema } from "@/lib/validations/auth";
import { toast } from "sonner";

export function LoginForm() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side validation
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError("E-Mail oder Passwort ungültig.");
      emailRef.current?.focus();
      return;
    }

    setPending(true);
    const { error: signInError } = await authClient.signIn.email({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setPending(false);

    if (signInError) {
      if (signInError.status === 429) {
        setError("Zu viele Anmeldeversuche. Bitte warten Sie eine Minute.");
      } else if (signInError.status === 401 || signInError.status === 400) {
        setError("E-Mail oder Passwort ungültig.");
      } else {
        toast.error("Anmeldung fehlgeschlagen. Bitte erneut versuchen.");
      }
      emailRef.current?.focus();
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-semibold">
          E-Mail
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="name@beispiel.de"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          ref={emailRef}
          required
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-semibold">
          Passwort
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={pending}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="w-full"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <svg
              className="mr-2 h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                className="opacity-25"
              />
              <path
                d="M4 12a8 8 0 018-8"
                stroke="currentColor"
                strokeWidth="4"
                className="opacity-75"
              />
            </svg>
            Anmelden…
          </>
        ) : (
          "Anmelden"
        )}
      </Button>
    </form>
  );
}
