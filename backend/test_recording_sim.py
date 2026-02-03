
import asyncio
import websockets
import json
import os
import uuid

# Configuration
SERVER_URL = "ws://localhost:8000/ws/record"
AUDIO_FILE = "backend/temp_4202f462-5087-4e77-861f-e07dab593162.webm" # Adjust path if needed

async def test_recording():
    session_id = str(uuid.uuid4())
    uri = f"{SERVER_URL}/{session_id}"
    print(f"Connecting to {uri}...")
    
    # Check audio file
    if not os.path.exists(AUDIO_FILE):
        print(f"Error: Audio file {AUDIO_FILE} not found.")
        # Try finding any webm in backend
        files = [f for f in os.listdir('backend') if f.endswith('.webm') and f.startswith('temp_')]
        if files:
            print(f"Found alternative: backend/{files[0]}")
            audio_path = f"backend/{files[0]}"
        else:
            return
    else:
        audio_path = AUDIO_FILE

    async with websockets.connect(uri) as websocket:
        print("Connected.")
        
        # 1. Send Metadata
        metadata = {
            "type": "metadata",
            "participants": [
                {"name": "Tester", "email": "test@example.com"}
            ],
            "title": "Test Meeting"
        }
        await websocket.send(json.dumps({"text": json.dumps(metadata)}))
        print("Sent metadata.")
        
        # 2. Send Audio Chunks
        chunk_size = 1024 * 64 # 64KB
        total_bytes = 0
        
        with open(audio_path, "rb") as f:
            while True:
                data = f.read(chunk_size)
                if not data:
                    break
                await websocket.send(data) # library handles bytes as binary frame
                total_bytes += len(data)
                # Small sleep to simulate real-time streaming (optional, but good for testing)
                await asyncio.sleep(0.01)
        
        print(f"Sent {total_bytes} bytes of audio.")
        
        # 3. Send Stop Signal
        await websocket.send(json.dumps({"text": json.dumps({"type": "stop"})}))
        print("Sent stop signal. Waiting for response...")
        
        # 4. Receive Messages
        while True:
            try:
                message = await websocket.recv()
                data = json.loads(message)
                print(f"Received stage: {data.get('stage')}")
                
                if data.get('stage') == 'complete':
                    print("SUCCESS! Result:")
                    print(json.dumps(data.get('result'), indent=2))
                    break
                elif data.get('stage') == 'error':
                    print(f"ERROR: {data.get('message')}")
                    break
            except websockets.exceptions.ConnectionClosed:
                print("Connection closed.")
                break

if __name__ == "__main__":
    if not os.path.exists('backend'):
        # If running from inside backend dir
        if os.path.exists('main.py'):
            AUDIO_FILE = "temp_4202f462-5087-4e77-861f-e07dab593162.webm"
        else:
             print("Please run from root or backend directory correctly.")
    
    asyncio.get_event_loop().run_until_complete(test_recording())
