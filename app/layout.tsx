import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SFG Secondary | Your New Landing Page",
  description: "Secondary landing page for SFG with new instructions and positioning.",
  keywords: "secondary, landing, page, sfg, new, instructions",
  openGraph: {
    title: "SFG Secondary | Your New Landing Page",
    description: "Secondary landing page for SFG with new instructions and positioning.",
    url: "https://sfg-secondary.vercel.app",
    siteName: "SFG Secondary",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SFG Secondary | Your New Landing Page",
    description: "Secondary landing page for SFG with new instructions and positioning.",
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

