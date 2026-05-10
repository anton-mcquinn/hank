import logging
from datetime import datetime
import uuid
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

from .db import (
    UserDB,
    CustomerDB,
    VehicleDB,
    WorkOrderDB,
    ShopSettingsDB,
    MediaAssetDB,
    VehicleReminderDB,
)


class UserRepository:
    @staticmethod
    def create(db: Session, user_data: Dict[str, Any]) -> UserDB:
        if "id" not in user_data:
            user_data["id"] = str(uuid.uuid4())

        user_db = UserDB(**user_data)
        db.add(user_db)
        db.commit()
        db.refresh(user_db)
        return user_db

    @staticmethod
    def update(
        db: Session, user_id: str, user_data: Dict[str, Any]
    ) -> Optional[UserDB]:
        user = db.query(UserDB).filter(UserDB.id == user_id).first()
        if not user:
            return None

        for key, value in user_data.items():
            setattr(user, key, value)

        user.updated_at = datetime.now()

        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def delete(db: Session, user_id: str) -> bool:
        user = db.query(UserDB).filter(UserDB.id == user_id).first()
        if not user:
            return False

        db.delete(user)
        db.commit()
        return True

    @staticmethod
    def get_by_id(db: Session, user_id: str) -> Optional[UserDB]:
        return db.query(UserDB).filter(UserDB.id == user_id).first()

    @staticmethod
    def get_by_username(db: Session, username: str) -> Optional[UserDB]:
        return db.query(UserDB).filter(UserDB.username == username).first()

    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[UserDB]:
        return db.query(UserDB).filter(UserDB.email == email).first()

    @staticmethod
    def get_all(db: Session) -> List[UserDB]:
        return db.query(UserDB).all()


class CustomerRepository:
    @staticmethod
    def create(db: Session, user_id: str, customer_data: Dict[str, Any]) -> CustomerDB:
        if "id" not in customer_data:
            customer_data["id"] = str(uuid.uuid4())
        customer_data["user_id"] = user_id

        customer_db = CustomerDB(**customer_data)
        db.add(customer_db)
        db.commit()
        db.refresh(customer_db)
        return customer_db

    @staticmethod
    def update(
        db: Session, user_id: str, customer_id: str, customer_data: Dict[str, Any]
    ) -> Optional[CustomerDB]:
        customer = (
            db.query(CustomerDB)
            .filter(CustomerDB.id == customer_id, CustomerDB.user_id == user_id)
            .first()
        )
        if not customer:
            return None

        for key, value in customer_data.items():
            if key == "user_id":
                continue
            setattr(customer, key, value)

        customer.updated_at = datetime.now()

        db.commit()
        db.refresh(customer)
        return customer

    @staticmethod
    def delete(db: Session, user_id: str, customer_id: str) -> bool:
        customer = (
            db.query(CustomerDB)
            .filter(CustomerDB.id == customer_id, CustomerDB.user_id == user_id)
            .first()
        )
        if not customer:
            return False

        db.delete(customer)
        db.commit()
        return True

    @staticmethod
    def get_by_id(db: Session, user_id: str, customer_id: str) -> Optional[CustomerDB]:
        return (
            db.query(CustomerDB)
            .filter(CustomerDB.id == customer_id, CustomerDB.user_id == user_id)
            .first()
        )

    @staticmethod
    def get_by_phone(db: Session, user_id: str, phone: str) -> Optional[CustomerDB]:
        return (
            db.query(CustomerDB)
            .filter(CustomerDB.phone == phone, CustomerDB.user_id == user_id)
            .first()
        )

    @staticmethod
    def get_by_email(db: Session, user_id: str, email: str) -> Optional[CustomerDB]:
        return (
            db.query(CustomerDB)
            .filter(CustomerDB.email == email, CustomerDB.user_id == user_id)
            .first()
        )

    @staticmethod
    def get_all(db: Session, user_id: str) -> List[CustomerDB]:
        return db.query(CustomerDB).filter(CustomerDB.user_id == user_id).all()


