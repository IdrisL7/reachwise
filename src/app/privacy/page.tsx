import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — GetSignalHooks",
  alternates: {
    canonical: "https://www.getsignalhooks.com/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-300">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          &larr; Back to home
        </Link>

        <h1 className="mt-8 text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: 4 March 2025</p>

        <div className="mt-10 space-y-8 text-[0.9375rem] leading-[1.8]">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Who we are</h2>
            <p>
              GetSignalHooks (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the website at{" "}
              <strong className="text-zinc-200">www.getsignalhooks.com</strong>. We provide
              AI-powered sales hook generation and follow-up automation tools.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Information we collect</h2>
            <p className="mb-3">We collect information you provide directly:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Account details (name, email, password)</li>
              <li>Billing information (processed securely by Stripe — we never store card details)</li>
              <li>Leads and contacts you upload or create</li>
              <li>Company URLs you submit for hook generation</li>
              <li>Usage data (hooks generated, emails sent, feature usage)</li>
            </ul>
            <p className="mt-3">We automatically collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Log data (IP address, browser type, pages visited)</li>
              <li>Cookies for authentication and session management</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. How we use your information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide and improve our services</li>
              <li>To process payments and manage your subscription</li>
              <li>To send transactional emails (password resets, billing receipts)</li>
              <li>To generate hooks and follow-up emails using AI</li>
              <li>To enforce usage limits and prevent abuse</li>
              <li>To respond to support requests</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Third-party services</h2>
            <p>We share data with these processors as necessary to deliver our service:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-zinc-200">Stripe</strong> — payment processing</li>
              <li><strong className="text-zinc-200">SendGrid (Twilio)</strong> — email delivery</li>
              <li><strong className="text-zinc-200">Anthropic</strong> — AI hook and email generation</li>
              <li><strong className="text-zinc-200">Brave Search</strong> — company research</li>
              <li><strong className="text-zinc-200">Turso</strong> — database hosting</li>
              <li><strong className="text-zinc-200">Vercel</strong> — application hosting</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Data retention</h2>
            <p>
              We retain your account data for as long as your account is active. If you delete your
              account, we will remove your personal data within 30 days, except where we need to
              retain it for legal obligations or legitimate business purposes (e.g., billing records).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Your rights</h2>
            <p className="mb-3">Under applicable data protection laws, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict processing</li>
              <li>Data portability</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, contact us at{" "}
              <a href="mailto:privacy@getsignalhooks.com" className="text-emerald-400 hover:underline">
                privacy@getsignalhooks.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Security</h2>
            <p>
              We implement industry-standard security measures including encrypted data in transit
              (TLS), hashed passwords (bcrypt), hashed API keys (SHA-256), and secure session management.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. We will notify registered users of material
              changes via email.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Contact</h2>
            <p>
              Questions about this policy? Email us at{" "}
              <a href="mailto:privacy@getsignalhooks.com" className="text-emerald-400 hover:underline">
                privacy@getsignalhooks.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
