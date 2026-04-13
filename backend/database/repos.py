import logging
from datetime import datetime
import uuid
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

from .db import UserDB, CustomerDB, VehicleDB, WorkOrderDB, ShopSettingsDB


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

        # Update fields
        for key, value in user_data.items():
            setattr(user, key, value)

        # Always update the updated_at timestamp
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
    def create(db: Session, customer_data: Dict[str, Any]) -> CustomerDB:
        if "id" not in customer_data:
            customer_data["id"] = str(uuid.uuid4())

        customer_db = CustomerDB(**customer_data)
        db.add(customer_db)
        db.commit()
        db.refresh(customer_db)
        return customer_db

    @staticmethod
    def update(
        db: Session, customer_id: str, customer_data: Dict[str, Any]
    ) -> Optional[CustomerDB]:
        customer = db.query(CustomerDB).filter(CustomerDB.id == customer_id).first()
        if not customer:
            return None

        # Update fields
        for key, value in customer_data.items():
            setattr(customer, key, value)

        # Always update the updated_at timestamp
        customer.updated_at = datetime.now()

        db.commit()
        db.refresh(customer)
        return customer

    @staticmethod
    def delete(db: Session, customer_id: str) -> bool:
        customer = db.query(CustomerDB).filter(CustomerDB.id == customer_id).first()
        if not customer:
            return False

        db.delete(customer)
        db.commit()
        return True

    @staticmethod
    def get_by_id(db: Session, customer_id: str) -> Optional[CustomerDB]:
        return db.query(CustomerDB).filter(CustomerDB.id == customer_id).first()

    @staticmethod
    def get_by_phone(db: Session, phone: str) -> Optional[CustomerDB]:
        return db.query(CustomerDB).filter(CustomerDB.phone == phone).first()

    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[CustomerDB]:
        return db.query(CustomerDB).filter(CustomerDB.email == email).first()

    @staticmethod
    def get_all(db: Session) -> List[CustomerDB]:
        return db.query(CustomerDB).all()


class VehicleRepository:
    @staticmethod
    def create(db: Session, vehicle_data: Dict[str, Any]) -> VehicleDB:
        if "id" not in vehicle_data:
            vehicle_data["id"] = str(uuid.uuid4())

        vehicle_db = VehicleDB(**vehicle_data)
        db.add(vehicle_db)
        db.commit()
        db.refresh(vehicle_db)
        customer_id = vehicle_data.get("customer_id")
        if customer_id:
            customer = db.query(CustomerDB).filter(CustomerDB.id == customer_id).first()
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
        db: Session, vehicle_id: str, vehicle_data: Dict[str, Any]
    ) -> Optional[VehicleDB]:
        vehicle = db.query(VehicleDB).filter(VehicleDB.id == vehicle_id).first()
        if not vehicle:
            return None

        # Update fields
        for key, value in vehicle_data.items():
            setattr(vehicle, key, value)

        # Always update the updated_at timestamp
        vehicle.updated_at = datetime.now()

        db.commit()
        db.refresh(vehicle)
        return vehicle

    @staticmethod
    def delete(db: Session, vehicle_id: str) -> bool:
        vehicle = db.query(VehicleDB).filter(VehicleDB.id == vehicle_id).first()
        if not vehicle:
            return False

        db.delete(vehicle)
        db.commit()
        return True

    @staticmethod
    def get_by_id(db: Session, vehicle_id: str) -> Optional[VehicleDB]:
        return db.query(VehicleDB).filter(VehicleDB.id == vehicle_id).first()

    @staticmethod
    def get_by_vin(db: Session, vin: str) -> Optional[VehicleDB]:
        return db.query(VehicleDB).filter(VehicleDB.vin == vin).first()

    @staticmethod
    def get_by_customer(db: Session, customer_id: str) -> List[VehicleDB]:
        return db.query(VehicleDB).filter(VehicleDB.customer_id == customer_id).all()

    @staticmethod
    def get_all(db: Session) -> List[VehicleDB]:
        return db.query(VehicleDB).all()


class ShopSettingsRepository:
    SINGLETON_ID = 1

    @staticmethod
    def get(db: Session) -> ShopSettingsDB:
        row = db.query(ShopSettingsDB).filter(ShopSettingsDB.id == ShopSettingsRepository.SINGLETON_ID).first()
        if not row:
            row = ShopSettingsDB(id=ShopSettingsRepository.SINGLETON_ID)
            db.add(row)
            db.commit()
            db.refresh(row)
        return row

    @staticmethod
    def update(db: Session, data: Dict[str, Any]) -> ShopSettingsDB:
        row = ShopSettingsRepository.get(db)
        for key, value in data.items():
            setattr(row, key, value)
        row.updated_at = datetime.now()
        db.commit()
        db.refresh(row)
        return row


class WorkOrderRepository:
    @staticmethod
    def create(db, work_order_data):
        work_order_db = WorkOrderDB(**work_order_data)
        logger.info("Creating work order: %s", work_order_data.get("id"))
        db.add(work_order_db)
        db.commit()
        db.refresh(work_order_db)
        return work_order_db

    @staticmethod
    def update(db, order_id, work_order_data):
        work_order = db.query(WorkOrderDB).filter(WorkOrderDB.id == order_id).first()
        if not work_order:
            return None

        # Update fields
        logger.info("Updating work order: %s", order_id)
        for key, value in work_order_data.items():
            setattr(work_order, key, value)

        # Always update the updated_at timestamp
        work_order.updated_at = datetime.now()

        db.commit()
        db.refresh(work_order)
        return work_order

    @staticmethod
    def delete(db, order_id):
        work_order = db.query(WorkOrderDB).filter(WorkOrderDB.id == order_id).first()
        if not work_order:
            return False

        db.delete(work_order)
        db.commit()
        return True

    @staticmethod
    def get_by_id(db, order_id):
        return db.query(WorkOrderDB).filter(WorkOrderDB.id == order_id).first()

    @staticmethod
    def get_by_customer(db, customer_id):
        return (
            db.query(WorkOrderDB).filter(WorkOrderDB.customer_id == customer_id).all()
        )

    @staticmethod
    def get_all(db):
        return db.query(WorkOrderDB).all()
