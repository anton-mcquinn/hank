import io
import logging
import os
from openai import OpenAI
import asyncio
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai_client = OpenAI(api_key=OPENAI_API_KEY)


async def transcribe_audio(audio_bytes: bytes, filename: str, api_key=None):
    """Transcribe in-memory audio bytes using OpenAI Whisper API.

    `filename` is needed only so the OpenAI client can pick the right MIME type
    from the extension (e.g. .m4a, .wav).
    """
    try:
        loop = asyncio.get_running_loop()

        def transcribe():
            buf = io.BytesIO(audio_bytes)
            buf.name = filename
            response = openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=buf,
            )
            return response.text

        transcript = await loop.run_in_executor(None, transcribe)
        logger.debug("Audio transcription complete for %s", filename)
        return transcript

    except Exception as e:
        logger.error("Error transcribing audio %s: %s", filename, e)
        return ""
