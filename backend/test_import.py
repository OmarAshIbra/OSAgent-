import sys
print(f"Python executable: {sys.executable}")
try:
    from faster_whisper import WhisperModel
    print("Successfully imported faster_whisper")
except Exception as e:
    print(f"Failed to import: {e}")
    import traceback
    traceback.print_exc()
