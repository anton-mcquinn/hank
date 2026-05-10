import logging
import os
import sys
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from api.rate_limit import limiter
import uvicorn

from api.auth_routes import router as auth_router
from api.workorder_routes import router as workorder_router
from api.customer_routes import router as customer_router
from api.vehicle_routes import router as vehicle_router
from api.invoice_routes import router as invoice_router
from api.shop_routes import router as shop_router
from database.db import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Validate required environment variables at startup
_required = ["OPENAI_API_KEY", "JWT_SECRET_KEY", "DATABASE_URL"]
_missing = [v for v in _required if not os.getenv(v)]
if _missing:
    logger.error("Missing required environment variables: %s", ", ".join(_missing))
    sys.exit(1)

_jwt_secret = os.getenv("JWT_SECRET_KEY", "")
if len(_jwt_secret) < 32 or _jwt_secret == "dev-secret-key-change-in-production":
    logger.error(
        "JWT_SECRET_KEY is too weak or is the default dev value. "
        "Generate a strong secret with: openssl rand -hex 32"
    )
    sys.exit(1)

# R2 storage: all-or-nothing. If any one is set, all must be set.
_r2_vars = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_PRIVATE",
    "R2_BUCKET_PUBLIC",
    "R2_PUBLIC_BASE_URL",
]
_r2_set = [v for v in _r2_vars if os.getenv(v)]
if _r2_set and len(_r2_set) != len(_r2_vars):
    _r2_missing = [v for v in _r2_vars if not os.getenv(v)]
    logger.error(
        "Partial R2 configuration — set all of %s or none. Missing: %s",
        _r2_vars, _r2_missing,
    )
    sys.exit(1)
if not _r2_set:
    logger.warning("R2 not configured — using local-disk storage fallback (dev only).")


# Initialize FastAPI app
app = FastAPI(title="Auto Shop Work Order API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — set CORS_ORIGINS in your environment as a comma-separated list of allowed origins
_cors_env = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:8081,http://localhost:19006,exp://localhost:19006",
)
allowed_origins = [origin.strip() for origin in _cors_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# Initialize database
init_db()

app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(workorder_router, prefix="/api/v1", tags=["work orders"])
app.include_router(customer_router, prefix="/api/v1", tags=["customers"])
app.include_router(vehicle_router, prefix="/api/v1", tags=["vehicles"])
app.include_router(invoice_router, prefix="/api/v1", tags=["invoices"])
app.include_router(shop_router, prefix="/api/v1", tags=["shop"])


@app.get("/")
async def root():
    return {"message": "Auto Shop Work Order API is running"}


@app.get("/health")
async def health():
    from sqlalchemy import text
    from database.db import SessionLocal
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        return {"status": "ok"}
    except Exception as e:
        logger.error("Health check failed: %s", e)
        from fastapi import Response
        return Response(content='{"status":"unavailable"}', status_code=503, media_type="application/json")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
