import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import os
from pathlib import Path

from api.auth_dependencies import get_current_user
from database.db import UserDB, get_db
from database.repos import WorkOrderRepository, CustomerRepository, VehicleRepository, ShopSettingsRepository
from services.invoice_generator_html import (
    generate_invoice_html,
    generate_pdf_with_reportlab,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class EmailRequest(BaseModel):
    """Request model for generating and sending invoices"""

    email: Optional[str] = None
    generate_pdf: bool = False
    send_email: bool = False


@router.post("/work-orders/{order_id}/generate-invoice")
async def generate_invoice(
    order_id: str,
    request: EmailRequest,
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    work_order = WorkOrderRepository.get_by_id(db, current_user.id, order_id)
    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")

    customer = None
    if work_order.customer_id:
        customer = CustomerRepository.get_by_id(db, current_user.id, work_order.customer_id)

    vehicle = None
    if work_order.vehicle_id:
        vehicle = VehicleRepository.get_by_id(db, current_user.id, work_order.vehicle_id)

    shop = ShopSettingsRepository.get(db, current_user.id)

    html_content, html_path, template_data = await generate_invoice_html(
        work_order, customer, vehicle, is_estimate=False, shop_settings=shop
    )

    if not html_content:
        raise HTTPException(status_code=500, detail="Failed to generate invoice")

    WorkOrderRepository.update(db, current_user.id, order_id, {"status": "invoiced"})

    result = {"status": "success", "html_content": html_content, "html_path": html_path}

    pdf_path = None
    if request.generate_pdf:
        logger.info("Generating PDF for order %s", order_id)
        pdf_path = await generate_pdf_with_reportlab(template_data)

        if pdf_path:
            result["pdf_path"] = pdf_path
        else:
            result["status"] = "partial"
            result["message"] = "Generated HTML but failed to create PDF"

    return result


@router.post("/work-orders/{order_id}/generate-estimate")
async def generate_estimate(
    order_id: str,
    request: EmailRequest,
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    work_order = WorkOrderRepository.get_by_id(db, current_user.id, order_id)
    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")

    customer = None
    if work_order.customer_id:
        customer = CustomerRepository.get_by_id(db, current_user.id, work_order.customer_id)

    vehicle = None
    if work_order.vehicle_id:
        vehicle = VehicleRepository.get_by_id(db, current_user.id, work_order.vehicle_id)

    shop = ShopSettingsRepository.get(db, current_user.id)

    html_content, html_path, template_data = await generate_invoice_html(
        work_order, customer, vehicle, is_estimate=True, shop_settings=shop
    )

    if not html_content:
        raise HTTPException(status_code=500, detail="Failed to generate estimate")

    WorkOrderRepository.update(db, current_user.id, order_id, {"status": "estimated"})

    result = {"status": "success", "html_content": html_content, "html_path": html_path}

    pdf_path = None
    if request.generate_pdf:
        logger.info("Generating PDF estimate for order %s", order_id)
        pdf_path = await generate_pdf_with_reportlab(template_data)

        if pdf_path:
            result["pdf_path"] = pdf_path
        else:
            result["status"] = "partial"
            result["message"] = "Generated HTML but failed to create PDF"

    return result


@router.get("/invoices/{filename}")
async def get_invoice_pdf(
    filename: str,
    current_user: UserDB = Depends(get_current_user),
):
    invoice_dir = Path(os.getenv("INVOICE_DIR", "invoices")).resolve()
    file_path = (invoice_dir / filename).resolve()

    if not file_path.is_relative_to(invoice_dir):
        raise HTTPException(status_code=400, detail="Invalid filename")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=str(file_path), media_type="application/pdf", filename=filename
    )
