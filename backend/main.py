import os
import json
import uuid
import logging
import contextlib
import gc
import shutil
import time
import asyncio
from typing import List, Optional, Dict
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from openai import OpenAI
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from dotenv import load_dotenv

# Force CPU mode for CTranslate2/faster-whisper to avoid CUDA library requirements
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
os.environ["CT2_CUDA_ALLOCATOR"] = "none"

load_dotenv()

# Logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Meeting Assistant API (Ollama Only)")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# LLM Configuration (Ollama Only)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1")
USE_OLLAMA = True # Forced

# Initialize OpenAI-compatible client for Ollama
client = OpenAI(
    base_url=OLLAMA_BASE_URL,
    api_key="ollama" 
)
logger.info(f"Using Ollama local LLM: {OLLAMA_MODEL}")

# Initialize local Whisper
try:
    from faster_whisper import WhisperModel
    # Use 'base' model for speed/accuracy balance on CPU
    # Force CPU mode to avoid CUDA library requirements
    whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
    logger.info("Loaded local Whisper model (base) on CPU")
except ImportError:
    logger.critical("faster-whisper not installed. Please run: pip install faster-whisper")
    whisper_model = None
    raise RuntimeError("faster-whisper is required for this configuration.")

sg = SendGridAPIClient(os.getenv("SENDGRID_API_KEY")) if os.getenv("SENDGRID_API_KEY") else None

# Models
class Task(BaseModel):
    task: str
    deadline: Optional[str] = None

class Participant(BaseModel):
    name: str
    email: EmailStr
    tasks: List[Task] = []

class ProcessingResult(BaseModel):
    meeting_summary: str
    transcript: str
    participants: List[Participant]

class ParticipantInput(BaseModel):
    name: str
    email: EmailStr

class TranscriptProcessRequest(BaseModel):
    transcript: str
    participants: List[ParticipantInput]
    meeting_title: Optional[str] = None

# System Prompt
SYSTEM_PROMPT = """You are a privacy-first AI meeting assistant.

Your role:
- Analyze a meeting transcript up to 45 minutes long
- Generate a concise Notion-style meeting summary
- Extract action items
- Assign tasks to participants
- Prepare structured data for email notifications
- Do NOT store or reference past meetings

TRANSCRIPT HANDLING RULES:
If input is from live audio (Whisper output):
- Expect filler words ("um", "uh", "like") and verbal timestamps
- Clean filler words during extraction but preserve semantic meaning
- Speaker diarization is unavailable; assume single stream or use paragraph breaks as speaker changes
- If provided with microphone mute events, insert [Microphone Muted] and [Microphone Unmuted] markers in the transcript at the appropriate time-based locations
- When microphone is muted, only system audio (other participants) was captured

If input is raw pasted text:
- Assume text is pre-edited (cleaner grammar)
- Look for markdown headers or bullet points that indicate agenda structure
- If text contains "Speaker Name:" prefixes, parse and preserve attribution

Rules:
- Do NOT invent tasks, decisions, or deadlines
- Be conservative in task extraction
- If task ownership is unclear, mark as 'Unassigned'
- IMPORTANT: You will receive a participants list. You MUST return the SAME participants in your output
- Each participant MUST have both "name" and "email" fields (never null or empty)
- If a participant has no tasks, return an empty tasks array []
- Output JSON only

Output schema:
{
  "meeting_summary": "string",
  "participants": [
    {
      "name": "string (required, never null)",
      "email": "string (required, never null)",
      "tasks": [
        {
          "task": "string",
          "deadline": "string or null"
        }
      ]
    }
  ]
}

CRITICAL: Return ALL participants from the input list, even if they have no tasks.
"""

@app.get("/health")
async def health():
    return {"status": "healthy", "llm": "ollama", "whisper": "faster-whisper"}

