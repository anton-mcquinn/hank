# backend/api/auth_routes.py
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError
from sqlalchemy.orm import Session

from api.rate_limit import limiter

from database.db import get_db
from database.repos import UserRepository
from services.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
    REFRESH_TOKEN_TYPE,
)
from api.models import User, UserCreate, Token, RefreshRequest
from api.auth_dependencies import get_current_user, get_admin_user

router = APIRouter()


def _issue_token_pair(user) -> dict:
    """Build a fresh access+refresh pair for the given user."""
    token_data = {"sub": user.id, "username": user.username, "is_admin": user.is_admin}
    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "token_type": "bearer",
    }


@router.post("/token", response_model=Token)
@limiter.limit("10/minute")
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    """Authenticate user and provide JWT access + refresh tokens"""
    user = UserRepository.get_by_username(db, form_data.username)
    if not user:
        user = UserRepository.get_by_email(db, form_data.username)

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return _issue_token_pair(user)


@router.post("/refresh", response_model=Token)
@limiter.limit("60/minute")
async def refresh_token(
    request: Request,
    body: RefreshRequest,
    db: Session = Depends(get_db),
):
    """Exchange a valid refresh token for a new access+refresh pair."""
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(body.refresh_token, expected_type=REFRESH_TOKEN_TYPE)
    except JWTError:
        raise invalid

    user_id = payload.get("sub")
    if not user_id:
        raise invalid

    user = UserRepository.get_by_id(db, user_id)
    if not user or not user.is_active:
        raise invalid

    return _issue_token_pair(user)


@router.post("/register", response_model=User)
@limiter.limit("5/hour")
async def register_user(
    request: Request,
    user: UserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Register a new user. Admin-only — accounts are created out-of-band."""
    # Check if username already exists
    db_user = UserRepository.get_by_username(db, user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    # Check if email already exists
    db_user = UserRepository.get_by_email(db, user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create new user with hashed password
    hashed_password = get_password_hash(user.password)
    user_data = {
        "username": user.username,
        "email": user.email,
        "hashed_password": hashed_password,
        "is_active": True,
        "is_admin": False,
    }

    # Create the user in the database
    new_user = UserRepository.create(db, user_data)

    # Convert to Pydantic model
    return User.from_orm(new_user)


@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """Get the current authenticated user's information"""
    return current_user
