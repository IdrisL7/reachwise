import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up — GetSignalHooks",
  description:
    "Create your GetSignalHooks account. Start generating evidence-backed outbound hooks with receipts — 3 free generations, no credit card required.",
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
