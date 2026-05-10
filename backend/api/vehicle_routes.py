import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.auth_dependencies import get_current_user
from api.models import Vehicle, VehicleCreate, VehicleUpdate
from database.db import UserDB, get_db
from database.repos import (
    CustomerRepository,
    VehicleRepository,
    VehicleReminderRepository,
)
from services import storage

logger = logging.getLogger(__name__)

_MAX_PHOTO_BYTES = 10 * 1024 * 1024
_ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".gif", ".webp"}
_PRESIGN_TTL = 900

router = APIRouter()


@router.post("/vehicles", response_model=Vehicle)
async def create_vehicle(
    vehicle: VehicleCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    customer = CustomerRepository.get_by_id(db, current_user.id, vehicle.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    if vehicle.vin:
        existing = VehicleRepository.get_by_vin(db, current_user.id, vehicle.vin)
        if existing:
            raise HTTPException(
                status_code=400, detail="Vehicle with this VIN already exists"
            )

    vehicle_data = vehicle.dict()
    vehicle_data["id"] = str(uuid.uuid4())
    vehicle_data["created_at"] = datetime.now()
    vehicle_data["updated_at"] = datetime.now()

    return VehicleRepository.create(db, current_user.id, vehicle_data)


@router.get("/vehicles/{vehicle_id}", response_model=Vehicle)
async def get_vehicle(
    vehicle_id: str,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Get a vehicle by ID"""
    vehicle = VehicleRepository.get_by_id(db, current_user.id, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@router.get("/customers/{customer_id}/vehicles", response_model=List[Vehicle])
async def get_customer_vehicles(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Get all vehicles for a customer"""
    customer = CustomerRepository.get_by_id(db, current_user.id, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    return VehicleRepository.get_by_customer(db, current_user.id, customer_id)


@router.put("/vehicles/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(
    vehicle_id: str,
    vehicle: VehicleUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Update a vehicle"""
    if vehicle.customer_id:
        customer = CustomerRepository.get_by_id(db, current_user.id, vehicle.customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

    updated_vehicle = VehicleRepository.update(
        db, current_user.id, vehicle_id, vehicle.model_dump(exclude_unset=True)
    )
    if not updated_vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return updated_vehicle


@router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(
    vehicle_id: str,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Delete a vehicle"""
    result = VehicleRepository.delete(db, current_user.id, vehicle_id)
    if not result:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"message": "Vehicle deleted"}


# ---------- Vehicle reminders (text-first, optional photo) ----------


class VehicleReminder(BaseModel):
    id: str
    title: str
    body: Optional[str] = None
    photo_url: Optional[str] = None
    created_at: datetime

    class Config:
        json_encoders = {datetime: lambda dt: dt.isoformat()}


def _to_reminder(row) -> VehicleReminder:
    return VehicleReminder(
        id=row.id,
        title=row.title,
        body=row.body,
        photo_url=storage.presigned_url(row.photo_key, expires=_PRESIGN_TTL) if row.photo_key else None,
        created_at=row.created_at,
    )


@router.post("/vehicles/{vehicle_id}/reminders", response_model=VehicleReminder)
async def create_reminder(
    vehicle_id: str,
    title: str = Form(...),
    body: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    if not VehicleRepository.get_by_id(db, current_user.id, vehicle_id):
        raise HTTPException(status_code=404, detail="Vehicle not found")

    title = title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")

    photo_key: Optional[str] = None
    photo_content_type: Optional[str] = None
    if photo and photo.filename:
        ext = Path(photo.filename).suffix.lower()
        if ext not in _ALLOWED_EXT:
            raise HTTPException(status_code=400, detail=f"Unsupported image type '{ext}'")
        content = await photo.read()
        if len(content) > _MAX_PHOTO_BYTES:
            raise HTTPException(status_code=413, detail="Photo exceeds 10 MB limit")

        reminder_id = str(uuid.uuid4())
        photo_key = f"vehicle-reminders/{current_user.id}/{vehicle_id}/{reminder_id}{ext}"
        photo_content_type = "image/jpeg" if ext in (".jpg", ".jpeg") else f"image/{ext.lstrip('.')}"
        storage.put("private", photo_key, content, content_type=photo_content_type)
    else:
        reminder_id = str(uuid.uuid4())

    row = VehicleReminderRepository.create(
        db,
        current_user.id,
        {
            "id": reminder_id,
            "vehicle_id": vehicle_id,
            "title": title,
            "body": (body or "").strip() or None,
            "photo_key": photo_key,
            "photo_content_type": photo_content_type,
        },
    )
    return _to_reminder(row)


@router.get("/vehicles/{vehicle_id}/reminders", response_model=List[VehicleReminder])
def list_reminders(
    vehicle_id: str,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    if not VehicleRepository.get_by_id(db, current_user.id, vehicle_id):
        raise HTTPException(status_code=404, detail="Vehicle not found")
    rows = VehicleReminderRepository.list_for_vehicle(db, current_user.id, vehicle_id)
    return [_to_reminder(r) for r in rows]


@router.delete("/vehicles/{vehicle_id}/reminders/{reminder_id}")
def delete_reminder(
    vehicle_id: str,
    reminder_id: str,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    row = VehicleReminderRepository.get_by_id(db, current_user.id, reminder_id)
    if not row or row.vehicle_id != vehicle_id:
        raise HTTPException(status_code=404, detail="Reminder not found")
    if row.photo_key:
        try:
            storage.delete("private", row.photo_key)
        except Exception as e:  # noqa: BLE001 — best effort
            logger.warning("Failed to delete reminder photo %s: %s", row.photo_key, e)
    VehicleReminderRepository.delete(db, current_user.id, reminder_id)
    return {"message": "Reminder deleted"}
