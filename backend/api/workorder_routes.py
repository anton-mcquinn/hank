import logging
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from typing import List, Dict, Any, Optional
import uuid
from pydantic import BaseModel
from datetime import datetime
import os
import aiofiles
from sqlalchemy.orm import Session

from api.models import WorkOrder, Customer, Vehicle, WorkOrderUpdate
from api.auth_dependencies import get_current_user
from services.audio import transcribe_audio
from services.image import (
    extract_vin_from_image,
    read_odometer_image,
    read_plate_from_image,
)
from services.generate import generate_work_summary
from services.vehicle_info import get_year_make_model
from database.repos import WorkOrderRepository, CustomerRepository, VehicleRepository
from database.db import get_db

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])

# Resolved at import time from environment — not accepted from clients
_UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
_OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Upload validation constants
_MAX_AUDIO_BYTES = 50 * 1024 * 1024   # 50 MB
_MAX_IMAGE_BYTES = 10 * 1024 * 1024   # 10 MB
_ALLOWED_AUDIO_EXT = {".m4a", ".mp3", ".wav", ".ogg", ".webm", ".mp4"}
_ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".gif", ".webp"}


class WorkOrderWithRelations(BaseModel):
    """Extended work order model that includes related customer and vehicle data"""

    id: str
    customer_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    vehicle_info: Dict[str, Any] = {}
    work_summary: str = ""
    line_items: List[Dict[str, Any]] = []
    total_parts: float = 0
    total_labor: float = 0
    total: float = 0
    status: str = "processing"
    created_at: datetime
    updated_at: datetime
    customer: Optional[Customer] = None
    vehicle: Optional[Vehicle] = None

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda dt: dt.isoformat()}


def _validate_upload(file: UploadFile, content: bytes, max_bytes: int, allowed_ext: set, label: str):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail=f"{label}: unsupported file type '{ext}'")
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"{label}: file exceeds {max_bytes // (1024*1024)} MB limit")


