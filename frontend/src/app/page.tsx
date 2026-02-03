"use client";

import { Shield } from "lucide-react";
import Link from "next/link";
import { ModeToggle } from "../components/mode-toggle";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Mic, FileText } from "lucide-react";

export default function Home() {
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
        <div className="space-y-12 max-w-4xl mx-auto text-center">
          <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-1000">
            <h1 className="text-4xl md:text-7xl font-black tracking-tighter leading-[1.1]">
              Meetings summarized. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-sky-500">
                Zero data left behind.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
              The privacy-first AI assistant for real-time duplex audio capture
              and instant insight delivery.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-8 justify-center items-center py-12 px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Link href="/record-meeting" className="w-full max-w-[350px]">
              <Card className="cursor-pointer hover:border-primary/50 transition-all hover:scale-105 group h-full">
                <CardHeader className="text-center">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Mic className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle>Record Meeting</CardTitle>
                  <CardDescription>
                    Capture live mic and system audio for instant transcription.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center text-sm text-muted-foreground italic">
                  Best for Zoom, Google Meet, or physical meetings.
                </CardContent>
              </Card>
            </Link>

            <Link href="/paste-transcript" className="w-full max-w-[350px]">
              <Card className="cursor-pointer hover:border-primary/50 transition-all hover:scale-105 group h-full">
                <CardHeader className="text-center">
                  <div className="mx-auto w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-secondary/20 transition-colors">
                    <FileText className="w-8 h-8 text-secondary-foreground" />
                  </div>
                  <CardTitle>Paste Transcript</CardTitle>
                  <CardDescription>
                    Already have a transcript? Skip the audio and analyze
                    directly.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center text-sm text-muted-foreground italic">
                  Supports .txt, .md, and direct text paste.
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
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
