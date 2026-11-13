import type { Metadata } from "next";
import "./globals.css";
import { Manrope } from "next/font/google";
import { cn } from "@/lib/utils";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "Sales Assistant | Business workspace",
  description: "A private customer messaging and order workspace for your business.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NG" data-scroll-behavior="smooth" className={cn("h-full antialiased", "font-sans", manrope.variable)}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
