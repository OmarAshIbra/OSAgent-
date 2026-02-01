export interface Task {
  task: string;
  deadline?: string | null;
}

export interface Participant {
  id?: string;
  name: string;
  email: string;
  createdAt?: number;
}

export interface ActionItem {
  id: string;
  assigneeId: string | null;
  task: string;
  deadline?: string;
  completed: boolean;
}

export interface TranscriptSegment {
  id?: string;
  speaker: string;
  text: string;
  timestamp: number;
  isFinal?: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  startTime: number;
  transcript: TranscriptSegment[];
  summary: string;
  actionItems: ActionItem[];
  participantIds: string[];
  status: "idle" | "live" | "recording" | "processing" | "completed";
}

export interface ParticipantResult extends Participant {
  tasks: Task[];
}

export interface ProcessingResult {
  meeting_summary: string;
  participants: ParticipantResult[];
}

export type ProcessingStage =
  | "assembling"
  | "transcribing"
  | "analyzing"
  | "complete"
  | "error";

export interface WebSocketMessage {
  stage: ProcessingStage;
  bytes_received?: number;
  progress?: number;
  result?: ProcessingResult;
  message?: string;
}

export interface MeetingSession {
  id: string;
  title: string;
  participants: Participant[];
  status:
    | "idle"
    | "audio_setup"
    | "streaming"
    | "processing"
    | "transcript_input"
    | "complete";
}
