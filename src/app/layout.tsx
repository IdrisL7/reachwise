import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono, Syne } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/providers";
import { CookieConsent } from "@/components/cookie-consent";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const syne = Syne({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-syne",
});

export const metadata: Metadata = {
  title: "GetSignalHooks — Signal-backed outbound from real company signals",
  description:
    "Find real company signals, generate buyer-aware messages, review drafts, and run signal-backed outbound workflow with evidence attached.",
  metadataBase: new URL("https://www.getsignalhooks.com"),
  openGraph: {
    title: "GetSignalHooks — Signal-backed outbound from real company signals",
    description:
      "Find real company signals, generate better messages, review drafts, and run outbound workflow with evidence attached.",
    url: "https://www.getsignalhooks.com",
    siteName: "GetSignalHooks",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "GetSignalHooks — Signal-backed outbound from real company signals",
    description:
      "Signal-backed outbound workflow for modern sales teams. Free plan available with optional Pro upgrade.",
  },
  alternates: {
    canonical: "https://www.getsignalhooks.com",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${plusJakartaSans.variable} ${geistMono.variable} ${syne.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <CookieConsent />
        <Analytics />
      </body>
    </html>
  );
}
