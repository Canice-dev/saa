import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sales Assistant | Business workspace",
  description: "A private customer messaging and order workspace for your business.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NG" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
