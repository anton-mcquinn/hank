from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError
from typing import Optional

from database.db import get_db
from database.repos import UserRepository
from services.auth import decode_token, ACCESS_TOKEN_TYPE
from api.models import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
):
    """Get the current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token, expected_type=ACCESS_TOKEN_TYPE)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception

        token_data = TokenData(
            user_id=user_id,
            username=payload.get("username"),
            is_admin=payload.get("is_admin", False),
        )
    except JWTError:
        raise credentials_exception

    # Get user from database
    user = UserRepository.get_by_id(db, token_data.user_id)
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    return user


async def get_current_active_user(current_user=Depends(get_current_user)):
    """Get the current active user"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_admin_user(current_user=Depends(get_current_user)):
    """Get the current user and verify they have admin privileges"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions"
        )
    return current_user
