import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from api.auth_dependencies import get_current_user
from database.db import UserDB, get_db
from database.repos import (
    WorkOrderRepository,
    CustomerRepository,
    VehicleRepository,
    ShopSettingsRepository,
)
from services.invoice_generator_html import (
    generate_invoice_html,
    generate_pdf_with_reportlab,
)
from services import storage

logger = logging.getLogger(__name__)

router = APIRouter()

_PRESIGN_TTL_SECONDS = 900  # 15 minutes


def _invoice_key(user_id: str, order_id: str) -> str:
    return f"invoices/{user_id}/{order_id}.pdf"


def _estimate_key(user_id: str, order_id: str) -> str:
    return f"estimates/{user_id}/{order_id}.pdf"


class EmailRequest(BaseModel):
    """Request model for generating and sending invoices"""

    email: Optional[str] = None
    generate_pdf: bool = False
    send_email: bool = False


async def _render_and_upload(
    user_id: str,
    work_order,
    customer,
    vehicle,
    shop,
    is_estimate: bool,
    upload_pdf: bool,
):
    html_content, template_data = await generate_invoice_html(
        work_order, customer, vehicle, is_estimate=is_estimate, shop_settings=shop
    )
    if not html_content:
        raise HTTPException(status_code=500, detail="Failed to generate document")

    pdf_url: Optional[str] = None
    pdf_key: Optional[str] = None
    if upload_pdf:
        pdf_bytes = await generate_pdf_with_reportlab(template_data)
        if not pdf_bytes:
            return html_content, None, None

        pdf_key = (
            _estimate_key(user_id, work_order.id)
            if is_estimate
            else _invoice_key(user_id, work_order.id)
        )
        storage.put("private", pdf_key, pdf_bytes, content_type="application/pdf")
        pdf_url = storage.presigned_url(pdf_key, expires=_PRESIGN_TTL_SECONDS)

    return html_content, pdf_key, pdf_url


@router.post("/work-orders/{order_id}/generate-invoice")
async def generate_invoice(
    order_id: str,
    request: EmailRequest,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    work_order = WorkOrderRepository.get_by_id(db, current_user.id, order_id)
    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")

    customer = (
        CustomerRepository.get_by_id(db, current_user.id, work_order.customer_id)
        if work_order.customer_id
        else None
    )
    vehicle = (
        VehicleRepository.get_by_id(db, current_user.id, work_order.vehicle_id)
        if work_order.vehicle_id
        else None
    )
    shop = ShopSettingsRepository.get(db, current_user.id)

    html_content, pdf_key, pdf_url = await _render_and_upload(
        current_user.id, work_order, customer, vehicle, shop,
        is_estimate=False, upload_pdf=request.generate_pdf,
    )

    update = {"status": "invoiced"}
    if pdf_key:
        update["invoice_key"] = pdf_key
    WorkOrderRepository.update(db, current_user.id, order_id, update)

    result = {"status": "success", "html_content": html_content}
    if request.generate_pdf:
        if pdf_url:
            result["pdf_url"] = pdf_url
        else:
            result["status"] = "partial"
            result["message"] = "Generated HTML but failed to create PDF"
    return result


@router.post("/work-orders/{order_id}/generate-estimate")
async def generate_estimate(
    order_id: str,
    request: EmailRequest,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    work_order = WorkOrderRepository.get_by_id(db, current_user.id, order_id)
    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")

    customer = (
        CustomerRepository.get_by_id(db, current_user.id, work_order.customer_id)
        if work_order.customer_id
        else None
    )
    vehicle = (
        VehicleRepository.get_by_id(db, current_user.id, work_order.vehicle_id)
        if work_order.vehicle_id
        else None
    )
    shop = ShopSettingsRepository.get(db, current_user.id)

    html_content, pdf_key, pdf_url = await _render_and_upload(
        current_user.id, work_order, customer, vehicle, shop,
        is_estimate=True, upload_pdf=request.generate_pdf,
    )

    update = {"status": "estimated"}
    if pdf_key:
        update["estimate_key"] = pdf_key
    WorkOrderRepository.update(db, current_user.id, order_id, update)

    result = {"status": "success", "html_content": html_content}
    if request.generate_pdf:
        if pdf_url:
            result["pdf_url"] = pdf_url
        else:
            result["status"] = "partial"
            result["message"] = "Generated HTML but failed to create PDF"
    return result


@router.get("/work-orders/{order_id}/invoice-url")
async def get_invoice_url(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    work_order = WorkOrderRepository.get_by_id(db, current_user.id, order_id)
    if not work_order or not work_order.invoice_key:
        raise HTTPException(status_code=404, detail="Invoice not found")

    return {"url": storage.presigned_url(work_order.invoice_key, expires=_PRESIGN_TTL_SECONDS)}


@router.get("/work-orders/{order_id}/estimate-url")
async def get_estimate_url(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    work_order = WorkOrderRepository.get_by_id(db, current_user.id, order_id)
    if not work_order or not work_order.estimate_key:
        raise HTTPException(status_code=404, detail="Estimate not found")

    return {"url": storage.presigned_url(work_order.estimate_key, expires=_PRESIGN_TTL_SECONDS)}