@app.post("/test-email")
async def test_email(email: EmailStr):
    if not sg:
        raise HTTPException(status_code=500, detail="SendGrid not configured")
    
    message = Mail(
        from_email=os.getenv("FROM_EMAIL"),
        to_emails=email,
        subject='Test Email from AI Meeting Assistant',
        plain_text_content='If you receive this, your email configuration is working correctly.'
    )
    try:
        sg.send(message)
        return {"status": "sent"}
    except Exception as e:
        logger.error(f"Email failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def transcribe_audio(file: UploadFile):
    """Transcribes audio using local Faster Whisper."""
    try:
        # Temporary save for API call, then delete
        temp_filename = f"temp_{file.filename}"
        with open(temp_filename, "wb") as buffer:
            chunk_size = 1024 * 1024 # 1MB chunks
            while content := await file.read(chunk_size):
                buffer.write(content)
        
        with open(temp_filename, "rb") as audio_file:
            if whisper_model:
                segments, info = whisper_model.transcribe(temp_filename, beam_size=5)
                transcript_text = " ".join([segment.text for segment in segments])
            else:
                 raise RuntimeError("Whisper model not initialized")
        
        # Immediate deletion
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        return transcript_text
    except Exception as e:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail="Transcription failed")

def send_participant_email(participant: Participant, summary: str):
    """Sends personalized email to participant."""
    if not sg or not participant.tasks:
        return
    
    tasks_html = "<ul>" + "".join([f"<li>{t.task} (Deadline: {t.deadline or 'N/A'})</li>" for t in participant.tasks]) + "</ul>"
    
    email_body = f"""
    Hi {participant.name},<br><br>
    Here’s a summary of the meeting:<br>
    {summary}<br><br>
    Your action items:<br>
    {tasks_html}<br><br>
    Thanks!
    """
    
    message = Mail(
        from_email=os.getenv("FROM_EMAIL"),
        to_emails=participant.email,
        subject='Your action items from today’s meeting',
        html_content=email_body
    )
    try:
        sg.send(message)
    except Exception as e:
        logger.error(f"Failed to send email to {participant.email}: {e}")

class MutingEvent(BaseModel):
    timestamp: int
    muted: bool

class MeetingSession:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.file_path = f"temp_{session_id}.webm"
        self.participants = []
        self.title = "Live Meeting"
        self.bytes_received = 0
        self.max_bytes = 100 * 1024 * 1024 # 100MB
        self.last_activity = time.time()
        self.is_finalized = False
        self.lock = asyncio.Lock()
        self.mute_events: List[Dict] = []  # Track mute/unmute events
        self.chunk_sequence: List[int] = []  # Track received chunk sequence numbers
        self.is_recording = False  # Track if actively recording

    def cleanup(self):
        if os.path.exists(self.file_path):
            try:
                os.remove(self.file_path)
                logger.info(f"Cleaned up session file: {self.file_path}")
            except Exception as e:
                logger.error(f"Cleanup failed for {self.file_path}: {e}")

class SessionManager:
    def __init__(self):
        self.sessions: Dict[str, MeetingSession] = {}

    def get_or_create(self, session_id: str) -> MeetingSession:
        if session_id not in self.sessions:
            self.sessions[session_id] = MeetingSession(session_id)
        return self.sessions[session_id]

    async def cleanup_loop(self):
        while True:
            await asyncio.sleep(60)
            now = time.time()
            to_delete = []
            for sid, sess in self.sessions.items():
                # 10 minutes timeout for active recording, 5 minutes for inactive
                timeout = 600 if sess.is_recording else 300
                if now - sess.last_activity > timeout:
                    to_delete.append(sid)
            for sid in to_delete:
                logger.info(f"Purging stale session: {sid}")
                self.sessions[sid].cleanup()
                del self.sessions[sid]

session_manager = SessionManager()

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(session_manager.cleanup_loop())

@contextlib.asynccontextmanager
async def secure_temp_file(suffix: str = ".webm"):
    """Context manager for secure temporary files with auto-cleanup."""
    file_id = uuid.uuid4()
    path = f"temp_{file_id}{suffix}"
    try:
        yield path
    finally:
        if os.path.exists(path):
            try:
                os.remove(path)
                logger.info(f"Cleaned up temp file: {path}")
            except Exception as e:
                logger.error(f"Failed to delete temp file {path}: {e}")

