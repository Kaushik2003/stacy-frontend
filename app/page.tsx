import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { IntentBox } from "@/components/landing/IntentBox";
import { HowItWorks } from "@/components/landing/HowItWorks";

export default function LandingPage() {
  return (
    <main className="flex flex-col w-full min-h-screen bg-black text-white">
      <Navbar />

      {/* 1. Hero Section (Video + Chat) */}
      <div className="relative z-10 flex flex-col items-center w-full min-h-screen px-6 pt-[10vh] pb-20 overflow-hidden">
        <Hero />
        <IntentBox />
      </div>

      {/* 2. How It Works Section (Theme Background) */}
      <div className="relative z-10 w-full px-6 py-24 bg-[#030014] border-t border-white/5 overflow-hidden">

        {/* Deep space gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black pointer-events-none" />

        {/* Additional accent blobs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[128px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px] pointer-events-none" />

        <HowItWorks />
      </div>
    </main>
  );
}