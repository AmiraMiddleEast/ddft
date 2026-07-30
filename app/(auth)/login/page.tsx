import type { Metadata } from "next";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in — DDFT",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <Image
        src="/ddft-logo.png"
        alt="Dubai Docs Fast Track"
        width={64}
        height={64}
        style={{ height: 64, width: "auto" }}
        className="mb-6"
        priority
      />
      <Card className="w-full max-w-[360px] bg-muted">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-semibold leading-tight">
            Sign in
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground leading-normal">
            Sign in with your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
