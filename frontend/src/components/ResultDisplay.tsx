"use client";

import React, { useState } from "react";
import { ProcessingResult, Participant } from "@/app/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  CheckCircle2,
  ListTodo,
  FileText,
  ArrowLeft,
  Mail,
  UserPlus,
  Upload,
  Home,
  Trash2,
  ScrollText,
} from "lucide-react";

interface ResultDisplayProps {
  result: ProcessingResult;
  onReset: () => void;
  onUpdateResult?: (result: ProcessingResult) => void;
}

type TabType = "summary" | "transcript";

export default function ResultDisplay({ result, onReset, onUpdateResult }: ResultDisplayProps) {
  const [activeTab, setActiveTab] = useState<TabType>("summary");
  const [newParticipants, setNewParticipants] = useState<Participant[]>([]);
  const [bulkInput, setBulkInput] = useState("");
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [isAddingParticipants, setIsAddingParticipants] = useState(false);

  const generateMailto = (
    participantName: string,
    participantEmail: string,
    tasks: any[],
  ) => {
    const taskList = tasks
      .map((t, i) => `${i + 1}. ${t.task} (Deadline: ${t.deadline || "None"})`)
      .join("\n");

    const subject = `Action Items from Meeting: ${result.meeting_summary.slice(0, 30)}...`;
    const body = `Hi ${participantName},\n\nHere are your action items from the recent meeting:\n\n${taskList}\n\nMeeting Summary:\n${result.meeting_summary}\n\nBest regards,\nAI Meeting Assistant`;

    return `mailto:${participantEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const addParticipant = () => {
    setNewParticipants([...newParticipants, { name: "", email: "" }]);
  };

  const updateParticipant = (
    index: number,
    field: keyof Participant,
    value: string,
  ) => {
    const updated = [...newParticipants];
    updated[index] = { ...updated[index], [field]: value };
    setNewParticipants(updated);
  };

  const removeParticipant = (index: number) => {
    const updated = [...newParticipants];
    updated.splice(index, 1);
    setNewParticipants(updated);
  };

  const clearAllParticipants = () => {
    if (confirm("Are you sure you want to remove all new participants?")) {
      setNewParticipants([]);
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
      setNewParticipants([...newParticipants, ...newAdded]);
      setBulkInput("");
      setIsBulkDialogOpen(false);
    }
  };

  const handleSendToNewParticipants = () => {
    const validParticipants = newParticipants.filter(
      (p) => p.name.trim() && p.email.trim(),
    );

    if (validParticipants.length === 0) {
      alert("Please add at least one valid participant with name and email.");
      return;
    }

    // Generate mailto links for each participant
    validParticipants.forEach((p) => {
      const mailto = generateMailto(p.name, p.email, []);
      window.open(mailto, "_blank");
    });

    // Add them to the result
    if (onUpdateResult) {
      const updatedResult = {
        ...result,
        participants: [
          ...result.participants,
          ...validParticipants.map((p) => ({ ...p, tasks: [] })),
        ],
      };
      onUpdateResult(updatedResult);
    }

    // Clear the form
    setNewParticipants([]);
    setIsAddingParticipants(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => window.location.href = "/"} className="gap-2">
            <Home size={16} /> Home
          </Button>
          <Button variant="ghost" onClick={onReset} className="gap-2">
            <ArrowLeft size={16} /> Start New
          </Button>
        </div>
        <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950/20 px-4 py-2 rounded-full border border-green-200 dark:border-green-900">
          <CheckCircle2 size={16} />
          <span className="text-sm font-semibold">Summarized & Emailed</span>
        </div>
      </div>

      <Card className="border-primary/20 shadow-xl overflow-hidden">
        <div className="h-2 bg-primary" />
        <CardHeader className="bg-muted/30">
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-4 p-1 bg-muted rounded-lg w-fit">
            <button
              onClick={() => setActiveTab("summary")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                activeTab === "summary"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText size={16} />
              Meeting Summary
            </button>
            <button
              onClick={() => setActiveTab("transcript")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                activeTab === "transcript"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ScrollText size={16} />
              Transcript
            </button>
          </div>

          <CardTitle className="flex items-center gap-2">
            {activeTab === "summary" ? (
              <>
                <FileText className="text-primary" /> Meeting Summary
              </>
            ) : (
              <>
                <ScrollText className="text-primary" /> Meeting Transcript
              </>
            )}
          </CardTitle>
          <CardDescription>
            {activeTab === "summary"
              ? "Key takeaways and decisions made during the session."
              : "Full transcript of the meeting conversation."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 prose dark:prose-invert max-w-none">
          {activeTab === "summary" ? (
            <div className="whitespace-pre-wrap leading-relaxed text-foreground/90">
              {result.meeting_summary}
            </div>
          ) : (
            <div className="whitespace-pre-wrap leading-relaxed text-foreground/90 font-mono text-sm">
              {result.transcript || "No transcript available."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Participants Section */}
      {onUpdateResult && (
        <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="text-blue-600" /> Add Participants
                </CardTitle>
                <CardDescription>
                  Add participants who were not included initially to send them the meeting summary.
                </CardDescription>
              </div>
              {!isAddingParticipants && (
                <Button
                  onClick={() => setIsAddingParticipants(true)}
                  className="gap-2"
                >
                  <UserPlus size={16} /> Add Participants
                </Button>
              )}
            </div>
          </CardHeader>
          {isAddingParticipants && (
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">New Participants</span>
                <div className="flex gap-2">
                  {newParticipants.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllParticipants}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Clear All
                    </Button>
                  )}
                  <Dialog
                    open={isBulkDialogOpen}
                    onOpenChange={setIsBulkDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Upload size={14} /> Bulk Add
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
                    variant="outline"
                    size="sm"
                    onClick={addParticipant}
                    className="gap-2"
                  >
                    <UserPlus size={16} /> Add One
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {newParticipants.map((p, i) => (
                  <div
                    key={i}
                    className="flex gap-2 p-2 border rounded-md bg-background"
                  >
                    <Input
                      placeholder="Name"
                      value={p.name}
                      onChange={(e) => updateParticipant(i, "name", e.target.value)}
                    />
                    <Input
                      placeholder="Email"
                      value={p.email}
                      onChange={(e) => updateParticipant(i, "email", e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-red-500"
                      onClick={() => removeParticipant(i)}
                      title="Remove participant"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>

              {newParticipants.length > 0 && (
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleSendToNewParticipants}
                    className="flex-1 gap-2"
                  >
                    <Mail size={16} /> Send Summary to New Participants
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddingParticipants(false);
                      setNewParticipants([]);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {result.participants
          .filter((p) => p.tasks.length > 0)
          .map((participant, i) => (
            <Card key={i} className="hover:border-primary/30 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {participant.name.charAt(0).toUpperCase()}
                    </span>
                    {participant.name}
                  </CardTitle>
                  <Mail size={14} className="text-muted-foreground" />
                </div>
                <CardDescription className="text-xs">
                  {participant.email}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-end mb-4">
                  <Button
                    size="sm"
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white w-full"
                    onClick={() =>
                      window.open(
                        generateMailto(
                          participant.name,
                          participant.email,
                          participant.tasks,
                        ),
                        "_blank",
                      )
                    }
                  >
                    <Mail size={14} /> Send Email Manually
                  </Button>
                </div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                  <ListTodo size={14} /> Tasks Assigned
                </h4>
                <ul className="space-y-3">
                  {participant.tasks.map((task, j) => (
                    <li
                      key={j}
                      className="text-sm bg-muted/30 p-3 rounded-lg border border-transparent hover:border-muted-foreground/10 transition-colors"
                    >
                      <p className="font-medium mb-1">{task.task}</p>
                      {task.deadline && (
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">
                          {task.deadline}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
      </div>

      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm max-w-md mx-auto italic">
          Zero-storage policy: Transcripts and audio files have been permanently
          deleted from our servers. Insights were delivered via email to
          assigned participants.
        </p>
      </div>
    </div>
  );
}
