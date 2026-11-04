import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Profile Builder",
  description: "Build your travel profile through conversation.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
