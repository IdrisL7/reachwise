import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/providers";
import { CookieConsent } from "@/components/cookie-consent";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GetSignalHooks — Evidence-first hooks from any company URL",
  description:
    "Generate research-backed outbound sales hooks anchored on real public signals. AI-powered hook generation, follow-up automation, and CRM integrations for modern sales teams.",
  metadataBase: new URL("https://www.getsignalhooks.com"),
  openGraph: {
    title: "GetSignalHooks — Evidence-first hooks from any company URL",
    description:
      "Generate research-backed outbound sales hooks anchored on real public signals. Stop guessing, start sending messages worth reading.",
    url: "https://www.getsignalhooks.com",
    siteName: "GetSignalHooks",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "GetSignalHooks — Evidence-first hooks from any company URL",
    description:
      "AI-powered hook generation anchored on real public signals. 7-day free trial.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <CookieConsent />
        <Analytics />
      </body>
    </html>
  );
}
