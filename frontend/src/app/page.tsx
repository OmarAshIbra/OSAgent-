"use client";

import React, { useState } from "react";
import ModeSelector from "../components/ModeSelector";
import AudioCapture from "../components/AudioCapture";
import TranscriptPaste from "../components/TranscriptPaste";
import ResultDisplay from "../components/ResultDisplay";
import { ProcessingResult } from "./lib/types";
import { v4 as uuidv4 } from "uuid";
import { Shield } from "lucide-react";
import Link from "next/link";
import { ModeToggle } from "../components/mode-toggle";

export default function Home() {
  const [mode, setMode] = useState<
    "idle" | "audio" | "transcript" | "complete"
  >("idle");
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [sessionId] = useState(() => uuidv4());

  const handleComplete = (res: ProcessingResult) => {
    setResult(res);
    setMode("complete");
  };

  const reset = () => {
    setMode("idle");
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      {/* Premium Header */}
      <header className="border-b bg-card/30 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-bold text-xl">OSAgent</span>
          </Link>

          <div className="flex items-center gap-4">
            <ModeToggle />
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-widest bg-muted px-3 py-1 rounded-full border border-border">
              <Shield size={12} className="text-green-500" />
              Zero-Storage Pipeline
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 md:py-24">
        {mode === "idle" && (
          <div className="space-y-12 max-w-4xl mx-auto text-center">
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-1000">
              <h1 className="text-4xl md:text-7xl font-black tracking-tighter leading-[1.1]">
                Meetings summarized. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-sky-500">
                  Zero data left behind.
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
                The privacy-first AI assistant for real-time duplex audio
                capture and instant insight delivery.
              </p>
            </div>
            <ModeSelector onSelect={setMode} />
          </div>
        )}

        {mode === "audio" && (
          <div className="animate-in fade-in duration-500">
            <AudioCapture
              sessionId={sessionId}
              onComplete={handleComplete}
              onCancel={reset}
            />
          </div>
        )}

        {mode === "transcript" && (
          <div className="animate-in fade-in duration-500">
            <TranscriptPaste onComplete={handleComplete} onCancel={reset} />
          </div>
        )}

        {mode === "complete" && result && (
          <ResultDisplay result={result} onReset={reset} />
        )}
      </main>

      {/* Modern Footer */}
      <footer className="border-t py-12 bg-muted/20">
        <div className="container mx-auto px-4 text-center space-y-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.2em]">
            Built by Safwan & Omar
          </p>
          <div className="flex justify-center gap-4 text-[10px] text-muted-foreground font-bold">
            <span>WHISPER-1</span>
            <span>GPT-4O</span>
            <span>SENDGRID</span>
            <span>TAILWIND 4</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
