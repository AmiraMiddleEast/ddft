import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Anmelden — Angela",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-[360px] bg-muted">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-semibold leading-tight">
            Anmelden
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground leading-normal">
            Bitte melden Sie sich mit Ihrem Konto an.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
