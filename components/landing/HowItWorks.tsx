"use client";
import { MoveRight, Sparkles, Check, Terminal, Globe } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";

// Mockup Components for each step
const Step1Mockup = () => (
  <div className="w-full h-full p-4 flex flex-col gap-3">
    <div className="text-xs text-black/60 mb-1">Prompt</div>
    <div className="bg-white border-2 border-black rounded-lg p-3 h-24 relative overflow-hidden group shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex gap-2 items-center mb-2">
        <div className="w-2 h-2 rounded-full bg-red-400" />
        <div className="w-2 h-2 rounded-full bg-yellow-400" />
        <div className="w-2 h-2 rounded-full bg-green-400" />
      </div>
      <p className="text-xs text-[#354230] font-mono font-medium">
        Build a Soroban staking contract with rewards...
      </p>
      <div className="absolute bottom-2 right-2">
        <div className="bg-[#354230]/10 p-1.5 rounded-md">
          <MoveRight className="w-3 h-3 text-[#354230]" />
        </div>
      </div>
    </div>
  </div>
);

const Step2Mockup = () => (
  <div className="w-full h-full p-4 flex flex-col gap-2">
    <div className="flex items-center justify-between border-b border-black/5 pb-2">
      <div className="flex items-center gap-2 text-xs text-neutral-600">
        <Terminal className="w-3 h-3 text-neutral-500" />
        <span>contract.rs</span>
      </div>
      <div className="flex gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-black/10" />
        <div className="w-1.5 h-1.5 rounded-full bg-black/10" />
      </div>
    </div>
    <div className="space-y-1.5 font-mono text-[10px] text-neutral-600">
      <div className="flex gap-2">
        <span className="text-purple-700 font-bold">pub fn</span>
        <span className="text-yellow-700 font-bold">init</span>(e: Env) {"{"}
      </div>
      <div className="pl-4 text-neutral-400 italic">// Initializing...</div>
      <div className="pl-4 flex gap-2">
        <span className="text-blue-700">let</span>
        <span className="text-black font-medium">token</span> = ...
      </div>
      <div className="pl-4 text-green-700 font-medium">Ok(token)</div>
      <div>{"}"}</div>
    </div>
  </div>
);

const Step3Mockup = () => (
  <div className="w-full h-full p-4 flex flex-col justify-center gap-3">
    <div className="bg-white border-2 border-black rounded-lg p-3 flex items-center gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="bg-green-500 p-1.5 rounded-full">
        <Check className="w-3 h-3 text-white" />
      </div>
      <div>
        <div className="text-xs font-bold text-green-800">Deployment Success</div>
        <div className="text-[10px] text-green-700/70">Network: Futurenet</div>
      </div>
    </div>
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <Globe className="w-3 h-3" />
        <span>Explorer Link</span>
      </div>
      <div className="text-[10px] text-blue-600 underline font-medium">View hash</div>
    </div>
  </div>
);

const steps = [
  {
    Mockup: Step1Mockup,
    title: "Describe Your Intent",
    description: "Tell Stacy what you want to build. From simple tokens to complex DeFi protocols.",
    step: "STEP 1"
  },
  {
    Mockup: Step2Mockup,
    title: "AI Generates Code",
    description: "Our agent writes production-ready Soroban contracts and frontend bindings in seconds.",
    step: "STEP 2"
  },
  {
    Mockup: Step3Mockup,
    title: "Deploy to Stellar",
    description: "One-click deployment to Testnet or Mainnet with automated verification checks.",
    step: "STEP 3"
  },
];

export function HowItWorks() {
  const ref = useRef(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 80%", "center center"],
  });

  // Card 1 (Left)
  const x1 = useTransform(scrollYProgress, [0, 1], ["105%", "0%"]);
  const r1 = useTransform(scrollYProgress, [0, 1], [-12, 0]);

  // Card 2 (Center)
  const y2 = useTransform(scrollYProgress, [0, 1], [40, 0]);
  const s2 = useTransform(scrollYProgress, [0, 1], [0.9, 1]);

  // Card 3 (Right)
  const x3 = useTransform(scrollYProgress, [0, 1], ["-105%", "0%"]);
  const r3 = useTransform(scrollYProgress, [0, 1], [12, 0]);

  return (
    <section ref={ref} className="w-full py-32 px-6 bg-[#fbe1b1] overflow-hidden">
      <div className="max-w-[90%] mx-auto">
        <h2 className="text-6xl md:text-7xl font-bold mb-24 tracking-tighter text-black uppercase text-center tracking-tight">
          How It Works
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative px-4 min-h-[500px] md:min-h-0">
          {steps.map((step, i) => {
            let style = {};
            if (isDesktop) {
              if (i === 0) style = { x: x1, rotate: r1, zIndex: 1 };
              if (i === 1) style = { y: y2, scale: s2, zIndex: 10 };
              if (i === 2) style = { x: x3, rotate: r3, zIndex: 1 };
            }

            return (
              <motion.div
                key={i}
                style={style}
                className="group relative flex flex-col p-4 rounded-[40px] bg-[#FF9644] border-[3px] border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all duration-500 h-full max-w-sm mx-auto md:max-w-none w-full"
              >
                {/* Number Badge */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-[#CCFF00] border-[3px] border-black flex items-center justify-center z-20 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-colors">
                  <span className="text-black font-mono font-black text-xl">0{i + 1}</span>
                  <div className="absolute -top-1 -right-1 text-black">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L15 9L24 12L15 15L12 24L9 15L0 12L9 9L12 0Z" /></svg>
                  </div>
                </div>

                {/* Glow Effect */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-[#D98E28]/20 blur-[10px] rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />

                {/* UI Mockup Area */}
                <div className="h-64 w-full bg-[#FFCE99] rounded-[24px] overflow-hidden relative border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  {/* Subtle Gradient in Mockup BG */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent opacity-30" />
                  <step.Mockup />
                </div>

                {/* Content Area */}
                <div className="pt-8 pb-4 flex flex-col flex-1">
                  <h3 className="text-2xl font-black mb-3 text-black tracking-tight">{step.title}</h3>
                  <p className="text-sm text-[#1A1A1A]/90 leading-relaxed font-bold">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}