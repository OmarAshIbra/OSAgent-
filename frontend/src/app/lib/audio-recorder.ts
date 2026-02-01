import { WebSocketMessage, Participant } from "./types";

export class DuplexAudioRecorder {
  private micStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  private mixedStream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private ws: WebSocket | null = null;
  private onMessageCallback: (msg: WebSocketMessage) => void;
  private onLevelsChange: (levels: { mic: number; system: number }) => void;
  private audioCtx: AudioContext | null = null;
  private analyserMic: AnalyserNode | null = null;
  private analyserSys: AnalyserNode | null = null;
  private animationId: number | null = null;

  constructor(
    onMessage: (msg: WebSocketMessage) => void,
    onLevels: (levels: { mic: number; system: number }) => void,
  ) {
    this.onMessageCallback = onMessage;
    this.onLevelsChange = onLevels;
  }

  async start(
    sessionId: string,
    title: string,
    participants: Participant[],
    preMicStream?: MediaStream | null,
    preSystemStream?: MediaStream | null,
  ): Promise<void> {
    try {
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

      // 3. Mix using AudioContext
      this.audioCtx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      const dest = this.audioCtx.createMediaStreamDestination();

      const micSource = this.audioCtx.createMediaStreamSource(this.micStream);
      this.analyserMic = this.audioCtx.createAnalyser();
      micSource.connect(this.analyserMic);
      micSource.connect(dest);

      const sysSource = this.audioCtx.createMediaStreamSource(
        this.systemStream,
      );
      this.analyserSys = this.audioCtx.createAnalyser();
      sysSource.connect(this.analyserSys);
      sysSource.connect(dest);

      this.mixedStream = dest.stream;

      // 4. Start level monitoring
      this.startLevelMonitoring();

      // 5. WebSocket connection
      // For local development use ws://localhost:8000
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host =
        process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, "") ||
        "localhost:8000";
      this.ws = new WebSocket(`${protocol}//${host}/ws/record/${sessionId}`);

      this.ws.onopen = () => {
        // Send initial metadata
        this.ws?.send(
          JSON.stringify({
            type: "metadata",
            title,
            participants,
          }),
        );

        // 6. Record mixed stream
        this.recorder = new MediaRecorder(this.mixedStream!, {
          mimeType: "audio/webm",
        });

        this.recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(e.data);
          }
        };

        this.recorder.start(1000); // 1-second chunks
      };

      this.ws.onmessage = (e) => {
        const msg: WebSocketMessage = JSON.parse(e.data);
        this.onMessageCallback(msg);
      };

      this.ws.onerror = (e) => {
        console.error("WebSocket error:", e);
        this.onMessageCallback({
          stage: "error",
          message: "WebSocket connection failed",
        });
      };

      this.ws.onclose = () => {
        console.log("WebSocket closed");
      };
    } catch (err: any) {
      this.cleanup();
      throw err;
    }
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

      this.onLevelsChange({
        mic: Math.min(100, micLevel * 2),
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
  }
}
