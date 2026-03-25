// UI redesign pass
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "../components/AppShell";

export const metadata: Metadata = {
  title: "Student Command Center",
  description:
    "An AI-powered student assistant that turns messy school life into clear, personalized support.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
