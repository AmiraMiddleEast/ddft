import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});


// Toaster will be enabled in Task 2 after shadcn sonner is added.
// import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Angela",
  description: "Dokumentenlegalisation — interne Anwendung",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={cn("font-sans", geist.variable)}>
      <body className="antialiased">
        {children}
        {/* <Toaster richColors position="top-right" /> */}
      </body>
    </html>
  );
}
