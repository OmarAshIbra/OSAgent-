"use client";

import React, { useState, useEffect, useRef } from "react";
import { DuplexAudioRecorder, ConnectionState } from "../app/lib/audio-recorder";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Mic,
  MicOff,
  ShieldAlert as SystemIcon,
  UserPlus,
  X,
  Info,
  CheckCircle2,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
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
  const [bulkInput, setBulkInput] = useState("");
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");

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
          "No system audio track found. Please ensure 'Share audio' is ENABLED in the picker.",
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
        (state) => setConnectionState(state),
      );

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

  const handleToggleMute = () => {
    if (recorderRef.current) {
      const newMuteState = recorderRef.current.toggleMute();
      setIsMuted(newMuteState);
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

  const removeParticipant = (index: number) => {
    const newParticipants = [...participants];
    newParticipants.splice(index, 1);
    setParticipants(newParticipants);
  };

  const clearAllParticipants = () => {
    if (confirm("Are you sure you want to remove all participants?")) {
      setParticipants([]);
    }
  };

  const addBulkParticipants = () => {
    if (!bulkInput.trim()) return;

    const lines = bulkInput.split(/[\n,;]/);
    const newAdded: Participant[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const emailMatch = trimmed.match(
        /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
      );
      if (emailMatch) {
        const email = emailMatch[1];
        let name = trimmed
          .replace(email, "")
          .replace(/[<>(),]/g, "")
          .trim();

        if (!name) {
          name =
            email.split("@")[0].charAt(0).toUpperCase() +
            email.split("@")[0].slice(1);
        }

        newAdded.push({ name, email });
      }
    });

    if (newAdded.length > 0) {
      setParticipants([...participants, ...newAdded]);
      setBulkInput("");
      setIsBulkDialogOpen(false);
    } else {
      setError("Could not find any valid emails in the bulk input.");
    }
  };

  if (status === "idle") {
    return (
      <Card className="max-w-xl mx-auto border-primary/20 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="h-2 bg-gradient-to-r from-primary to-sky-500" />
        <CardHeader>
          <div className="flex justify-between items-start mb-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                🎙️ Audio Setup
              </CardTitle>
              <CardDescription>
                Follow the steps to prepare your recording pipeline.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="gap-2"
            >
              Cancel
            </Button>
          </div>
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
                    Select "Entire Screen" (for Zoom App) or "Chrome Tab".{" "}
                    <b>Check Share Audio</b>.
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
                      <div className="flex gap-2">
                        {participants.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearAllParticipants}
                            className="h-6 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            Clear All
                          </Button>
                        )}
                        <Dialog
                          open={isBulkDialogOpen}
                          onOpenChange={setIsBulkDialogOpen}
                        >
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-6 gap-1">
                              <Upload size={12} /> Bulk Add
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Bulk Import Participants</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                              <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg border">
                                <p className="font-semibold mb-1">Supported Formats:</p>
                                <ul className="list-disc pl-4 space-y-1">
                                  <li>John Doe &lt;john@example.com&gt;</li>
                                  <li>Jane Smith, jane@example.com</li>
                                  <li>bob@example.com</li>
                                </ul>
                              </div>
                              <Textarea
                                placeholder="Paste your contacts list here..."
                                value={bulkInput}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                  setBulkInput(e.target.value)
                                }
                                rows={6}
                                className="font-mono text-xs"
                              />
                              <Button onClick={addBulkParticipants} className="w-full">
                                Import Participants
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-500"
                          onClick={() => removeParticipant(i)}
                          title="Remove participant"
                        >
                          <Trash2 size={14} />
                        </Button>
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
    // Connection status badge component
    const getConnectionBadge = () => {
      const badges = {
        connected: {
          icon: <Wifi className="w-3 h-3" />,
          text: "Connected",
          className: "bg-green-500/10 text-green-600 border-green-500/20",
        },
        reconnecting: {
          icon: <WifiOff className="w-3 h-3 animate-pulse" />,
          text: "Reconnecting...",
          className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
        },
        disconnected: {
          icon: <WifiOff className="w-3 h-3" />,
          text: "Disconnected",
          className: "bg-red-500/10 text-red-600 border-red-500/20",
        },
        error: {
          icon: <WifiOff className="w-3 h-3" />,
          text: "Error",
          className: "bg-red-500/10 text-red-600 border-red-500/20",
        },
      };

      const badge = badges[connectionState];
      return (
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${badge.className}`}>
          {badge.icon}
          {badge.text}
        </div>
      );
    };

    return (
      <Card className="max-w-xl mx-auto text-center p-12 border-destructive/20 shadow-[0_0_50px_rgba(255,0,0,0.1)] relative">
        {/* Connection Status Badge */}
        <div className="absolute top-4 right-4">
          {getConnectionBadge()}
        </div>

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

        <div className="grid grid-cols-2 gap-12 mb-8">
          <div className="space-y-4">
            <div className="h-32 w-8 mx-auto bg-muted rounded-full relative overflow-hidden">
              <div
                className={`absolute bottom-0 w-full transition-all duration-75 ${isMuted ? "bg-red-500" : "bg-green-500"}`}
                style={{ height: `${levels.mic}%` }}
              />
              {isMuted && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <MicOff className="w-4 h-4 text-red-600" />
                </div>
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Microphone {isMuted && "(MUTED)"}
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

        {/* Mute Button */}
        <div className="mb-6">
          <Button
            variant={isMuted ? "destructive" : "secondary"}
            size="lg"
            className="w-full h-12 rounded-xl text-lg font-bold gap-2"
            onClick={handleToggleMute}
          >
            {isMuted ? (
              <>
                <MicOff className="w-5 h-5" /> Unmute Microphone
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" /> Mute Microphone
              </>
            )}
          </Button>
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
