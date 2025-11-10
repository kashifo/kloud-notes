import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kloud Notes - Secure Cloud Notepad",
  description: "Create and share secure notes instantly. No login required. Optional password protection. Built with Next.js and Supabase.",
  keywords: ["notepad", "notes", "cloud", "secure", "password-protected", "share"],
  authors: [{ name: "Kloud Notes" }],
  openGraph: {
    title: "Kloud Notes - Secure Cloud Notepad",
    description: "Create and share secure notes instantly",
    type: "website",
  },
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
