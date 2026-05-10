from typing import List, Dict, Any, Optional
from pydantic import BaseModel, EmailStr

from datetime import datetime


class UserBase(BaseModel):
    username: str
    email: EmailStr


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None


class User(UserBase):
    id: str
    is_active: bool
    is_admin: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda dt: dt.isoformat()}


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenData(BaseModel):
    user_id: str
    username: str
    is_admin: bool


class CustomerBase(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str
    address: str


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

    # what is this?
    class Config:
        extra = "ignore"


class Customer(CustomerBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda dt: dt.isoformat()}


# ------ Vehicle Models ------
class VehicleBase(BaseModel):
    id: str
    customer_id: str
    vin: Optional[str] = None
    plate: Optional[str] = None
    year: Optional[int] = None
    make: Optional[str] = None
    model: Optional[str] = None
    engine_code: Optional[str] = None
    engine_size: Optional[str] = None
    mileage: Optional[int] = None


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    customer_id: Optional[str] = None
    vin: Optional[str] = None
    plate: Optional[str] = None
    year: Optional[int] = None
    make: Optional[str] = None
    model: Optional[str] = None
    engine_code: Optional[str] = None
    engine_size: Optional[str] = None
    mileage: Optional[int] = None

    class Config:
        extra = "ignore"


class Vehicle(VehicleBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda dt: dt.isoformat()}


# ------ Line Item Model ------
class LineItem(BaseModel):
    description: str
    type: str  # "part" or "labor"
    quantity: float
    unit_price: float
    total: float


# ------ Work Order Models ------
class WorkOrderBase(BaseModel):
    customer_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    vehicle_info: Dict[str, Any] = {}
    work_summary: str = ""
    line_items: List[Dict[str, Any]] = []
    total_parts: float = 0
    total_labor: float = 0
    total: float = 0
    status: str = "draft"


# what is this?
class WorkOrderCreate(WorkOrderBase):
    pass


class WorkOrderUpdate(BaseModel):
    customer_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    vehicle_info: Optional[Dict[str, Any]] = None
    work_summary: Optional[str] = None
    line_items: Optional[List[Dict[str, Any]]] = None
    total_parts: Optional[float] = None
    total_labor: Optional[float] = None
    total: Optional[float] = None
    status: Optional[str] = None
    processing_notes: Optional[List[str]] = None

    class Config:
        extra = "ignore"


class WorkOrder(WorkOrderBase):
    id: str
    invoice_key: Optional[str] = None
    estimate_key: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda dt: dt.isoformat()}


# ------ Shop Settings Models ------
class ShopSettings(BaseModel):
    name: str = ""
    address: str = ""
    phone: str = ""
    email: str = ""
    website: str = ""
    logo_url: Optional[str] = None

    class Config:
        from_attributes = True


class ShopSettingsUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
