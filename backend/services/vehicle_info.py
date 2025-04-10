from api.models import VehicleBase
from .vin_decoder import get_vehicle_info


async def get_year_make_model(vin: str) -> VehicleBase:
    """Get year, make, and model from VIN"""
    response = await get_vehicle_info(vin)

    # Make sure we have Results in the response
    if not response or "Results" not in response:
        print(f"Invalid response for VIN: {vin}")
        return VehicleBase(
            id="", customer_id="", vin=vin, year=None, make=None, model=None
        )

    results = response["Results"]
    year = None
    make = None
    model = None
    engine_size = None
    cylinders = None

    # Loop through all the result items to find what we need
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
        elif variable == "Displacement (L)":  # Engine size
            engine_size = item.get("Value")

    # Debug info
    print(f"VIN: {vin}, Year: {year}, Make: {make}, Model: {model}, Engine Size: {engine_size}, Engine Code: {engine_code}")

    return VehicleBase(
        id="", customer_id="", vin=vin, year=year, make=make, model=model, engine_size=engine_size, engine_code=engine_code
    )
