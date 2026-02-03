"use client";

import React, { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea"; // Add Textarea import
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"; // Add Dialog imports
import { FileText, Upload, UserPlus, FileWarning, Trash2 } from "lucide-react"; // Add Trash2

interface TranscriptPasteProps {
  onComplete: (result: ProcessingResult) => void;
  onCancel: () => void;
}

export default function TranscriptPaste({
  onComplete,
  onCancel,
}: TranscriptPasteProps) {
  const [transcript, setTranscript] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [bulkInput, setBulkInput] = useState("");
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setTranscript(text);
      if (!title) setTitle(file.name.split(".")[0]);
    } catch (err) {
      setError("Failed to read file. Please ensure it is a text-based file.");
    }
  };

  const handleSubmit = async () => {
    if (!transcript || transcript.length < 10) {
      setError("Transcript must be at least 10 characters.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/process-transcript`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            participants,
            meeting_title: title || "Pasted Transcript",
          }),
        },
      );

      if (!response.ok) throw new Error("Failed to process transcript");
      const result = await response.json();
      onComplete(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addParticipant = () => {
    setParticipants([...participants, { name: "", email: "" }]);
  };

  const updateParticipant = (
    index: number,
    field: keyof Participant,
    value: string,
  ) => {
    const newParticipants = [...participants];
    newParticipants[index] = { ...newParticipants[index], [field]: value };
    setParticipants(newParticipants);
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
      setError("Could not find any valid emails in the input.");
    }
  };

  return (
    <Card className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader>
        <div className="flex justify-between items-start mb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="text-secondary-foreground" /> Paste
              Transcript
            </CardTitle>
            <CardDescription>
              Analyze existing meeting notes or transcripts instantly.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Meeting Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Design Critique"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">Transcript Content</label>
            <label className="text-xs text-primary cursor-pointer hover:underline flex items-center gap-1 font-medium">
              <Upload size={14} /> Upload .txt / .md
              <input
                type="file"
                accept=".txt,.md"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste your meeting text here... (Supports more than  30,000 characters)"
            className="w-full h-80 p-4 rounded-md border border-input bg-background text-sm font-mono resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="text-[10px] text-muted-foreground text-right uppercase tracking-wider font-bold">
            {transcript.length.toLocaleString()} characters
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">
              Participants (for task assignment)
            </label>
            <div className="flex gap-2">
              {participants.length > 0 && (
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
            {participants.map((p, i) => (
              <div
                key={i}
                className="flex gap-2 p-2 border rounded-md bg-muted/30"
              >
                <Input
                  className="bg-background"
                  placeholder="Name"
                  value={p.name}
                  onChange={(e) => updateParticipant(i, "name", e.target.value)}
                />
                <Input
                  className="bg-background"
                  placeholder="Email"
                  value={p.email}
                  onChange={(e) =>
                    updateParticipant(i, "email", e.target.value)
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-muted-foreground hover:text-red-500"
                  onClick={() => removeParticipant(i)}
                  title="Remove participant"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20">
            <FileWarning size={16} /> {error}
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-3">
        <Button
          className="flex-1 h-12 text-lg"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Analyzing..." : "Analyze Insight"}
        </Button>
        <Button variant="ghost" className="h-12" onClick={onCancel}>
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}
