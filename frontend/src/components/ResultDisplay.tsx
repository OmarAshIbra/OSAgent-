"use client";

import React from "react";
import { ProcessingResult } from "@/app/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { Button } from "./ui/button";
import {
  CheckCircle2,
  ListTodo,
  FileText,
  ArrowLeft,
  Mail,
} from "lucide-react";

interface ResultDisplayProps {
  result: ProcessingResult;
  onReset: () => void;
}

export default function ResultDisplay({ result, onReset }: ResultDisplayProps) {
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

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex justify-between items-center">
        <Button variant="ghost" onClick={onReset} className="gap-2">
          <ArrowLeft size={16} /> Start New
        </Button>
        <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950/20 px-4 py-2 rounded-full border border-green-200 dark:border-green-900">
          <CheckCircle2 size={16} />
          <span className="text-sm font-semibold">Summarized & Emailed</span>
        </div>
      </div>

      <Card className="border-primary/20 shadow-xl overflow-hidden">
        <div className="h-2 bg-primary" />
        <CardHeader className="bg-muted/30">
          <CardTitle className="flex items-center gap-2">
            <FileText className="text-primary" /> Meeting Summary
          </CardTitle>
          <CardDescription>
            Key takeaways and decisions made during the session.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 prose dark:prose-invert max-w-none">
          <div className="whitespace-pre-wrap leading-relaxed text-foreground/90">
            {result.meeting_summary}
          </div>
        </CardContent>
      </Card>

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
