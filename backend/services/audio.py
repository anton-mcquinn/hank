import logging
import os
from openai import OpenAI
import asyncio
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai_client = OpenAI(api_key=OPENAI_API_KEY)

async def transcribe_audio(file_path, api_key=None):
    """Transcribe an audio file using OpenAI Whisper API"""
    try:
        loop = asyncio.get_running_loop()

        def transcribe():
            with open(file_path, "rb") as audio_file:
                response = openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file
                )
                return response.text

        transcript = await loop.run_in_executor(None, transcribe)
        logger.debug("Audio transcription complete for %s", file_path)
        return transcript

    except Exception as e:
        logger.error("Error transcribing audio %s: %s", file_path, e)
        return ""
