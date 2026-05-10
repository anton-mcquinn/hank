import httpx
import json
import logging
import os
import base64
import asyncio
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
VISION_API_KEY = os.getenv("OPENAI_API_KEY")


def _encode(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode("utf-8")


async def extract_vin_from_image(image_bytes: bytes):
    """Extract VIN from door placard image using Vision API"""
    retry_count = 0
    last_error = None
    while retry_count < 3:
        try:
            async with httpx.AsyncClient() as client:
                image_content = _encode(image_bytes)

                # Using OpenAI Vision for image analysis
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {VISION_API_KEY}",
                }
                payload = {
                    "model": "gpt-4o",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "Extract the VIN number from this door placard image. Only return the VIN, nothing else.",
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{image_content}"
                                    },
                                },
                            ],
                        }
                    ],
                    "max_tokens": 100,
                }
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=30.0,
                )

                if response.status_code == 200:
                    vin_text = response.json()["choices"][0]["message"][
                        "content"
                    ].strip()
                    logger.debug("VIN text: %s", vin_text)
                    # Typical VIN is 17 alphanumeric characters
                    # Extract just the VIN using simple validation
                    import re

                    vin_match = re.search(r"[A-HJ-NPR-Z0-9]{17}", vin_text)
                    logger.debug("VIN match: %s", vin_match)
                    if vin_match:
                        return vin_match.group(0)
                    retry_count += 1
                    if retry_count < 3:
                        logger.debug("No valid VIN found, retrying... (%d/3)", retry_count)
                        await asyncio.sleep(2)
                    continue
                else:
                    logger.warning("Vision API error: %s", response.status_code)
                    retry_count += 1
                    if retry_count < 3:
                        await asyncio.sleep(2)
                    continue
        except Exception as e:
            last_error = e
            logger.error("VIN extraction attempt %d failed: %s", retry_count + 1, e)
            retry_count += 1
            if retry_count < 3:
                await asyncio.sleep(2)

    logger.error("VIN extraction failed after 3 attempts. Last error: %s", last_error)
    return ""


async def read_odometer_image(image_bytes: bytes):
    """Extract odometer reading from image using Vision API"""
    try:
        async with httpx.AsyncClient() as client:
            image_content = _encode(image_bytes)

            # Using OpenAI Vision for odometer reading
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {VISION_API_KEY}",
            }
            payload = {
                "model": "gpt-4o",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Read the odometer value from this image. Return only the numeric value in miles, no text.",
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_content}"
                                },
                            },
                        ],
                    }
                ],
                "max_tokens": 100,
            }
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30.0,
            )

            if response.status_code == 200:
                mileage_text = response.json()["choices"][0]["message"][
                    "content"
                ].strip()
                logger.debug("Mileage text: %s", mileage_text)
                # Try to extract just the number
                import re

                mileage_match = re.search(r"[0-9,]+", mileage_text)
                logger.debug("Mileage match: %s", mileage_match)
                if mileage_match:
                    # Remove commas and convert to integer
                    return mileage_match.group(0).replace(",", "")
                return mileage_text
            else:
                logger.warning("Vision API error: %s", response.status_code)
                return ""
    except Exception as e:
        logger.error("Error processing odometer image: %s", e)
        return ""


async def read_plate_from_image(image_bytes: bytes):
    """Extract License Plate Number from image using Vision API"""
    try:
        async with httpx.AsyncClient() as client:
            image_content = _encode(image_bytes)

            # Using OpenAI Vision for image analysis
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {VISION_API_KEY}",
            }
            payload = {
                "model": "gpt-4o",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Extract the license plate number from this vehicle image. Only return the plate number, nothing else.",
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_content}"
                                },
                            },
                        ],
                    }
                ],
                "max_tokens": 100,
            }
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30.0,
            )

            if response.status_code == 200:
                license_text = response.json()["choices"][0]["message"][
                    "content"
                ].strip()
                logger.debug("License text: %s", license_text)
                return license_text
            else:
                logger.warning("Vision API error: %s", response.status_code)
                return ""
    except Exception as e:
        logger.error("Error processing plate image: %s", e)
        return ""


async def extract_customer_info_from_image(image_bytes: bytes):
    """Extract customer information from an image using Vision API"""
    try:
        async with httpx.AsyncClient() as client:
            image_content = _encode(image_bytes)

            # Using OpenAI Vision for image analysis
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {VISION_API_KEY}",
            }

            prompt = """
            Extract customer information from this image (like a business card or form).
            Return ONLY a JSON object with the following fields:
            {
                "first_name": "First name of the customer",
                "last_name": "Last name of the customer",
                "email": "Email address if visible",
                "phone": "Phone number if visible",
                "address": "Physical address if visible"
            }

            If any field is not visible or unclear, leave it as an empty string.
            """

            payload = {
                "model": "gpt-4o",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_content}"
                                },
                            },
                        ],
                    }
                ],
                "max_tokens": 300,
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
                    logger.error("Failed to parse JSON from Vision API response")
                    return None
            else:
                logger.warning("Vision API error: %s", response.status_code)
                return None
    except Exception as e:
        logger.error("Error extracting customer info from image: %s", e)
        return None
