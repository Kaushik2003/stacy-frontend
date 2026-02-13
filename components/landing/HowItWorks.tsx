import { Code2, Cpu, Rocket } from "lucide-react";

const steps = [
  {
    icon: Code2,
    title: "Describe Your Intent",
    description:
      "Tell our AI what you want to build. Smart contracts, frontends, or complete dApps.",
  },
  {
    icon: Cpu,
    title: "AI Generates Code",
    description:
      "Our agent writes production-ready Soroban contracts and React frontends in seconds.",
  },
  {
    icon: Rocket,
    title: "Deploy to Stellar",
    description:
      "One-click deployment to Stellar testnet or mainnet with automatic verification.",
  },
];

export function HowItWorks() {
  return (
    <section className="w-full max-w-4xl mx-auto mt-20">
      <h2 className="text-lg font-medium text-center mb-8 text-muted-foreground">
        How It Works
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step, i) => (
          <div
            key={i}
            className="group p-6 rounded-xl border border-ide-border bg-ide-panel/30 hover:bg-ide-panel/50 transition-all duration-300 hover:border-primary/30"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <step.icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-sm font-medium mb-2">{step.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}