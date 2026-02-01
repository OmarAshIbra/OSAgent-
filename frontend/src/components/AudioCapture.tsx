"use client";

import React, { useState, useEffect, useRef } from "react";
import { DuplexAudioRecorder } from "../app/lib/audio-recorder";
import { Participant, ProcessingResult } from "@/app/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Mic,
  ShieldAlert as SystemIcon,
  UserPlus,
  X,
  Info,
  CheckCircle2,
} from "lucide-react";

interface AudioCaptureProps {
  sessionId: string;
  onComplete: (result: ProcessingResult) => void;
  onCancel: () => void;
}

export default function AudioCapture({
  sessionId,
  onComplete,
  onCancel,
}: AudioCaptureProps) {
  const [setupStep, setSetupStep] = useState<1 | 2 | 3 | 4>(1);
  const [status, setStatus] = useState<
    "idle" | "streaming" | "processing" | "error"
  >("idle");
  const [levels, setLevels] = useState({ mic: 0, system: 0 });
  const [timer, setTimer] = useState(0);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const micStreamRef = useRef<MediaStream | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<DuplexAudioRecorder | null>(null);

  useEffect(() => {
    let interval: any;
    if (status === "streaming") {
      document.title = "🔴 Recording... - AI Assistant";
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev >= 45 * 60) {
            handleStop();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      document.title = "AI Meeting Assistant";
    }
    return () => {
      clearInterval(interval);
      document.title = "AI Meeting Assistant";
    };
  }, [status]);

  const requestMic = async () => {
    try {
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      setSetupStep(2);
    } catch (err: any) {
      setError("Microphone permission denied.");
    }
  };

  const requestSystemAudio = async () => {
    try {
      systemStreamRef.current = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      if (!systemStreamRef.current.getAudioTracks().length) {
        systemStreamRef.current.getTracks().forEach((t) => t.stop());
        setError(
          "No system audio track found. Please ensure 'Share audio' is ENABLED.",
        );
        return;
      }
      setSetupStep(3);
    } catch (err: any) {
      setError("System audio capture cancelled or failed.");
    }
  };

  const handleStartRecording = async () => {
    try {
      recorderRef.current = new DuplexAudioRecorder(
        (msg) => {
          if (msg.stage === "complete" && msg.result) {
            onComplete(msg.result);
          } else if (msg.stage === "error") {
            setError(msg.message || "Unknown error");
            setStatus("error");
          } else {
            setStage(msg.stage);
            setStatus("processing");
          }
        },
        (levels) => setLevels(levels),
      );

      // We need a custom start that accepts already acquired streams
      // But for simplicity in this demo, the recorder usually handles its own.
      // I'll update the recorder or just pass them if I can.
      // Re-running start since recorder class expects to own the lifecycle.
      await recorderRef.current.start(
        sessionId,
        title || "Live Meeting",
        participants,
        micStreamRef.current,
        systemStreamRef.current,
      );
      setStatus("streaming");
    } catch (err: any) {
      setError(err.message);
      setStatus("error");
    }
  };

  const handleStop = () => {
    recorderRef.current?.stop();
    setStatus("processing");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (status === "idle") {
    return (
      <Card className="max-w-xl mx-auto border-primary/20 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="h-2 bg-gradient-to-r from-primary to-sky-500" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            🎙️ Audio Setup
          </CardTitle>
          <CardDescription>
            Follow the steps to prepare your recording pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Step 1: Mic */}
          <div
            className={`p-4 rounded-xl border transition-all ${setupStep >= 1 ? "border-primary bg-primary/5" : "opacity-40"}`}
          >
            <div className="flex justify-between items-center">
              <div className="flex gap-4 items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${setupStep > 1 ? "bg-green-500 text-white" : "bg-primary text-primary-foreground"}`}
                >
                  {setupStep > 1 ? <CheckCircle2 size={20} /> : "1"}
                </div>
                <div>
                  <h4 className="font-bold">Microphone Permission</h4>
                  <p className="text-sm text-muted-foreground">
                    Grant access to your voice.
                  </p>
                </div>
              </div>
              {setupStep === 1 && (
                <Button onClick={requestMic}>Grant Mic</Button>
              )}
            </div>
          </div>

          {/* Step 2: System Audio */}
          <div
            className={`p-4 rounded-xl border transition-all ${setupStep >= 2 ? "border-primary bg-primary/5" : "opacity-40"}`}
          >
            <div className="flex justify-between items-center">
              <div className="flex gap-4 items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${setupStep > 2 ? "bg-green-500 text-white" : "bg-primary text-primary-foreground"}`}
                >
                  {setupStep > 2 ? <CheckCircle2 size={20} /> : "2"}
                </div>
                <div>
                  <h4 className="font-bold">System Audio (Screen Share)</h4>
                  <p className="text-sm text-muted-foreground">
                    Select "Chrome Tab" and check <b>Share Audio</b>.
                  </p>
                </div>
              </div>
              {setupStep === 2 && (
                <Button onClick={requestSystemAudio}>Select Source</Button>
              )}
            </div>
          </div>

          {/* Step 3: Metadata */}
          <div
            className={`p-4 rounded-xl border transition-all ${setupStep >= 3 ? "border-primary bg-primary/5" : "opacity-40"}`}
          >
            <div className="space-y-4">
              <div className="flex gap-4 items-center mb-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${setupStep > 3 ? "bg-green-500 text-white" : "bg-primary text-primary-foreground"}`}
                >
                  {setupStep > 3 ? <CheckCircle2 size={20} /> : "3"}
                </div>
                <h4 className="font-bold">Final Details</h4>
              </div>

              {setupStep >= 3 && (
                <div className="space-y-4 animate-in fade-in duration-500">
                  <Input
                    placeholder="Meeting Title (Optional)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase text-muted-foreground">
                        Participants
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setParticipants([
                            ...participants,
                            { name: "", email: "" },
                          ])
                        }
                        className="h-6"
                      >
                        <UserPlus size={14} className="mr-1" /> Add
                      </Button>
                    </div>
                    {participants.map((p, i) => (
                      <div
                        key={i}
                        className="flex gap-2 animate-in zoom-in-95 duration-200"
                      >
                        <Input
                          className="h-8"
                          placeholder="Name"
                          value={p.name}
                          onChange={(e) => {
                            const n = [...participants];
                            n[i].name = e.target.value;
                            setParticipants(n);
                          }}
                        />
                        <Input
                          className="h-8"
                          placeholder="Email"
                          value={p.email}
                          onChange={(e) => {
                            const n = [...participants];
                            n[i].email = e.target.value;
                            setParticipants(n);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full h-12 text-lg font-bold"
                    onClick={() => setSetupStep(4)}
                  >
                    Review & Start
                  </Button>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="text-destructive text-sm font-medium bg-destructive/10 p-3 rounded-lg border border-destructive/20">
              {error}
            </p>
          )}
        </CardContent>
        {setupStep === 4 && (
          <CardFooter className="bg-primary/5 p-6 animate-in slide-in-from-bottom-4 duration-500">
            <Button
              className="w-full h-14 text-xl font-black rounded-xl shadow-xl"
              onClick={handleStartRecording}
            >
              START MEETING RECORDING
            </Button>
          </CardFooter>
        )}
      </Card>
    );
  }

  // ... (rest of the states: streaming, processing, error remain same but with better styling)
  if (status === "streaming") {
    return (
      <Card className="max-w-xl mx-auto text-center p-12 border-destructive/20 shadow-[0_0_50px_rgba(255,0,0,0.1)]">
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping" />
            <div className="relative w-24 h-24 bg-red-500 rounded-full flex items-center justify-center border-4 border-background">
              <Mic className="w-10 h-10 text-white animate-pulse" />
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-black mb-2 uppercase tracking-tighter">
          Live Session Active
        </h2>
        <div className="text-7xl font-mono tabular-nums tracking-tighter mb-12">
          {formatTime(timer)}
        </div>

        <div className="grid grid-cols-2 gap-12 mb-12">
          <div className="space-y-4">
            <div className="h-32 w-8 mx-auto bg-muted rounded-full relative overflow-hidden">
              <div
                className="absolute bottom-0 w-full bg-green-500 transition-all duration-75"
                style={{ height: `${levels.mic}%` }}
              />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Microphone
            </span>
          </div>
          <div className="space-y-4">
            <div className="h-32 w-8 mx-auto bg-muted rounded-full relative overflow-hidden">
              <div
                className="absolute bottom-0 w-full bg-sky-500 transition-all duration-75"
                style={{ height: `${levels.system}%` }}
              />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              System Audio
            </span>
          </div>
        </div>

        <Button
          variant="destructive"
          size="lg"
          className="w-full h-16 rounded-2xl text-xl font-bold gap-4"
          onClick={handleStop}
        >
          <X className="w-6 h-6" /> Stop & Finalize
        </Button>
      </Card>
    );
  }

  // Processing & Error
  if (status === "processing") {
    return (
      <Card className="max-w-md mx-auto py-20 text-center space-y-8">
        <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <div className="space-y-2">
          <h2 className="text-3xl font-black tracking-tight capitalize">
            {stage || "Wait"}...
          </h2>
          <p className="text-muted-foreground">
            Zero-storage pipeline is actively synthesizing your meeting.
          </p>
        </div>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card className="max-w-md mx-auto p-12 text-center border-destructive">
        <CardTitle className="text-destructive mb-4">
          Pipeline Failure
        </CardTitle>
        <p className="mb-8 text-muted-foreground">{error}</p>
        <Button className="w-full" onClick={() => setSetupStep(1)}>
          Reset Pipeline
        </Button>
      </Card>
    );
  }

  return null;
}
