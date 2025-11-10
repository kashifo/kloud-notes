import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";

export const metadata: Metadata = {
  title: "Kloud Notes - Secure Cloud Notepad",
  description: "Save & Share your notes on the cloud from anywhere without login",
  keywords: ["notepad", "notes", "cloud", "secure", "password-protected", "share"],
  authors: [{ name: "Kloud Notes" }],
  openGraph: {
    title: "Kloud Notes - Secure Cloud Notepad",
    description: "Save & Share your notes on the cloud from anywhere without login",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