class VehicleRepository:
    @staticmethod
    def create(db: Session, user_id: str, vehicle_data: Dict[str, Any]) -> VehicleDB:
        if "id" not in vehicle_data:
            vehicle_data["id"] = str(uuid.uuid4())
        vehicle_data["user_id"] = user_id

        vehicle_db = VehicleDB(**vehicle_data)
        db.add(vehicle_db)
        db.commit()
        db.refresh(vehicle_db)
        customer_id = vehicle_data.get("customer_id")
        if customer_id:
            customer = (
                db.query(CustomerDB)
                .filter(CustomerDB.id == customer_id, CustomerDB.user_id == user_id)
                .first()
            )
            if customer:
                vehicles = customer.vehicles or []
                if vehicle_db.id not in vehicles:
                    vehicles.append(vehicle_db.id)
                    customer.vehicles = vehicles
                    customer.updated_at = datetime.now()
                    db.commit()

        return vehicle_db

    @staticmethod
    def update(
        db: Session, user_id: str, vehicle_id: str, vehicle_data: Dict[str, Any]
    ) -> Optional[VehicleDB]:
        vehicle = (
            db.query(VehicleDB)
            .filter(VehicleDB.id == vehicle_id, VehicleDB.user_id == user_id)
            .first()
        )
        if not vehicle:
            return None

        for key, value in vehicle_data.items():
            if key == "user_id":
                continue
            setattr(vehicle, key, value)

        vehicle.updated_at = datetime.now()

        db.commit()
        db.refresh(vehicle)
        return vehicle

    @staticmethod
    def delete(db: Session, user_id: str, vehicle_id: str) -> bool:
        vehicle = (
            db.query(VehicleDB)
            .filter(VehicleDB.id == vehicle_id, VehicleDB.user_id == user_id)
            .first()
        )
        if not vehicle:
            return False

        db.delete(vehicle)
        db.commit()
        return True

    @staticmethod
    def get_by_id(db: Session, user_id: str, vehicle_id: str) -> Optional[VehicleDB]:
        return (
            db.query(VehicleDB)
            .filter(VehicleDB.id == vehicle_id, VehicleDB.user_id == user_id)
            .first()
        )

    @staticmethod
    def get_by_vin(db: Session, user_id: str, vin: str) -> Optional[VehicleDB]:
        return (
            db.query(VehicleDB)
            .filter(VehicleDB.vin == vin, VehicleDB.user_id == user_id)
            .first()
        )

    @staticmethod
    def get_by_customer(db: Session, user_id: str, customer_id: str) -> List[VehicleDB]:
        return (
            db.query(VehicleDB)
            .filter(
                VehicleDB.customer_id == customer_id, VehicleDB.user_id == user_id
            )
            .all()
        )

    @staticmethod
    def get_all(db: Session, user_id: str) -> List[VehicleDB]:
        return db.query(VehicleDB).filter(VehicleDB.user_id == user_id).all()


class ShopSettingsRepository:
    @staticmethod
    def get(db: Session, user_id: str) -> ShopSettingsDB:
        row = (
            db.query(ShopSettingsDB)
            .filter(ShopSettingsDB.user_id == user_id)
            .first()
        )
        if not row:
            row = ShopSettingsDB(user_id=user_id)
            db.add(row)
            db.commit()
            db.refresh(row)
        return row

    @staticmethod
    def update(db: Session, user_id: str, data: Dict[str, Any]) -> ShopSettingsDB:
        row = ShopSettingsRepository.get(db, user_id)
        for key, value in data.items():
            if key == "user_id":
                continue
            setattr(row, key, value)
        row.updated_at = datetime.now()
        db.commit()
        db.refresh(row)
        return row


