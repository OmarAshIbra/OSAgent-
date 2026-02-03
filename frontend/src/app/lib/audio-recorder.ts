import { WebSocketMessage, Participant } from "./types";

export type ConnectionState = "connected" | "reconnecting" | "disconnected" | "error";

export class DuplexAudioRecorder {
  private micStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  private mixedStream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private ws: WebSocket | null = null;
  private onMessageCallback: (msg: WebSocketMessage) => void;
  private onLevelsChange: (levels: { mic: number; system: number }) => void;
  private onConnectionChange: (state: ConnectionState) => void;
  private audioCtx: AudioContext | null = null;
  private analyserMic: AnalyserNode | null = null;
  private analyserSys: AnalyserNode | null = null;
  private animationId: number | null = null;

  // Mute functionality
  private gainNode: GainNode | null = null;
  private isMuted: boolean = false;

  // Connection resilience
  private connectionState: ConnectionState = "disconnected";
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private reconnectTimeout: number | null = null;
  private chunkBuffer: Blob[] = [];
  private maxBufferSize: number = 50; // ~50 seconds of audio
  private sequenceNumber: number = 0;

  // Session info for reconnection
  private sessionId: string = "";
  private meetingTitle: string = "";
  private meetingParticipants: Participant[] = [];

  constructor(
    onMessage: (msg: WebSocketMessage) => void,
    onLevels: (levels: { mic: number; system: number }) => void,
    onConnectionChange: (state: ConnectionState) => void,
  ) {
    this.onMessageCallback = onMessage;
    this.onLevelsChange = onLevels;
    this.onConnectionChange = onConnectionChange;
  }

  async start(
    sessionId: string,
    title: string,
    participants: Participant[],
    preMicStream?: MediaStream | null,
    preSystemStream?: MediaStream | null,
  ): Promise<void> {
    try {
      // Store session info for reconnection
      this.sessionId = sessionId;
      this.meetingTitle = title;
      this.meetingParticipants = participants;

      // 1. Get streams if not provided
      this.micStream =
        preMicStream ||
        (await navigator.mediaDevices.getUserMedia({ audio: true }));
      this.systemStream =
        preSystemStream ||
        (await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        }));

      if (!this.systemStream.getAudioTracks().length) {
        throw new Error(
          "No system audio detected. Please ensure 'Share audio' is checked.",
        );
      }

      // 3. Mix using AudioContext with GainNode for mute control
      this.audioCtx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      const dest = this.audioCtx.createMediaStreamDestination();

      const micSource = this.audioCtx.createMediaStreamSource(this.micStream);
      this.analyserMic = this.audioCtx.createAnalyser();
      this.gainNode = this.audioCtx.createGain();

      // Route: micSource → gainNode → analyser → destination
      micSource.connect(this.gainNode);
      this.gainNode.connect(this.analyserMic);
      this.gainNode.connect(dest);

      const sysSource = this.audioCtx.createMediaStreamSource(
        this.systemStream,
      );
      this.analyserSys = this.audioCtx.createAnalyser();
      sysSource.connect(this.analyserSys);
      sysSource.connect(dest);

      this.mixedStream = dest.stream;

      // 4. Start level monitoring
      this.startLevelMonitoring();

