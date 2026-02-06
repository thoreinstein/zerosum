import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zerosum - Personal Zero Sum Budgeting",
  description: "A personal zero sum based budgeting app built with Next.js, TypeScript, Firebase, and GenKit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
