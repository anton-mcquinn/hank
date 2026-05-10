"""Photo gallery routes for work orders and vehicles.

Two parent types share the same shape (upload + list + delete), so the
endpoints are thin wrappers around a parent-agnostic helper. Photos live in
the private R2 bucket and are served via short-lived presigned URLs that get
re-issued every time the client lists them.
"""

import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.auth_dependencies import get_current_user
from database.db import UserDB, get_db
from database.repos import (
    MediaAssetRepository,
    WorkOrderRepository,
)
from services import storage

logger = logging.getLogger(__name__)

router = APIRouter()

_MAX_PHOTO_BYTES = 10 * 1024 * 1024
_ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".gif", ".webp"}
_PRESIGN_TTL = 900  # 15 min


class MediaAsset(BaseModel):
    id: str
    kind: str
    content_type: Optional[str] = None
    caption: Optional[str] = None
    url: str
    created_at: datetime

    class Config:
        json_encoders = {datetime: lambda dt: dt.isoformat()}


def _to_asset(row) -> MediaAsset:
    return MediaAsset(
        id=row.id,
        kind=row.kind,
        content_type=row.content_type,
        caption=row.caption,
        url=storage.presigned_url(row.r2_key, expires=_PRESIGN_TTL),
        created_at=row.created_at,
    )


async def _upload_photo(
    *,
    db: Session,
    user_id: str,
    parent_type: str,  # 'work_order' | 'vehicle'
    parent_id: str,
    kind: str,
    photo: UploadFile,
    caption: Optional[str],
) -> MediaAsset:
    ext = Path(photo.filename or "").suffix.lower()
    if ext not in _ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Unsupported image type '{ext}'")

    content = await photo.read()
    if len(content) > _MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Photo exceeds 10 MB limit")

    asset_id = str(uuid.uuid4())
    bucket_prefix = "work-order-photos" if parent_type == "work_order" else "vehicle-photos"
    r2_key = f"{bucket_prefix}/{user_id}/{parent_id}/{asset_id}{ext}"
    content_type = "image/jpeg" if ext in (".jpg", ".jpeg") else f"image/{ext.lstrip('.')}"

    storage.put("private", r2_key, content, content_type=content_type)

    row = MediaAssetRepository.create(
        db,
        user_id,
        {
            "id": asset_id,
            "parent_type": parent_type,
            "parent_id": parent_id,
            "kind": kind,
            "r2_key": r2_key,
            "content_type": content_type,
            "caption": caption,
        },
    )
    return _to_asset(row)


# ---------- Work order photos ----------


@router.post("/work-orders/{order_id}/photos", response_model=MediaAsset)
async def upload_work_order_photo(
    order_id: str,
    photo: UploadFile = File(...),
    kind: str = Form("general"),
    caption: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    if not WorkOrderRepository.get_by_id(db, current_user.id, order_id):
        raise HTTPException(status_code=404, detail="Work order not found")
    return await _upload_photo(
        db=db,
        user_id=current_user.id,
        parent_type="work_order",
        parent_id=order_id,
        kind=kind,
        photo=photo,
        caption=caption,
    )


@router.get("/work-orders/{order_id}/photos", response_model=List[MediaAsset])
def list_work_order_photos(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    if not WorkOrderRepository.get_by_id(db, current_user.id, order_id):
        raise HTTPException(status_code=404, detail="Work order not found")
    rows = MediaAssetRepository.list_for_parent(db, current_user.id, "work_order", order_id)
    return [_to_asset(r) for r in rows]


# ---------- Shared delete ----------


@router.delete("/media-assets/{asset_id}")
def delete_media_asset(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    row = MediaAssetRepository.get_by_id(db, current_user.id, asset_id)
    if not row:
        raise HTTPException(status_code=404, detail="Asset not found")
    try:
        storage.delete("private", row.r2_key)
    except Exception as e:  # noqa: BLE001 — best effort; row is the source of truth
        logger.warning("Failed to delete R2 object %s: %s", row.r2_key, e)
    MediaAssetRepository.delete(db, current_user.id, asset_id)
    return {"message": "Asset deleted"}
