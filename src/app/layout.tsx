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
  title: "GetSignalHooks — Signal-backed opening lines from any company URL",
  description:
    "Generate personalised opening lines anchored on real company signals. Signal-backed outbound, follow-up automation, and CRM integrations for modern sales teams.",
  metadataBase: new URL("https://www.getsignalhooks.com"),
  openGraph: {
    title: "GetSignalHooks — Signal-backed opening lines from any company URL",
    description:
      "Generate personalised opening lines anchored on real company signals. Stop guessing, start sending messages worth reading.",
    url: "https://www.getsignalhooks.com",
    siteName: "GetSignalHooks",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "GetSignalHooks — Signal-backed opening lines from any company URL",
    description:
      "Signal-backed opening lines anchored on real company signals. 7-day free trial.",
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
