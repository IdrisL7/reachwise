import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log In — GetSignalHooks",
  description:
    "Sign in to your GetSignalHooks account to generate evidence-backed hooks, manage sequences, and run outbound with guardrails.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
