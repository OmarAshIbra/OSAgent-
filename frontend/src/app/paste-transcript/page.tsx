"use client";

import { useState } from "react";
import { ProcessingResult } from "../lib/types";
import TranscriptPaste from "../../components/TranscriptPaste";
import ResultDisplay from "../../components/ResultDisplay";
import { Shield } from "lucide-react";
import Link from "next/link";
import { ModeToggle } from "../../components/mode-toggle";

export default function PasteTranscriptPage() {
  const [result, setResult] = useState<ProcessingResult | null>(null);

  const handleComplete = (res: ProcessingResult) => {
    setResult(res);
  };

  const reset = () => {
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
        {!result ? (
          <div className="animate-in fade-in duration-500">
            <TranscriptPaste
              onComplete={handleComplete}
              onCancel={() => (window.location.href = "/")}
            />
          </div>
        ) : (
          <ResultDisplay
            result={result}
            onReset={reset}
            onUpdateResult={setResult}
          />
        )}
      </main>

      {/* Modern Footer */}
      <footer className="border-t py-12 bg-muted/20">
        <div className="container mx-auto px-4 text-center space-y-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.2em]">
            Beta version for internal testing only — not intended for release
          </p>
        </div>
      </footer>
    </div>
  );
}
