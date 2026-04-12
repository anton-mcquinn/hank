import httpx
import json
import logging
import os
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


async def generate_work_summary(transcript, vehicle_info):
    """Generate a structured work summary from the transcript"""
    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENAI_API_KEY}",
            }

            vehicle_context = ""
            if vehicle_info:
                vehicle_context = f"Vehicle information: VIN {vehicle_info.get('vin', 'unknown')}, Mileage: {vehicle_info.get('mileage', 'unknown')}"

            prompt = f"""
            Based on the following voice memo transcript from an auto technician, create:
            1. A summary of work performed
                * Note: if the audio mentions that this is an estimate, make sure to note that this isn't actually work performed, but work that needs to be performed.
            2. A detailed list of parts used with prices
            3. An estimate of labor hours and cost (assume $50/hour)
            4. A total estimate
            5. If there are recommendations made to the customer to take later, outline these because this is where the customer will read them.
            6. Shoot for 400 words
            7. Don't repeat vehicle information in the summary like VIN or YMM.

            {vehicle_context}

            Voice memo transcript:
            {transcript}

            Format the response as JSON with these fields:
            {{
                "work_summary": "Brief description of work done",
                "line_items": [
                    {{"description": "Part or labor description", "type": "part|labor", "quantity": number, "unit_price": number, "total": number}}
                ],
                "total_parts": number,
                "total_labor": number,
                "total": number
            }}
            """

            payload = {
                "model": "gpt-4o",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an expert auto repair service writer who converts technician notes into professional work orders.",
                    },
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.1,
                "response_format": {"type": "json_object"},
            }

            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30.0,
            )

            if response.status_code == 200:
                result = response.json()["choices"][0]["message"]["content"]
                try:
                    return json.loads(result)
                except json.JSONDecodeError:
                    logger.error("Failed to parse JSON from OpenAI response")
                    return {
                        "work_summary": "Error parsing work summary",
                        "line_items": [],
                        "total_parts": 0,
                        "total_labor": 0,
                        "total": 0,
                    }
            else:
                logger.error("OpenAI API error: %s", response.status_code)
                return {
                    "work_summary": "Error generating work summary",
                    "line_items": [],
                    "total_parts": 0,
                    "total_labor": 0,
                    "total": 0,
                }
    except Exception as e:
        logger.error("Error generating work summary: %s", e)
        return {
            "work_summary": "Error generating work summary",
            "line_items": [],
            "total_parts": 0,
            "total_labor": 0,
            "total": 0,
        }
