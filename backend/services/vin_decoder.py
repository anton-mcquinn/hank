import logging
import httpx

logger = logging.getLogger(__name__)


async def get_vehicle_info(vin):
    """Get vehicle information from NHTSA API"""
    link = f"https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/{vin}?format=json"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(link)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error("NHTSA API error for VIN %s: %s", vin, response.text)
                return {}
    except httpx.RequestError as e:
        logger.error("Network error decoding VIN %s: %s", vin, e)
        return {}
