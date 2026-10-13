import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Midlex Realty Administration",
  description: "Secure management portal for Midlex Realty Marketplace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#fffdf7]">
        {children}
      </body>
    </html>
  );
}
