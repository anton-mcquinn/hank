import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from datetime import datetime
from fastapi import UploadFile, File
import aiofiles
from api.models import Customer, CustomerCreate, CustomerUpdate, CustomerBase
from api.auth_dependencies import get_current_user
from database.db import get_db
from database.repos import CustomerRepository, VehicleRepository

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.post("/extract-customer-info", response_model=CustomerBase)
async def extract_customer_info(
    customer_image: UploadFile = File(None),
):
    """Extract customer info from an image without creating the customer"""
    try:
        # Validate image file
        if not customer_image:
            raise HTTPException(status_code=400, detail="Customer image is required")

        # Create a temporary file to store the uploaded image
        import os
        from services.image import extract_customer_info_from_image

        # Ensure upload directory exists
        UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
        os.makedirs(os.path.join(UPLOAD_DIR, "images"), exist_ok=True)

        # Save the uploaded file
        file_path = os.path.join(
            UPLOAD_DIR,
            "images",
            f"customer_{uuid.uuid4()}{os.path.splitext(customer_image.filename)[1]}",
        )

        # Read file content and save to disk
        content = await customer_image.read()
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)

        # Extract customer info from image using Vision API
        customer_info = await extract_customer_info_from_image(file_path)

        if not customer_info:
            raise HTTPException(
                status_code=422,
                detail="Could not extract customer information from image",
            )

        # Return the extracted customer info without creating in database
        return {
            "first_name": customer_info.get("first_name", ""),
            "last_name": customer_info.get("last_name", ""),
            "email": customer_info.get("email", ""),
            "phone": customer_info.get("phone", ""),
            "address": customer_info.get("address", ""),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error extracting customer info from image: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Error extracting customer information from image",
        )


@router.post("/customers", response_model=Customer)
async def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    existing = CustomerRepository.get_by_email(db, customer.email)
    if existing:
        raise HTTPException(
            status_code=400, detail="Customer with this email already exists"
        )

    customer_data = customer.model_dump()
    customer_data["id"] = str(uuid.uuid4())
    customer_data["created_at"] = datetime.now()
    customer_data["updated_at"] = datetime.now()

    return CustomerRepository.create(db, customer_data)


@router.post("/customers-image", response_model=Customer)
async def create_customer_image(
    customer_image: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    """Create a customer from an image"""
    try:
        # Validate image file
        if not customer_image:
            raise HTTPException(status_code=400, detail="Customer image is required")

        # Create a temporary file to store the uploaded image
        import os
        from services.image import extract_customer_info_from_image

        # Ensure upload directory exists
        UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
        os.makedirs(os.path.join(UPLOAD_DIR, "images"), exist_ok=True)

        # Save the uploaded file
        file_path = os.path.join(
            UPLOAD_DIR,
            "images",
            f"customer_{uuid.uuid4()}{os.path.splitext(customer_image.filename)[1]}",
        )

        # Read file content and save to disk
        content = await customer_image.read()
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)

        # Extract customer info from image using Vision API
        customer_info = await extract_customer_info_from_image(file_path)

        if not customer_info:
            raise HTTPException(
                status_code=422,
                detail="Could not extract customer information from image",
            )

        # Create customer data
        customer_data = {
            "id": str(uuid.uuid4()),
            "first_name": customer_info.get("first_name", ""),
            "last_name": customer_info.get("last_name", ""),
            "email": customer_info.get("email", ""),
            "phone": customer_info.get("phone", ""),
            "address": customer_info.get("address", ""),
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }

        # Check if email exists and is valid
        if customer_data["email"]:
            existing = CustomerRepository.get_by_email(db, customer_data["email"])
            if existing:
                raise HTTPException(
                    status_code=400, detail="Customer with this email already exists"
                )

        # Create the customer
        return CustomerRepository.create(db, customer_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating customer from image: %s", e)
        raise HTTPException(
            status_code=500, detail="Error creating customer from image"
        )


@router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str, db: Session = Depends(get_db)):
    """Get a customer by ID"""
    customer = CustomerRepository.get_by_id(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.get("/customers", response_model=List[Customer])
async def list_customers(db: Session = Depends(get_db)):
    """List all customers"""
    return CustomerRepository.get_all(db)


@router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(
    customer_id: str, customer: CustomerUpdate, db: Session = Depends(get_db)
):
    """Update a customer"""
    updated_customer = CustomerRepository.update(
        db, customer_id, customer.dict(exclude_unset=True)
    )
    if not updated_customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return updated_customer


@router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, db: Session = Depends(get_db)):
    """Delete a customer"""
    result = CustomerRepository.delete(db, customer_id)
    if not result:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted"}
