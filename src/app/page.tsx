import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero-section";
import { HowItWorksSection } from "@/components/how-it-works-section";
import { DemoSection } from "@/components/demo-section";
import { FollowUpEngineSection } from "@/components/followup-engine-section";
import { PricingSection } from "@/components/pricing-section";
import { WhoItsForSection } from "@/components/who-its-for-section";
import { TrustBlock } from "@/components/trust-block";
import { WaitlistCTA } from "@/components/waitlist-cta";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#080808] text-zinc-100 font-[family-name:var(--font-geist-sans)]">
      <Navbar />
      <HeroSection />
      <HowItWorksSection />
      <DemoSection />
      <TrustBlock />
      <FollowUpEngineSection />
      <PricingSection />
      <WhoItsForSection />
      <WaitlistCTA />
      <Footer />
    </div>
  );
}