      // 5. Setup WebSocket connection with reconnection logic
      await this.setupWebSocket();
    } catch (err: any) {
      this.cleanup();
      throw err;
    }
  }

  private async setupWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host =
        process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, "") ||
        "localhost:8000";

      this.ws = new WebSocket(`${protocol}//${host}/ws/record/${this.sessionId}`);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.setConnectionState("connected");
        this.reconnectAttempts = 0;

        // Send initial metadata
        this.ws?.send(
          JSON.stringify({
            type: "metadata",
            title: this.meetingTitle,
            participants: this.meetingParticipants,
          }),
        );

        // Send any buffered chunks
        this.flushChunkBuffer();

        // Start recording if not already started
        if (!this.recorder || this.recorder.state === "inactive") {
          this.recorder = new MediaRecorder(this.mixedStream!, {
            mimeType: "audio/webm",
          });

          this.recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              this.handleAudioChunk(e.data);
            }
          };

          this.recorder.start(1000); // 1-second chunks
        }

        resolve();
      };

      this.ws.onmessage = (e) => {
        const msg: WebSocketMessage = JSON.parse(e.data);
        this.onMessageCallback(msg);
      };

      this.ws.onerror = (e) => {
        console.error("WebSocket error:", e);
        this.setConnectionState("error");
        reject(new Error("WebSocket connection failed"));
      };

      this.ws.onclose = (e) => {
        console.log("WebSocket closed:", e.code, e.reason);

        // Don't reconnect if this was a normal closure or we're stopping
        if (e.code === 1000 || this.recorder?.state === "inactive") {
          this.setConnectionState("disconnected");
          return;
        }

        // Attempt to reconnect
        this.handleReconnect();
      };
    });
  }

  private handleAudioChunk(chunk: Blob): void {
    this.sequenceNumber++;

    if (this.ws?.readyState === WebSocket.OPEN) {
      // Send sequence number first, then chunk
      this.ws.send(JSON.stringify({ type: "chunk_seq", seq: this.sequenceNumber }));
      this.ws.send(chunk);
    } else {
      // Buffer the chunk if not connected
      this.bufferChunk(chunk);
    }
  }

  private bufferChunk(chunk: Blob): void {
    if (this.chunkBuffer.length < this.maxBufferSize) {
      this.chunkBuffer.push(chunk);
    } else {
      console.warn("Chunk buffer full, dropping oldest chunk");
      this.chunkBuffer.shift();
      this.chunkBuffer.push(chunk);
    }
  }

  private flushChunkBuffer(): void {
    if (this.chunkBuffer.length === 0) return;

    console.log(`Flushing ${this.chunkBuffer.length} buffered chunks`);

    this.chunkBuffer.forEach((chunk) => {
      this.sequenceNumber++;
      this.ws?.send(JSON.stringify({ type: "chunk_seq", seq: this.sequenceNumber }));
      this.ws?.send(chunk);
    });

    this.chunkBuffer = [];
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setConnectionState("disconnected");
      this.onMessageCallback({
        stage: "error",
        message: "Connection lost. Unable to reconnect after 3 attempts.",
      });
      return;
    }

    this.setConnectionState("reconnecting");
    this.reconnectAttempts++;

    // Exponential backoff: 0ms, 2s, 4s
    const delay = this.reconnectAttempts === 1 ? 0 : (this.reconnectAttempts - 1) * 2000;

    console.log(`Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);

    this.reconnectTimeout = window.setTimeout(async () => {
      try {
        await this.setupWebSocket();
      } catch (err) {
        console.error("Reconnection failed:", err);
        this.handleReconnect(); // Try again
      }
    }, delay);
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.onConnectionChange(state);
  }

  public toggleMute(): boolean {
    if (!this.gainNode) return this.isMuted;

    this.isMuted = !this.isMuted;
    this.gainNode.gain.value = this.isMuted ? 0 : 1;

    // Send mute event to backend
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "mute_event",
          timestamp: Date.now(),
          muted: this.isMuted,
        }),
      );
    }

    return this.isMuted;
  }

  public getMuteState(): boolean {
    return this.isMuted;
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  private startLevelMonitoring() {
    const dataArrayMic = new Uint8Array(this.analyserMic!.frequencyBinCount);
    const dataArraySys = new Uint8Array(this.analyserSys!.frequencyBinCount);

    const update = () => {
      if (!this.analyserMic || !this.analyserSys) return;

      this.analyserMic.getByteFrequencyData(dataArrayMic);
      this.analyserSys.getByteFrequencyData(dataArraySys);

      const micLevel =
        dataArrayMic.reduce((a, b) => a + b, 0) / dataArrayMic.length;
      const sysLevel =
        dataArraySys.reduce((a, b) => a + b, 0) / dataArraySys.length;

      // Set mic level to 0 if muted for visual feedback
      this.onLevelsChange({
        mic: this.isMuted ? 0 : Math.min(100, micLevel * 2),
        system: Math.min(100, sysLevel * 2),
      });

      this.animationId = requestAnimationFrame(update);
    };
    update();
  }

  stop(): void {
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.stop();
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "stop" }));
    }
    this.cleanup();
  }

  private cleanup() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

    this.micStream?.getTracks().forEach((t) => t.stop());
    this.systemStream?.getTracks().forEach((t) => t.stop());
    this.mixedStream?.getTracks().forEach((t) => t.stop());

    if (this.audioCtx) {
      this.audioCtx.close();
    }

    this.micStream = null;
    this.systemStream = null;
    this.mixedStream = null;
    this.audioCtx = null;
    this.analyserMic = null;
    this.analyserSys = null;
    this.gainNode = null;
    this.chunkBuffer = [];
    this.reconnectAttempts = 0;
    this.sequenceNumber = 0;
  }
}