@router.post("/work-orders/create", response_model=dict)
async def create_work_order(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    audio_files: List[UploadFile] = File(None),
    vin_image: UploadFile = File(None),
    odometer_image: UploadFile = File(None),
    plate_image: UploadFile = File(None),
    customer_id: Optional[str] = Form(None),
    customer_name: Optional[str] = Form(None),
    customer_phone: Optional[str] = Form(None),
    customer_email: Optional[str] = Form(None),
    vehicle_id: Optional[str] = Form(None),
):
    """Create a new work order from audio files and images"""
    try:
        # Generate work order ID
        order_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()

        # Prepare work order data
        work_order_data = {
            "id": order_id,
            "created_at": timestamp,
            "updated_at": timestamp,
            "status": "processing",
            "work_summary": "Processing audio...",
            "line_items": [],
            "total_parts": 0,
            "total_labor": 0,
            "total": 0,
            "vehicle_info": {},
            "processing_notes": ["Work order created, processing media files..."],
        }

        # If customer ID provided, verify customer exists
        if customer_id:
            customer = CustomerRepository.get_by_id(db, customer_id)
            if not customer:
                raise HTTPException(status_code=404, detail="Customer not found")
            work_order_data["customer_id"] = customer_id
            work_order_data["customer_name"] = (
                f"{customer.first_name} {customer.last_name}"
            )

        # If vehicle ID provided, verify vehicle exists
        if vehicle_id:
            vehicle = VehicleRepository.get_by_id(db, vehicle_id)
            if not vehicle:
                raise HTTPException(status_code=404, detail="Vehicle not found")
            work_order_data["vehicle_id"] = vehicle_id

        # Save work order to database
        WorkOrderRepository.create(db, work_order_data)

        # Read and validate file contents before they get closed
        audio_contents = []
        audio_filenames = []
        if audio_files:
            for audio_file in audio_files:
                if audio_file and audio_file.filename:
                    content = await audio_file.read()
                    _validate_upload(audio_file, content, _MAX_AUDIO_BYTES, _ALLOWED_AUDIO_EXT, "Audio file")
                    audio_contents.append(content)
                    audio_filenames.append(audio_file.filename)

        vin_content = None
        vin_filename = None
        if vin_image and vin_image.filename:
            vin_content = await vin_image.read()
            _validate_upload(vin_image, vin_content, _MAX_IMAGE_BYTES, _ALLOWED_IMAGE_EXT, "VIN image")
            vin_filename = vin_image.filename

        odometer_content = None
        odometer_filename = None
        if odometer_image and odometer_image.filename:
            odometer_content = await odometer_image.read()
            _validate_upload(odometer_image, odometer_content, _MAX_IMAGE_BYTES, _ALLOWED_IMAGE_EXT, "Odometer image")
            odometer_filename = odometer_image.filename

        plate_content = None
        plate_filename = None
        if plate_image and plate_image.filename:
            plate_content = await plate_image.read()
            _validate_upload(plate_image, plate_content, _MAX_IMAGE_BYTES, _ALLOWED_IMAGE_EXT, "Plate image")
            plate_filename = plate_image.filename

        # Process uploads in background with file contents instead of file objects
        background_tasks.add_task(
            process_uploads,
            order_id,
            audio_contents,
            audio_filenames,
            vin_content,
            vin_filename,
            odometer_content,
            odometer_filename,
            plate_content,
            plate_filename,
            customer_id,
            customer_name,
            customer_phone,
            customer_email,
        )

        return {
            "order_id": order_id,
            "message": "Work order created. Files are being processed.",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating work order: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


async def process_uploads(
    order_id,
    audio_contents,
    audio_filenames,
    vin_content,
    vin_filename,
    odometer_content,
    odometer_filename,
    plate_content,
    plate_filename,
    customer_id,
    customer_name,
    customer_phone,
    customer_email,
):
    """Process uploaded file contents and update work order"""
    db = None
    try:
        # Create a new database session for background task
        db = next(get_db())

        # Get work order
        work_order = WorkOrderRepository.get_by_id(db, order_id)
        if not work_order:
            logger.error("Work order %s not found", order_id)
            return

        WorkOrderRepository.update(
            db, order_id, {"processing_notes": ["Processing started..."]}
        )
        # Process vehicle information images
        vehicle_info = work_order.vehicle_info or {}
        update_data = {
            "processing_notes": work_order.processing_notes or [],
        }

        # Process VIN image
        vin = None
        if vin_content:
            try:
                # Ensure directory exists
                os.makedirs(os.path.join(_UPLOAD_DIR, "images"), exist_ok=True)

                vin_path = os.path.join(
                    _UPLOAD_DIR,
                    "images",
                    f"{order_id}_vin{os.path.splitext(vin_filename)[1]}",
                )
                logger.info("Processing VIN image for order %s", order_id)
                async with aiofiles.open(vin_path, "wb") as f:
                    await f.write(vin_content)

                vin = await extract_vin_from_image(vin_path)
                update_data["processing_notes"].append("VIN image processed")

                if vin:
                    vehicle_info["vin"] = vin
                    vehicle_info.update(await get_year_make_model(vin))
                    update_data["processing_notes"].append("VIN decoded successfully")
                    logger.info("Vehicle info decoded for order %s", order_id)
                else:
                    update_data["processing_notes"].append(
                        "VIN extraction failed - manual entry required"
                    )

            except Exception as e:
                update_data["processing_notes"].append(f"VIN error: {str(e)[:100]}")
                logger.error("VIN processing error for order %s: %s", order_id, e)

        # Process odometer image
        odometer = None
        if odometer_content:
            try:
                os.makedirs(os.path.join(_UPLOAD_DIR, "images"), exist_ok=True)
                odo_path = os.path.join(
                    _UPLOAD_DIR,
                    "images",
                    f"{order_id}_odo{os.path.splitext(odometer_filename)[1]}",
                )
                logger.info("Processing odometer image for order %s", order_id)
                async with aiofiles.open(odo_path, "wb") as f:
                    await f.write(odometer_content)
                odometer = await read_odometer_image(odo_path)
                update_data["processing_notes"].append("Odometer image processed")

                if odometer:
                    vehicle_info["mileage"] = odometer
                else:
                    update_data["processing_notes"].append(
                        "Odometer extraction failed - manual entry required"
                    )
                    logger.warning("Odometer extraction failed for order %s", order_id)

            except Exception as e:
                logger.error("Odometer processing error for order %s: %s", order_id, e)
                update_data["processing_notes"].append(
                    f"Odometer error: {str(e)[:100]}"
                )

        plate = None
        if plate_content:
            try:
                os.makedirs(os.path.join(_UPLOAD_DIR, "images"), exist_ok=True)
                plate_path = os.path.join(
                    _UPLOAD_DIR,
                    "images",
                    f"{order_id}_plate{os.path.splitext(plate_filename)[1]}",
                )
                logger.info("Processing plate image for order %s", order_id)
                async with aiofiles.open(plate_path, "wb") as f:
                    await f.write(plate_content)
                plate = await read_plate_from_image(plate_path)
                update_data["processing_notes"].append("Plate image processed")
                if plate:
                    vehicle_info["plate"] = plate
                    update_data["processing_notes"].append("Plate decoded successfully")

            except Exception as e:
                logger.error("Plate processing error for order %s: %s", order_id, e)
                update_data["processing_notes"].append(f"Plate error: {str(e)[:100]}")
                # If plate extraction fails, we can still proceed without it

        # Process customer info if we have it
        if not customer_id and (customer_name or customer_phone or customer_email):
            # Try to find existing customer by phone or email
            logger.info("Looking for existing customer for order %s", order_id)
            customer = None
            if customer_phone:
                customer = CustomerRepository.get_by_phone(db, customer_phone)
            if not customer and customer_email:
                customer = CustomerRepository.get_by_email(db, customer_email)

            if customer:
                # Use existing customer
                logger.info("Found existing customer for order %s", order_id)
                if customer.id is None:
                    id = str(uuid.uuid4())
                    customer = CustomerRepository.update(db, id, {"id": id})
                    customer_id = customer.id
            elif customer_name:
                # Create new customer if we have at least a name
                name_parts = customer_name.split(maxsplit=1)
                first_name = name_parts[0]
                last_name = name_parts[1] if len(name_parts) > 1 else ""

                customer_data = {
                    "id": str(uuid.uuid4()),
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": customer_email or "",
                    "phone": customer_phone or "",
                    "address": "",  # Default empty address
                }

                customer = CustomerRepository.create(db, customer_data)
                customer_id = customer.id
                logger.info("Created new customer for order %s", order_id)

        if vehicle_info:
            update_data["vehicle_info"] = vehicle_info
            update_data["processing_notes"].append("Saved partial vehicle info")
        # Process vehicle info if we have it
        vehicle_id = work_order.vehicle_id
        if not vehicle_id and customer_id:
            try:
                if vin:
                    existing_vehicle = VehicleRepository.get_by_vin(db, vin)

                    if existing_vehicle:
                        logger.info("Found existing vehicle for order %s", order_id)
                        update_data["processing_notes"].append("Found existing vehicle")
                        vehicle_id = existing_vehicle.id

                        update_fields = {}
                        if plate:
                            update_fields["plate"] = plate
                        if odometer and int(odometer) > (existing_vehicle.mileage or 0):
                            update_fields["mileage"] = int(odometer)
                        if update_fields:
                            VehicleRepository.update(db, vehicle_id, update_fields)
                    else:
                        # Create new vehicle
                        vehicle_data = {
                            "id": str(uuid.uuid4()),
                            "customer_id": customer_id,
                            "vin": vin,
                            "year": vehicle_info.get("year"),
                            "make": vehicle_info.get("make"),
                            "model": vehicle_info.get("model"),
                            "mileage": odometer,
                            "plate": plate,
                        }

                        new_vehicle = VehicleRepository.create(db, vehicle_data)
                        vehicle_id = new_vehicle.id
                        update_data["processing_notes"].append(
                            "Created new vehicle with partial info"
                        )
                        logger.info("Created new vehicle for order %s", order_id)
                else:
                    # placeholder vehicle with minimal info
                    if vehicle_info and (
                        vehicle_info.get("make") or vehicle_info.get("model")
                    ):
                        vehicle_data = {
                            "id": str(uuid.uuid4()),
                            "customer_id": customer_id,
                            "year": vehicle_info.get("year"),
                            "make": vehicle_info.get("make"),
                            "model": vehicle_info.get("model"),
                            "mileage": vehicle_info.get("mileage"),
                            "plate": vehicle_info.get("plate"),
                        }
                        new_vehicle = VehicleRepository.create(db, vehicle_data)
                        vehicle_id = new_vehicle.id
                        update_data["processing_notes"].append(
                            "Created new vehicle with partial info"
                        )
            except Exception as e:
                logger.error("Error creating vehicle for order %s: %s", order_id, e)
                update_data["processing_notes"].append(
                    f"Vehicle creation error: {str(e)[:100]}"
                )
                # If there's an error, we can still proceed without vehicle ID

        # Update work order with customer and vehicle IDs
        if customer_id or vehicle_id:
            update_fields = {}
            if customer_id:
                update_fields["customer_id"] = customer_id
            if vehicle_id:
                update_fields["vehicle_id"] = vehicle_id

            WorkOrderRepository.update(db, order_id, update_fields)
            update_data["processing_notes"].append("Updated work order references")

        # Process audio files
        all_transcripts = []
        if audio_contents:
            # Create audio directory if it doesn't exist
            os.makedirs(os.path.join(_UPLOAD_DIR, "audio"), exist_ok=True)

            for i, (audio_content, audio_filename) in enumerate(
                zip(audio_contents, audio_filenames)
            ):
                # Skip if None
                if audio_content is None or audio_filename is None:
                    continue

                try:
                    # Get file extension from the original filename
                    _, ext = os.path.splitext(audio_filename)

                    # Create the file path with proper extension
                    audio_path = os.path.join(
                        _UPLOAD_DIR,
                        "audio",
                        f"{order_id}_{i}{ext}",
                    )

                    # Write the content to disk using aiofiles
                    logger.info("Writing audio file %d for order %s", i, order_id)
                    async with aiofiles.open(audio_path, "wb") as f:
                        await f.write(audio_content)

                    # Now process the file on disk
                    if os.path.exists(audio_path) and os.path.getsize(audio_path) > 0:
                        transcript = await transcribe_audio(audio_path, _OPENAI_API_KEY)
                        if transcript:
                            all_transcripts.append(transcript)
                    else:
                        logger.warning("Audio file not saved properly: %s", audio_path)
                except Exception as e:
                    logger.error("Error processing audio file %d for order %s: %s", i, order_id, e)

        # Generate work summary if transcripts available
        if all_transcripts:
            full_transcript = " ".join(all_transcripts)
            summary_data = await generate_work_summary(full_transcript, vehicle_info)

            # Update work order with summary data
            logger.info("Work summary generated for order %s", order_id)
            update_data.update(
                {
                    "vehicle_info": vehicle_info,
                    "work_summary": summary_data.get("work_summary", ""),
                    "line_items": summary_data.get("line_items", []),
                    "total_parts": summary_data.get("total_parts", 0),
                    "total_labor": summary_data.get("total_labor", 0),
                    "total": summary_data.get("total", 0),
                    "status": "processed",
                }
            )
        else:
            # If we have vehicle info but no transcripts, still mark as processed
            if vehicle_info:
                update_data["status"] = "processed"

        if "vin" not in vehicle_info or not vehicle_id:
            update_data["status"] = "needs_review"
        else:
            update_data["status"] = "processed"

        if "status" not in update_data or update_data["status"] == "processing":
            if vehicle_info and "vin" in vehicle_info:
                update_data["status"] = "processed"
            else:
                update_data["status"] = "needs_review"

        WorkOrderRepository.update(db, order_id, update_data)
        logger.info("Work order %s updated with status: %s", order_id, update_data["status"])

    except Exception as e:
        logger.error("Error processing uploads for order %s: %s", order_id, e)
        if db is not None:
            try:
                WorkOrderRepository.update(
                    db,
                    order_id,
                    {
                        "status": "needs_review",
                        "processing_notes": ["Processing error - please review manually"],
                    },
                )
            except Exception as update_error:
                logger.error("Error updating work order status: %s", update_error)
    finally:
        if db is not None:
            db.close()


@router.get("/work-orders/{order_id}", response_model=WorkOrder)
async def get_work_order(order_id: str, db: Session = Depends(get_db)):
    """Get a work order by ID with customer and vehicle details"""
    work_order = WorkOrderRepository.get_by_id(db, order_id)
    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")

    response = WorkOrderWithRelations.from_orm(work_order)

    if work_order.customer_id:
        customer = CustomerRepository.get_by_id(db, work_order.customer_id)
        if customer:
            response.customer = Customer.from_orm(customer)

    if work_order.vehicle_id:
        vehicle = VehicleRepository.get_by_id(db, work_order.vehicle_id)
        if vehicle:
            response.vehicle = Vehicle.from_orm(vehicle)

    return response


@router.get("/work-orders", response_model=List[WorkOrder])
async def list_work_orders(db: Session = Depends(get_db)):
    """List all work orders"""
    return WorkOrderRepository.get_all(db)


@router.get("/customers/{customer_id}/work-orders", response_model=List[WorkOrder])
async def get_customer_work_orders(customer_id: str, db: Session = Depends(get_db)):
    """Get all work orders for a customer"""
    # Verify customer exists
    customer = CustomerRepository.get_by_id(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    return WorkOrderRepository.get_by_customer(db, customer_id)


@router.put("/work-orders/{order_id}", response_model=WorkOrder)
async def update_work_order(
    order_id: str, work_order: WorkOrderUpdate, db: Session = Depends(get_db)
):
    """Update a work order"""
    updated_work_order = WorkOrderRepository.update(
        db, order_id, work_order.dict(exclude_unset=True)
    )
    if not updated_work_order:
        raise HTTPException(status_code=404, detail="Work order not found")
    return updated_work_order


@router.delete("/work-orders/{order_id}")
async def delete_work_order(order_id: str, db: Session = Depends(get_db)):
    """Delete a work order"""
    result = WorkOrderRepository.delete(db, order_id)
    if not result:
        raise HTTPException(status_code=404, detail="Work order not found")
    return {"message": "Work order deleted"}