class WorkOrderRepository:
    @staticmethod
    def create(db, user_id: str, work_order_data):
        work_order_data["user_id"] = user_id
        work_order_db = WorkOrderDB(**work_order_data)
        logger.info("Creating work order: %s", work_order_data.get("id"))
        db.add(work_order_db)
        db.commit()
        db.refresh(work_order_db)
        return work_order_db

    @staticmethod
    def update(db, user_id: str, order_id, work_order_data):
        work_order = (
            db.query(WorkOrderDB)
            .filter(WorkOrderDB.id == order_id, WorkOrderDB.user_id == user_id)
            .first()
        )
        if not work_order:
            return None

        logger.info("Updating work order: %s", order_id)
        for key, value in work_order_data.items():
            if key == "user_id":
                continue
            setattr(work_order, key, value)

        work_order.updated_at = datetime.now()

        db.commit()
        db.refresh(work_order)
        return work_order

    @staticmethod
    def delete(db, user_id: str, order_id):
        work_order = (
            db.query(WorkOrderDB)
            .filter(WorkOrderDB.id == order_id, WorkOrderDB.user_id == user_id)
            .first()
        )
        if not work_order:
            return False

        db.delete(work_order)
        db.commit()
        return True

    @staticmethod
    def get_by_id(db, user_id: str, order_id):
        return (
            db.query(WorkOrderDB)
            .filter(WorkOrderDB.id == order_id, WorkOrderDB.user_id == user_id)
            .first()
        )

    @staticmethod
    def get_by_customer(db, user_id: str, customer_id):
        return (
            db.query(WorkOrderDB)
            .filter(
                WorkOrderDB.customer_id == customer_id,
                WorkOrderDB.user_id == user_id,
            )
            .all()
        )

    @staticmethod
    def get_all(db, user_id: str):
        return db.query(WorkOrderDB).filter(WorkOrderDB.user_id == user_id).all()


class MediaAssetRepository:
    @staticmethod
    def create(db: Session, user_id: str, data: Dict[str, Any]) -> MediaAssetDB:
        if "id" not in data:
            data["id"] = str(uuid.uuid4())
        data["user_id"] = user_id
        row = MediaAssetDB(**data)
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def get_by_id(db: Session, user_id: str, asset_id: str) -> Optional[MediaAssetDB]:
        return (
            db.query(MediaAssetDB)
            .filter(MediaAssetDB.id == asset_id, MediaAssetDB.user_id == user_id)
            .first()
        )

    @staticmethod
    def list_for_parent(
        db: Session, user_id: str, parent_type: str, parent_id: str
    ) -> List[MediaAssetDB]:
        return (
            db.query(MediaAssetDB)
            .filter(
                MediaAssetDB.user_id == user_id,
                MediaAssetDB.parent_type == parent_type,
                MediaAssetDB.parent_id == parent_id,
            )
            .order_by(MediaAssetDB.created_at.asc())
            .all()
        )

    @staticmethod
    def delete(db: Session, user_id: str, asset_id: str) -> Optional[MediaAssetDB]:
        row = MediaAssetRepository.get_by_id(db, user_id, asset_id)
        if not row:
            return None
        db.delete(row)
        db.commit()
        return row


class VehicleReminderRepository:
    @staticmethod
    def create(db: Session, user_id: str, data: Dict[str, Any]) -> VehicleReminderDB:
        if "id" not in data:
            data["id"] = str(uuid.uuid4())
        data["user_id"] = user_id
        row = VehicleReminderDB(**data)
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def get_by_id(db: Session, user_id: str, reminder_id: str) -> Optional[VehicleReminderDB]:
        return (
            db.query(VehicleReminderDB)
            .filter(
                VehicleReminderDB.id == reminder_id,
                VehicleReminderDB.user_id == user_id,
            )
            .first()
        )

    @staticmethod
    def list_for_vehicle(db: Session, user_id: str, vehicle_id: str) -> List[VehicleReminderDB]:
        return (
            db.query(VehicleReminderDB)
            .filter(
                VehicleReminderDB.user_id == user_id,
                VehicleReminderDB.vehicle_id == vehicle_id,
            )
            .order_by(VehicleReminderDB.created_at.asc())
            .all()
        )

    @staticmethod
    def delete(db: Session, user_id: str, reminder_id: str) -> Optional[VehicleReminderDB]:
        row = VehicleReminderRepository.get_by_id(db, user_id, reminder_id)
        if not row:
            return None
        db.delete(row)
        db.commit()
        return row
