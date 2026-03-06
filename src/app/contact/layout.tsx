import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us — GetSignalHooks",
  description:
    "Get in touch with the GetSignalHooks team. Questions about evidence-backed outbound, pricing, or integrations — we're here to help.",
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
