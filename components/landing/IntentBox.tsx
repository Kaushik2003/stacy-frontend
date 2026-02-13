"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
// import { Button } from "@/components/ui/button";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { LiquidMetalButton } from "@/components/liquid-metal-button";
import { useChatContext } from "@/contexts/ChatContext";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

const examplePrompts = [
  "Create a staking contract with 7-day lockup period",
  "Build a token swap interface for XLM to USDC",
  "Generate a voting DAO with proposal system",
];

export function IntentBox() {

  const [mode, setMode] = useState<string>("Agent");
  const [prompt, setPrompt] = useState("");
  const { setPendingPrompt } = useChatContext();
  const router = useRouter();

  // Speech recognition
  const {
    isListening,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    continuous: false,
    interimResults: true,
    onTranscript: (transcript) => {
      // Append transcript to current prompt
      setPrompt((prev) => prev ? `${prev} ${transcript}` : transcript);
    },
    onError: (error) => {
      console.error('Speech recognition error:', error);
    }
  });

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleGenerate = () => {
    // Set the pending prompt - ChatPanel will pick this up and trigger the API call
    if (prompt.trim()) {
      setPendingPrompt({
        content: prompt.trim(),
        timestamp: Date.now(),
      });
    }
    // Navigate to generate page
    router.push("/generate");
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 via-primary/5 to-primary/20 rounded-2xl blur-xl opacity-75" />
      <div className="relative rounded-2xl overflow-hidden backdrop-blur-lg bg-white/8 border border-white/20 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
            <span></span>
          </div>
          <SegmentedToggle
            options={["Agent", "Manual"]}
            value={mode}
            onChange={setMode}
            size="sm"
          />
        </div>

        {/* Textarea */}
        <div className="p-4 relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Build a Soroban staking contract with automated rewards distribution..."
            className="w-full h-32 bg-transparent border-none outline-none resize-none text-foreground placeholder:text-white/95 placeholder:opacity-90 placeholder:font-medium text-sm leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleGenerate();
              }
            }}
          />
          {/* Microphone button */}
          {isSpeechSupported && (
            <button
              type="button"
              onClick={toggleListening}
              className={cn(
                "absolute top-6 right-6 p-2 rounded-full transition-all",
                isListening
                  ? "bg-red-500/20 text-red-500 animate-pulse"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              )}
              title={isListening ? "Stop recording" : "Start voice input"}
            >
              {isListening ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/10 bg-white/4">
          <div className="flex flex-wrap gap-2">
            {examplePrompts.map((example, i) => (
              <button
                key={i}
                onClick={() => setPrompt(example)}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-secondary transition-colors"
              >
                {example.slice(0, 30)}...
              </button>
            ))}
          </div>
          <LiquidMetalButton onClick={handleGenerate} />
        </div>
      </div>
    </div>
  );
}