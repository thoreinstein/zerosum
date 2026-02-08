import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { FinanceProvider } from "@/context/FinanceContext";
import { ThemeProvider } from "@/context/ThemeContext";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={`${inter.className} antialiased`}>
        <AuthProvider>
          <ThemeProvider>
            <FinanceProvider>
              {children}
            </FinanceProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
