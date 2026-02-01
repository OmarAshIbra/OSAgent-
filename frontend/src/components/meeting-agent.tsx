"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Mic,
  Square,
  Users,
  Mail,
  Plus,
  Trash2,
  Play,
  Check,
  Copy,
  Loader2,
  UserPlus,
  Sun,
  Moon,
  Upload,
} from "lucide-react";
import {
  Participant,
  Meeting,
  TranscriptSegment,
  ActionItem,
} from "@/app/lib/types";

export default function MeetingAgent() {
  // State
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [meeting, setMeeting] = useState<Meeting>({
    id: crypto.randomUUID(),
    title: "",
    startTime: Date.now(),
    transcript: [],
    summary: "",
    actionItems: [],
    participantIds: [],
    status: "idle",
  });
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [newParticipant, setNewParticipant] = useState({ name: "", email: "" });
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    [],
  );
  const [activeTab, setActiveTab] = useState("live");
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bulkInput, setBulkInput] = useState("");
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("meeting-participants");
    if (saved) setParticipants(JSON.parse(saved));
  }, []);

  // Save participants
  useEffect(() => {
    localStorage.setItem("meeting-participants", JSON.stringify(participants));
  }, [participants]);

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [meeting.transcript]);

  // Timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Audio Capture
  const startRecording = async () => {
    try {
      setError(null);
      // Capture browser tab audio (Zoom)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;

      // Get audio track only
      const audioStream = new MediaStream(stream.getAudioTracks());
      const mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        // Here you would upload to backend: uploadAudio(blob)
        console.log("Recording saved:", blob.size, "bytes");
      };

      mediaRecorder.start(1000); // Collect every second

      // Web Speech API for real-time transcription (Chrome only)
      if (
        "webkitSpeechRecognition" in window ||
        "SpeechRecognition" in window
      ) {
        const SpeechRecognition =
          (window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          const results = event.results;
          const lastResult = results[results.length - 1];
          const transcript = lastResult[0].transcript;
          const isFinal = lastResult.isFinal;

          setMeeting((prev) => {
            const newSegment: TranscriptSegment = {
              id: crypto.randomUUID(),
              text: transcript,
              timestamp: Date.now(),
              speaker: "Speaker 1", // Simplified - would need diarization
              isFinal,
            };

            // Replace interim results with final
            const filtered = isFinal
              ? prev.transcript.filter((t) => t.isFinal)
              : prev.transcript.filter(
                  (t) =>
                    t.isFinal ||
                    t.timestamp !==
                      prev.transcript[prev.transcript.length - 1]?.timestamp,
                );

            return {
              ...prev,
              transcript: [...filtered, newSegment],
            };
          });
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

      setIsRecording(true);
      setMeeting((prev) => ({
        ...prev,
        status: "recording",
        startTime: Date.now(),
      }));

      // Stop when user stops sharing (clicks "Stop sharing")
      stream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };
    } catch (err) {
      setError(
        "Failed to access audio. Ensure you selected the browser tab with Zoom.",
      );
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
    setMeeting((prev) => ({
      ...prev,
      status: "completed",
      endTime: Date.now(),
    }));
    setActiveTab("review");
  };

  // AI Processing
  const processWithAI = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const fullText = meeting.transcript.map((t) => t.text).join(" ");

      const payload = {
        transcript: fullText,
        participants: participants
          .filter((p) => p.id && selectedParticipants.includes(p.id))
          .map((p) => ({ name: p.name, email: p.email })),
        meeting_title: meeting.title || "Meeting",
      };

      const response = await fetch("http://localhost:8000/process-transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const data = await response.json();

      const mappedActionItems: ActionItem[] = [];
      data.participants.forEach((p: any) => {
        const localParticipant = participants.find(
          (lp) => lp.email === p.email,
        );
        if (localParticipant && localParticipant.id) {
          p.tasks.forEach((t: any) => {
            mappedActionItems.push({
              id: crypto.randomUUID(),
              assigneeId: localParticipant.id!,
              task: t.task,
              deadline: t.deadline,
              completed: false,
            });
          });
        }
      });

      setMeeting((prev) => ({
        ...prev,
        title: data.meeting_title || prev.title || "Meeting Results",
        summary: data.meeting_summary,
        actionItems: mappedActionItems,
        status: "completed",
      }));
    } catch (err: any) {
      setError(`Failed to process with AI: ${err.message}`);
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Participant Management
  const addParticipant = () => {
    if (!newParticipant.name || !newParticipant.email) return;
    if (!newParticipant.email.includes("@")) {
      setError("Invalid email address");
      return;
    }

    const participant: Participant = {
      id: crypto.randomUUID(),
      name: newParticipant.name,
      email: newParticipant.email,
      createdAt: Date.now(),
    };

    setParticipants([...participants, participant]);
    setNewParticipant({ name: "", email: "" });
    setError(null);
  };

  const addBulkParticipants = () => {
    if (!bulkInput.trim()) return;

    const lines = bulkInput.split(/[\n,;]/);
    const newAdded: Participant[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Match patterns like "Name <email@example.com>" or "Name email@example.com" or just "email@example.com"
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

        newAdded.push({
          id: crypto.randomUUID(),
          name,
          email,
          createdAt: Date.now(),
        });
      }
    });

    if (newAdded.length > 0) {
      setParticipants([...participants, ...newAdded]);
      setBulkInput("");
      setIsBulkDialogOpen(false);
    } else {
      setError("Could not find any valid emails in the input.");
    }
  };

  const clearAllParticipants = () => {
    if (confirm("Are you sure you want to remove all contacts?")) {
      setParticipants([]);
      setSelectedParticipants([]);
    }
  };

  const deleteParticipant = (id: string) => {
    setParticipants(participants.filter((p) => p.id !== id));
    setSelectedParticipants((prev) => prev.filter((pid) => pid !== id));
  };

  // Email Generation
  const generateMailto = (participantId: string) => {
    const participant = participants.find((p) => p.id === participantId);
    if (!participant) return "";

    const tasks =
      meeting.actionItems
        .filter((item) => item.assigneeId === participantId)
        .map((item, i) => `${i + 1}. ${item.task}`)
        .join("\n") || "No specific tasks assigned.";

    const subject = `Action Items from: ${meeting.title || "Meeting"}`;
    const body = `Hi ${participant.name},

Thanks for attending the meeting. Here are your assigned tasks:

${tasks}

Meeting Summary:
${meeting.summary || "No summary available."}

Best regards`;

    return `mailto:${participant.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Meeting Agent
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Record, transcribe, and distribute action items
            </p>
          </div>
          <Badge
            variant={isRecording ? "destructive" : "secondary"}
            className="text-sm"
          >
            {isRecording ? `Recording ${formatTime(recordingTime)}` : "Ready"}
          </Badge>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar: Participants */}
          <Card className="lg:col-span-1 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5" />
                Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full" size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add One
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Participant</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <Input
                        placeholder="Name"
                        value={newParticipant.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setNewParticipant({
                            ...newParticipant,
                            name: e.target.value,
                          })
                        }
                      />
                      <Input
                        placeholder="Email"
                        type="email"
                        value={newParticipant.email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setNewParticipant({
                            ...newParticipant,
                            email: e.target.value,
                          })
                        }
                      />
                      <Button onClick={addParticipant} className="w-full">
                        Save Contact
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog
                  open={isBulkDialogOpen}
                  onOpenChange={setIsBulkDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full" size="sm">
                      <Upload className="w-4 h-4 mr-2" />
                      Bulk Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Bulk Participant Import</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
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
              </div>

              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {participants.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-8">
                      No contacts saved
                    </p>
                  )}
                  {participants.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <input
                          type="checkbox"
                          disabled={!p.id}
                          checked={
                            !!p.id && selectedParticipants.includes(p.id)
                          }
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
                            if (!p.id) return;
                            if (e.target.checked) {
                              setSelectedParticipants([
                                ...selectedParticipants,
                                p.id,
                              ]);
                            } else {
                              setSelectedParticipants(
                                selectedParticipants.filter(
                                  (id) => id !== p.id,
                                ),
                              );
                            }
                          }}
                          className="rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                        />
                        <div className="truncate">
                          <p className="text-sm font-medium truncate">
                            {p.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {p.email}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600"
                        onClick={() => p.id && deleteParticipant(p.id)}
                        disabled={!p.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>{selectedParticipants.length} selected</span>
                {participants.length > 0 && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-red-500 hover:text-red-700"
                    onClick={clearAllParticipants}
                  >
                    Clear All
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Main Content */}
          <Card className="lg:col-span-2">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between">
                  <TabsList>
                    <TabsTrigger value="live" disabled={isRecording && false}>
                      Live Meeting
                    </TabsTrigger>
                    <TabsTrigger
                      value="review"
                      disabled={meeting.status === "idle"}
                    >
                      Review & Send
                    </TabsTrigger>
                  </TabsList>

                  {activeTab === "live" && (
                    <div className="flex gap-2">
                      {!isRecording ? (
                        <Button
                          onClick={startRecording}
                          disabled={selectedParticipants.length === 0}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          <Mic className="w-4 h-4 mr-2" />
                          Record Meeting
                        </Button>
                      ) : (
                        <Button onClick={stopRecording} variant="destructive">
                          <Square className="w-4 h-4 mr-2" />
                          Stop Recording
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                <TabsContent value="live" className="mt-0 space-y-4">
                  {!isRecording && meeting.transcript.length === 0 && (
                    <div className="text-center py-12 text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                      <Mic className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>Select participants and click Record to start</p>
                      <p className="text-sm mt-2">
                        Choose the browser tab with Zoom when prompted
                      </p>
                    </div>
                  )}

                  <ScrollArea
                    ref={scrollRef}
                    className="h-[400px] rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4"
                  >
                    {meeting.transcript.length === 0 && isRecording && (
                      <div className="flex items-center justify-center h-full text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                        Waiting for speech...
                      </div>
                    )}

                    <div className="space-y-3">
                      {meeting.transcript.map((segment) => (
                        <div key={segment.id} className="flex gap-3">
                          <span className="text-xs text-slate-400 whitespace-nowrap pt-1">
                            {new Date(segment.timestamp).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </span>
                          <div className="flex-1">
                            <span className="text-xs font-semibold text-blue-600 block mb-1">
                              {segment.speaker}
                            </span>
                            <p
                              className={`text-sm ${segment.isFinal ? "text-slate-900 dark:text-slate-100" : "text-slate-400 italic"}`}
                            >
                              {segment.text}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {isRecording && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      Recording active... Speak now
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="review" className="mt-0 space-y-6">
                  {meeting.transcript.length > 0 &&
                    meeting.actionItems.length === 0 &&
                    !isProcessing && (
                      <div className="flex justify-center py-8">
                        <Button onClick={processWithAI} size="lg">
                          <Play className="w-4 h-4 mr-2" />
                          Generate Summary & Tasks
                        </Button>
                      </div>
                    )}

                  {isProcessing && (
                    <div className="flex items-center justify-center py-12 text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mr-2" />
                      AI is analyzing the transcript...
                    </div>
                  )}

                  {meeting.actionItems.length > 0 && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Meeting Title
                        </label>
                        <Input
                          value={meeting.title}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setMeeting({ ...meeting, title: e.target.value })
                          }
                          placeholder="Enter meeting title..."
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Summary</label>
                        <Textarea
                          value={meeting.summary}
                          onChange={(
                            e: React.ChangeEvent<HTMLTextAreaElement>,
                          ) =>
                            setMeeting({ ...meeting, summary: e.target.value })
                          }
                          rows={4}
                          placeholder="Meeting summary..."
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-medium">
                          Action Items
                        </label>
                        <div className="space-y-2">
                          {meeting.actionItems.map((item, idx) => (
                            <div
                              key={item.id}
                              className="flex gap-2 items-start p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                            >
                              <span className="text-sm font-medium text-slate-400 pt-2">
                                {idx + 1}
                              </span>
                              <div className="flex-1 space-y-2">
                                <Input
                                  value={item.task}
                                  onChange={(
                                    e: React.ChangeEvent<HTMLInputElement>,
                                  ) => {
                                    const newItems = [...meeting.actionItems];
                                    newItems[idx].task = e.target.value;
                                    setMeeting({
                                      ...meeting,
                                      actionItems: newItems,
                                    });
                                  }}
                                  className="border-0 p-0 focus-visible:ring-0 bg-transparent"
                                />
                                <Select
                                  value={item.assigneeId || ""}
                                  onValueChange={(value) => {
                                    const newItems = [...meeting.actionItems];
                                    newItems[idx].assigneeId = value;
                                    setMeeting({
                                      ...meeting,
                                      actionItems: newItems,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="w-[200px] h-8 text-xs">
                                    <SelectValue placeholder="Assign to..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {participants
                                      .filter((p) => p.id)
                                      .map((p) => (
                                        <SelectItem key={p.id!} value={p.id!}>
                                          {p.name}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  const newItems = meeting.actionItems.filter(
                                    (_, i) => i !== idx,
                                  );
                                  setMeeting({
                                    ...meeting,
                                    actionItems: newItems,
                                  });
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-slate-400" />
                              </Button>
                            </div>
                          ))}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setMeeting({
                                ...meeting,
                                actionItems: [
                                  ...meeting.actionItems,
                                  {
                                    id: crypto.randomUUID(),
                                    assigneeId: null,
                                    task: "",
                                    completed: false,
                                  },
                                ],
                              });
                            }}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Task
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <label className="text-sm font-medium">
                          Send Emails
                        </label>
                        <div className="grid gap-3">
                          {selectedParticipants.map((pid) => {
                            const p = participants.find((x) => x.id === pid);
                            if (!p) return null;

                            const mailto = generateMailto(pid);
                            const hasTasks = meeting.actionItems.some(
                              (item) => item.assigneeId === pid,
                            );

                            return (
                              <div
                                key={pid}
                                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors"
                              >
                                <div>
                                  <p className="font-medium text-sm">
                                    {p.name}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {hasTasks
                                      ? "Has assigned tasks"
                                      : "No tasks assigned"}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(mailto, pid)}
                                    title="Copy mailto link"
                                  >
                                    {copiedId === pid ? (
                                      <Check className="w-4 h-4" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      window.open(mailto, "_blank")
                                    }
                                    title="Open locally in Email Client"
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                  >
                                    <Mail className="w-4 h-4 mr-2" />
                                    Open Email
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
