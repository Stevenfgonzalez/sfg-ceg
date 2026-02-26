import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CEG | Community Emergency Guide",
  description: "Pre-plan your household, check in safe, look up a loved one. No account needed.",
  keywords: "emergency, check-in, evacuation, community, safety, reunification",
  openGraph: {
    title: "CEG | Community Emergency Guide",
    description: "Pre-plan your household, check in safe, look up a loved one. No account needed.",
    url: "https://ceg.sfg.ac",
    siteName: "CEG",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CEG | Community Emergency Guide",
    description: "Pre-plan your household, check in safe, look up a loved one. No account needed.",
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