def chunk_transcript(text: str, chunk_size: int = 30000, overlap: int = 500) -> List[str]:
    """Chunks transcript for LLM analysis if it exceeds limit."""
    if len(text) <= chunk_size:
        return [text]
    
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start = end - overlap
    return chunks

async def analyze_transcript(transcript: str, participants_json: str, mute_events: List[Dict] = None) -> ProcessingResult:
    """Core analysis logic using LLM."""
    chunks = chunk_transcript(transcript)

    # Simple map-reduce: for now we just process the first chunk if it's too long,
    # or implement full map-reduce if needed. Given the 45m limit, 100k chars is a good limit.
    # For this implementation, we'll focus on the primary chunk or first 100k chars.
    full_text = transcript[:100000] # Cap at 100k chars for privacy/safety

    # Add mute events context if available
    mute_context = ""
    if mute_events and len(mute_events) > 0:
        mute_context = "\n\nMicrophone Mute Events (timestamps in milliseconds since epoch):\n"
        for event in mute_events:
            mute_context += f"- {event['timestamp']}: Microphone {'MUTED' if event['muted'] else 'UNMUTED'}\n"
        mute_context += "\nNote: When the microphone was muted, only system audio was captured. Insert [Microphone Muted] and [Microphone Unmuted] markers in the transcript at appropriate locations based on these timestamps.\n"

    response = client.chat.completions.create(
        model=OLLAMA_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Participants list: {participants_json}{mute_context}\n\nTranscript:\n{full_text}"}
        ],
        response_format={"type": "json_object"}
    )
    
    content = response.choices[0].message.content
    try:
        result_json = json.loads(content)
    except json.JSONDecodeError:
        # Fallback if model outputs text with markdown block
        logger.warning(f"JSON Decode failed, attempting cleanup. Content: {content[:100]}...")
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
            result_json = json.loads(content)
        else:
            raise HTTPException(status_code=500, detail="LLM failed to produce valid JSON")

    # Validate and clean participant data
    input_participants = json.loads(participants_json)
    cleaned_participants = []

    for p in result_json.get("participants", []):
        # Skip participants with null/None values
        if not p.get("name") or not p.get("email"):
            logger.warning(f"Skipping participant with missing data: {p}")
            continue

        # Ensure tasks is a list
        if "tasks" not in p or p["tasks"] is None:
            p["tasks"] = []

        cleaned_participants.append(p)

    # If no valid participants from LLM, use input participants with empty tasks
    if not cleaned_participants and input_participants:
        logger.warning("LLM returned no valid participants. Using input participants with empty tasks.")
        cleaned_participants = [
            {
                "name": p.get("name", "Unknown"),
                "email": p.get("email", "unknown@example.com"),
                "tasks": []
            }
            for p in input_participants
            if p.get("email")  # Only include if email exists
        ]

    result_json["participants"] = cleaned_participants
    result_json["transcript"] = transcript  # Add the full transcript to the result

    try:
        result = ProcessingResult(**result_json)
    except Exception as e:
        logger.error(f"Failed to validate ProcessingResult: {e}")
        logger.error(f"Result JSON: {json.dumps(result_json, indent=2)}")
        # Fallback: return empty result with summary
        result = ProcessingResult(
            meeting_summary=result_json.get("meeting_summary", "Meeting summary unavailable."),
            transcript=transcript,
            participants=[
                Participant(name=p["name"], email=p["email"], tasks=p.get("tasks", []))
                for p in cleaned_participants
            ]
        )

    # Email cleanup/memory management
    del full_text
    gc.collect()

    return result

