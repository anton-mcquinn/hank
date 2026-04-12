from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from datetime import datetime

from api.auth_dependencies import get_current_user
from database.db import get_db

from api.models import Vehicle, VehicleCreate, VehicleUpdate
from database.repos import VehicleRepository, CustomerRepository

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.post("/vehicles", response_model=Vehicle)
async def create_vehicle(vehicle: VehicleCreate, db: Session = Depends(get_db)):
    customer = CustomerRepository.get_by_id(db, vehicle.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    if vehicle.vin:
        existing = VehicleRepository.get_by_vin(db, vehicle.vin)
        if existing:
            raise HTTPException(
                status_code=400, detail="Vehicle with this VIN already exists"
            )

    # Create vehicle
    vehicle_data = vehicle.dict()
    vehicle_data["id"] = str(uuid.uuid4())
    vehicle_data["created_at"] = datetime.now()
    vehicle_data["updated_at"] = datetime.now()

    return VehicleRepository.create(db, vehicle_data)


# Might eventually want to add ability to get vehicles by all the different traits. But for now by ID is fine.
@router.get("/vehicles/{vehicle_id}", response_model=Vehicle)
async def get_vehicle(vehicle_id: str, db: Session = Depends(get_db)):
    """Get a vehicle by ID"""
    vehicle = VehicleRepository.get_by_id(db, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@router.get("/customers/{customer_id}/vehicles", response_model=List[Vehicle])
async def get_customer_vehicles(customer_id: str, db: Session = Depends(get_db)):
    """Get all vehicles for a customer"""
    # Verify customer exists
    customer = CustomerRepository.get_by_id(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    return VehicleRepository.get_by_customer(db, customer_id)


@router.put("/vehicles/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(
    vehicle_id: str, vehicle: VehicleUpdate, db: Session = Depends(get_db)
):
    """Update a vehicle"""
    # If customer_id is being changed, verify the new customer exists
    if vehicle.customer_id:
        customer = CustomerRepository.get_by_id(db, vehicle.customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

    updated_vehicle = VehicleRepository.update(
        db, vehicle_id, vehicle.model_dump(exclude_unset=True)
    )
    if not updated_vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return updated_vehicle


@router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, db: Session = Depends(get_db)):
    """Delete a vehicle"""
    result = VehicleRepository.delete(db, vehicle_id)
    if not result:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"message": "Vehicle deleted"}
