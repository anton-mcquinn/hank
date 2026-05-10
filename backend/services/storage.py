"""Object storage abstraction over Cloudflare R2 (S3-compatible).

Two buckets, addressed by visibility:
- private: served only via short-lived presigned URLs (invoices, estimates, customer/vehicle photos)
- public:  served via a stable HTTPS URL (shop logos, anything embeddable in customer-facing HTML)

When R2 env vars are unset, falls back to writing under ``LOCAL_STORAGE_DIR`` so dev works
without credentials. The fallback returns ``file://`` URLs from ``presigned_url`` and a local
HTTP path from ``public_url`` — both intended only for local testing.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Literal, Optional

import boto3
from botocore.client import Config

logger = logging.getLogger(__name__)

Visibility = Literal["private", "public"]

_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
_ACCESS_KEY = os.getenv("R2_ACCESS_KEY_ID")
_SECRET_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
_BUCKET_PRIVATE = os.getenv("R2_BUCKET_PRIVATE")
_BUCKET_PUBLIC = os.getenv("R2_BUCKET_PUBLIC")
_PUBLIC_BASE_URL = os.getenv("R2_PUBLIC_BASE_URL")  # e.g. https://pub-xxx.r2.dev or custom domain

_LOCAL_DIR = Path(os.getenv("LOCAL_STORAGE_DIR", "./local_storage")).resolve()

_R2_CONFIGURED = bool(
    _ACCOUNT_ID and _ACCESS_KEY and _SECRET_KEY and _BUCKET_PRIVATE and _BUCKET_PUBLIC
)


def _client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=_ACCESS_KEY,
        aws_secret_access_key=_SECRET_KEY,
        # R2 uses path-style addressing; signature_version v4 is required for presigning.
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        region_name="auto",
    )


def _bucket(visibility: Visibility) -> str:
    return _BUCKET_PRIVATE if visibility == "private" else _BUCKET_PUBLIC  # type: ignore[return-value]


def _local_path(visibility: Visibility, key: str) -> Path:
    return _LOCAL_DIR / visibility / key


def is_remote() -> bool:
    """True when configured to talk to R2; False when using the local fallback."""
    return _R2_CONFIGURED


def put(
    visibility: Visibility,
    key: str,
    data: bytes,
    content_type: Optional[str] = None,
) -> None:
    if _R2_CONFIGURED:
        kwargs = {"Bucket": _bucket(visibility), "Key": key, "Body": data}
        if content_type:
            kwargs["ContentType"] = content_type
        _client().put_object(**kwargs)
        return

    path = _local_path(visibility, key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def get(visibility: Visibility, key: str) -> bytes:
    """Fetch raw bytes — used server-side, e.g. embedding a logo into a generated PDF."""
    if _R2_CONFIGURED:
        resp = _client().get_object(Bucket=_bucket(visibility), Key=key)
        return resp["Body"].read()

    return _local_path(visibility, key).read_bytes()


def delete(visibility: Visibility, key: str) -> None:
    if _R2_CONFIGURED:
        _client().delete_object(Bucket=_bucket(visibility), Key=key)
        return

    path = _local_path(visibility, key)
    if path.exists():
        path.unlink()


def presigned_url(key: str, expires: int = 900) -> str:
    """Short-lived URL for a private object."""
    if _R2_CONFIGURED:
        return _client().generate_presigned_url(
            "get_object",
            Params={"Bucket": _BUCKET_PRIVATE, "Key": key},
            ExpiresIn=expires,
        )

    return f"file://{_local_path('private', key)}"


def public_url(key: str) -> str:
    """Stable URL for a public object."""
    if _R2_CONFIGURED:
        if not _PUBLIC_BASE_URL:
            raise RuntimeError("R2_PUBLIC_BASE_URL is not set")
        return f"{_PUBLIC_BASE_URL.rstrip('/')}/{key}"

    return f"file://{_local_path('public', key)}"
