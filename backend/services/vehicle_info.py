import logging
from api.models import VehicleBase
from .vin_decoder import get_vehicle_info

logger = logging.getLogger(__name__)


async def get_year_make_model(vin: str) -> VehicleBase:
    """Get year, make, and model from VIN"""
    response = await get_vehicle_info(vin)

    if not response or "Results" not in response:
        logger.warning("Invalid response for VIN: %s", vin)
        return VehicleBase(
            id="", customer_id="", vin=vin, year=None, make=None, model=None
        )

    results = response["Results"]
    year = None
    make = None
    model = None
    engine_size = None
    engine_code = None

    for item in results:
        if not isinstance(item, dict):
            continue
        variable = item.get("Variable")
        if not variable:
            continue
        if variable == "Model Year":
            year = item.get("Value")
        elif variable == "Make":
            make = item.get("Value")
        elif variable == "Model":
            model = item.get("Value")
        elif variable == "Engine Model":
            engine_code = item.get("Value")
        elif variable == "Displacement (L)":
            engine_size = item.get("Value")

    logger.info("VIN decoded: %s → %s %s %s (engine: %s)", vin, year, make, model, engine_size)

    return VehicleBase(
        id="", customer_id="", vin=vin, year=year, make=make, model=model,
        engine_size=engine_size, engine_code=engine_code
    )
