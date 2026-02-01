"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { Mic, FileText } from "lucide-react";

interface ModeSelectorProps {
  onSelect: (mode: "audio" | "transcript") => void;
}

export default function ModeSelector({ onSelect }: ModeSelectorProps) {
  return (
    <div className="flex flex-col md:flex-row gap-8 justify-center items-center py-12 px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Card
        className="w-full max-w-[350px] cursor-pointer hover:border-primary/50 transition-all hover:scale-105 group"
        onClick={() => onSelect("audio")}
      >
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

      <Card
        className="w-full max-w-[350px] cursor-pointer hover:border-primary/50 transition-all hover:scale-105 group"
        onClick={() => onSelect("transcript")}
      >
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-secondary/20 transition-colors">
            <FileText className="w-8 h-8 text-secondary-foreground" />
          </div>
          <CardTitle>Paste Transcript</CardTitle>
          <CardDescription>
            Already have a transcript? Skip the audio and analyze directly.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground italic">
          Supports .txt, .md, and direct text paste.
        </CardContent>
      </Card>
    </div>
  );
}
