import { IntentBox } from "@/components/landing/IntentBox";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Hexagon } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="relative w-full min-h-screen">
      <img
        src="/strad.gif"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />

      <div className="relative flex-1 flex flex-col items-center justify-start px-6 pt-[15vh] pb-20 z-10">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="relative">
              
              <div className="absolute inset-0 flex items-center justify-center">
                
              </div>
            </div>
          </div>
          <h1 className="text-[5.5rem] md:text-[6.8rem] lg:text-[8.5rem] font-extrabold tracking-tight leading-tight mb-4 bg-clip-text text-transparent relative">
            <span className="relative inline-block bg-gradient-to-r from-white/90 via-primary/80 to-white/70 bg-clip-text text-transparent">
              Stacy
              <span className="absolute -inset-1 bg-gradient-to-r from-white/60 via-transparent to-white/40 opacity-30 blur-xl pointer-events-none animate-pulse" aria-hidden="true" />
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Build and deploy Soroban smart contracts and frontend with AI-powered assistance.
          </p>
        </div>

        {/* Intent Box */}
        <IntentBox />

        {/* How It Works */}
        <HowItWorks />
      </div>
    </div>
  );
}