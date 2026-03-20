import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero-section";
import { HowItWorksSection } from "@/components/how-it-works-section";
import { DemoSection } from "@/components/demo-section";
import { SocialProofSection } from "@/components/social-proof-section";
import { TestimonialsSection } from "@/components/testimonials-section";
import { FollowUpEngineSection } from "@/components/followup-engine-section";
import { PricingSection } from "@/components/pricing-section";
import { WaitlistCTA } from "@/components/waitlist-cta";
import { Footer } from "@/components/footer";
import { SalesChatWidget } from "@/components/sales-chat-widget";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://www.getsignalhooks.com",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "GetSignalHooks",
  url: "https://www.getsignalhooks.com",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Generate signal-backed opening lines anchored on real company signals. Signal-backed outbound, follow-up automation, and CRM integrations for modern sales teams.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "GBP",
    description: "7-day free trial",
  },
  publisher: {
    "@type": "Organization",
    name: "GetSignalHooks",
    url: "https://www.getsignalhooks.com",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main id="main-content" className="min-h-screen bg-[#0a0a0b] text-zinc-100 font-[family-name:var(--font-body)]">
        <HeroSection />
        <HowItWorksSection />
        <DemoSection />
        <TestimonialsSection />
        <SocialProofSection />
        <FollowUpEngineSection />
        <PricingSection />
        <WaitlistCTA />
      </main>
      <Footer />
      <SalesChatWidget />
    </>
  );
}
