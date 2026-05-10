import logging
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from api.auth_dependencies import get_current_user
from api.models import ShopSettings, ShopSettingsUpdate
from database.db import UserDB, get_db
from database.repos import ShopSettingsRepository
from services import storage

logger = logging.getLogger(__name__)

router = APIRouter()

_MAX_LOGO_BYTES = 5 * 1024 * 1024  # 5 MB
_ALLOWED_LOGO_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def _logo_key(user_id: str, ext: str) -> str:
    return f"logos/{user_id}{ext}"


def _shop_to_response(shop) -> ShopSettings:
    payload = ShopSettings.model_validate(shop, from_attributes=True)
    if shop.logo_key:
        payload.logo_url = storage.public_url(shop.logo_key)
    return payload


@router.get("/shop/settings", response_model=ShopSettings)
def get_shop_settings(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    return _shop_to_response(ShopSettingsRepository.get(db, current_user.id))


@router.put("/shop/settings", response_model=ShopSettings)
def update_shop_settings(
    data: ShopSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    return _shop_to_response(ShopSettingsRepository.update(db, current_user.id, updates))


@router.post("/shop/logo", response_model=ShopSettings)
async def upload_shop_logo(
    logo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    ext = Path(logo.filename or "").suffix.lower()
    if ext not in _ALLOWED_LOGO_EXT:
        raise HTTPException(status_code=400, detail=f"Unsupported image type '{ext}'")

    content = await logo.read()
    if len(content) > _MAX_LOGO_BYTES:
        raise HTTPException(status_code=413, detail="Logo exceeds 5 MB limit")

    shop = ShopSettingsRepository.get(db, current_user.id)
    # If a logo with a different extension is already stored, drop it before
    # uploading the new one so we don't leave orphaned objects in the bucket.
    if shop.logo_key and shop.logo_key != _logo_key(current_user.id, ext):
        try:
            storage.delete("public", shop.logo_key)
        except Exception as e:  # noqa: BLE001 — non-fatal best effort
            logger.warning("Failed to delete previous logo %s: %s", shop.logo_key, e)

    new_key = _logo_key(current_user.id, ext)
    content_type = f"image/{ 'jpeg' if ext in ('.jpg', '.jpeg') else ext.lstrip('.') }"
    storage.put("public", new_key, content, content_type=content_type)

    updated = ShopSettingsRepository.update(db, current_user.id, {"logo_key": new_key})
    return _shop_to_response(updated)


@router.delete("/shop/logo", response_model=ShopSettings)
def delete_shop_logo(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    shop = ShopSettingsRepository.get(db, current_user.id)
    if shop.logo_key:
        try:
            storage.delete("public", shop.logo_key)
        except Exception as e:  # noqa: BLE001
            logger.warning("Failed to delete logo %s: %s", shop.logo_key, e)
    updated = ShopSettingsRepository.update(db, current_user.id, {"logo_key": None})
    return _shop_to_response(updated)