@app.websocket("/ws/record/{session_id}")
async def websocket_record(websocket: WebSocket, session_id: str):
    await websocket.accept()
    sess = session_manager.get_or_create(session_id)
    logger.info(f"WebSocket connected for session: {session_id}")
    
    try:
        while True:
            data = await websocket.receive()
            sess.last_activity = time.time()
            
            if "bytes" in data:
                chunk = data["bytes"]
                async with sess.lock:
                    if sess.bytes_received + len(chunk) > sess.max_bytes:
                        await websocket.send_json({"stage": "error", "message": "Size limit exceeded (100MB)"})
                        break
                    
                    # Leak Prevention: Basic check for silence/empty chunk
                    if len(chunk) < 10: # Minimum headers
                        continue
                        
                    with open(sess.file_path, "ab") as f:
                        f.write(chunk)
                    
                    sess.bytes_received += len(chunk)
            
            elif "text" in data:
                payload = json.loads(data["text"])
                if payload.get("type") == "metadata":
                    sess.participants = payload.get("participants", [])
                    sess.title = payload.get("title", sess.title)
                    sess.is_recording = True  # Mark session as actively recording
                    logger.info(f"Session {session_id} metadata received. Recording started.")
                elif payload.get("type") == "chunk_seq":
                    seq = payload.get("seq")
                    if seq is not None:
                        sess.chunk_sequence.append(seq)
                        # Detect missing chunks
                        if len(sess.chunk_sequence) > 1:
                            expected = sess.chunk_sequence[-2] + 1
                            if seq != expected:
                                logger.warning(f"Session {session_id}: Missing chunks detected. Expected {expected}, got {seq}")
                elif payload.get("type") == "mute_event":
                    mute_event = {
                        "timestamp": payload.get("timestamp"),
                        "muted": payload.get("muted")
                    }
                    sess.mute_events.append(mute_event)
                    logger.info(f"Session {session_id}: Microphone {'muted' if mute_event['muted'] else 'unmuted'} at {mute_event['timestamp']}")
                elif payload.get("type") == "stop":
                    # Transcription
                    await websocket.send_json({"stage": "transcribing"})
                    
                    if not os.path.exists(sess.file_path) or sess.bytes_received == 0:
                        await websocket.send_json({"stage": "error", "message": "No audio captured"})
                        break

                    # Transcription with local whisper
                    with open(sess.file_path, "rb") as audio_file:
                        if whisper_model:
                             # faster-whisper accepts file path
                            segments, info = whisper_model.transcribe(sess.file_path, beam_size=5)
                            transcript = " ".join([segment.text for segment in segments])
                        else:
                             raise RuntimeError("Whisper model not initialized")
                    
                    # Analysis
                    await websocket.send_json({"stage": "analyzing"})
                    result = await analyze_transcript(
                        transcript,
                        json.dumps(sess.participants),
                        mute_events=sess.mute_events
                    )

                    # Emailing
                    participant_emails = {p['email'] for p in sess.participants}
                    for p_result in result.participants:
                        if p_result.email in participant_emails and p_result.tasks:
                            send_participant_email(p_result, result.meeting_summary)

                    await websocket.send_json({"stage": "complete", "result": result.model_dump()})
                    sess.is_finalized = True
                    sess.is_recording = False  # Mark recording as complete
                    break
                
    except Exception as e:
        logger.error(f"WebSocket error for {session_id}: {e}")
        try:
            await websocket.send_json({"stage": "error", "message": str(e)})
        except: pass
    finally:
        if sess.is_finalized:
            sess.cleanup()
            if session_id in session_manager.sessions:
                del session_manager.sessions[session_id]
        # Otherwise, keep session for 60s for possible reconnect
        await websocket.close()

@app.post("/process-transcript", response_model=ProcessingResult)
async def process_transcript(req: TranscriptProcessRequest):
    try:
        result = await analyze_transcript(req.transcript, json.dumps([p.dict() for p in req.participants]))
        
        # Emailing
        participant_emails = {p.email for p in req.participants}
        for p_result in result.participants:
            if p_result.email in participant_emails and p_result.tasks:
                send_participant_email(p_result, result.meeting_summary)
        
        return result
    except Exception as e:
        logger.error(f"Transcript processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
