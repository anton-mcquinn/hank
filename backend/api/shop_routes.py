from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.auth_dependencies import get_current_user
from api.models import ShopSettings, ShopSettingsUpdate
from database.db import UserDB, get_db
from database.repos import ShopSettingsRepository

router = APIRouter()


@router.get("/shop/settings", response_model=ShopSettings)
def get_shop_settings(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    return ShopSettingsRepository.get(db, current_user.id)


@router.put("/shop/settings", response_model=ShopSettings)
def update_shop_settings(
    data: ShopSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    return ShopSettingsRepository.update(db, current_user.id, updates)
