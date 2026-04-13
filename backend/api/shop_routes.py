from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.auth_dependencies import get_current_user
from api.models import ShopSettings, ShopSettingsUpdate
from database.db import get_db
from database.repos import ShopSettingsRepository

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/shop/settings", response_model=ShopSettings)
def get_shop_settings(db: Session = Depends(get_db)):
    return ShopSettingsRepository.get(db)


@router.put("/shop/settings", response_model=ShopSettings)
def update_shop_settings(data: ShopSettingsUpdate, db: Session = Depends(get_db)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    return ShopSettingsRepository.update(db, updates)
