"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
// import { Button } from "@/components/ui/button";

import { LiquidMetalButton } from "@/components/liquid-metal-button";
import { useChatContext } from "@/contexts/ChatContext";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

const examplePrompts = [
  "Create a staking contract with 7-day lockup period",
  "Build a token swap interface for XLM to USDC",
  "Generate a voting DAO with proposal system",
];

export function IntentBox() {


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
    <div className="relative w-full max-w-3xl mx-auto">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-2xl blur-xl opacity-30" />
      <div className="relative rounded-2xl overflow-hidden backdrop-blur-sm bg-[#7d5656]/45 border border-white/10 shadow-2xl ring-1 ring-white/5">


        {/* Textarea */}
        <div className="p-4 relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Build a Soroban staking contract with automated rewards distribution..."
            className="w-full h-32 bg-transparent border-none outline-none resize-none text-foreground placeholder:text-white/95 placeholder:opacity-90 placeholder:font-medium text-sm leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
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
                className="text-xs text-white/70 hover:text-white px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
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