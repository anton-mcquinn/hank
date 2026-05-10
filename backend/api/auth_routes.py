# backend/api/auth_routes.py
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

from api.rate_limit import limiter

from database.db import get_db
from database.repos import UserRepository
from services.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
from api.models import User, UserCreate, Token
from api.auth_dependencies import get_current_user

router = APIRouter()


@router.post("/token", response_model=Token)
@limiter.limit("10/minute")
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    """Authenticate user and provide JWT token"""
    # Find user by username
    user = UserRepository.get_by_username(db, form_data.username)
    if not user:
        # If not found by username, try email
        user = UserRepository.get_by_email(db, form_data.username)

    # If user not found or password doesn't match
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # If user is not active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token data with user ID as subject
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token_data = {"sub": user.id, "username": user.username, "is_admin": user.is_admin}

    # Create access token
    access_token = create_access_token(
        data=token_data, expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/refresh", response_model=Token)
async def refresh_token(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Create a new access token using the refresh token"""
    # Create new access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token_data = {
        "sub": current_user.id,
        "username": current_user.username,
        "is_admin": current_user.is_admin,
    }

    access_token = create_access_token(
        data=token_data, expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/register", response_model=User)
@limiter.limit("5/hour")
async def register_user(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
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
