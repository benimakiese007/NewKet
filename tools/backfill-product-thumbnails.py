from __future__ import annotations

import hashlib
import mimetypes
import os
import re
import sys
from io import BytesIO
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.parse import quote, urlparse

import requests
from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[1]
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://kuygjocnnlvjtoaquicq.supabase.co").rstrip("/")
BUCKET_NAME = os.getenv("SUPABASE_BUCKET", "product-images")
REST_BASE = f"{SUPABASE_URL}/rest/v1"
STORAGE_BASE = f"{SUPABASE_URL}/storage/v1"
SERVICE_ROLE_ENV = "SUPABASE_SERVICE_ROLE_KEY"


def read_service_role_key() -> str:
    key = os.getenv(SERVICE_ROLE_ENV)
    if key:
        return key.strip()

    fallback_file = REPO_ROOT / "tools" / "migrate-images.mjs"
    if fallback_file.exists():
        text = fallback_file.read_text(encoding="utf-8", errors="ignore")
        match = re.search(r"SERVICE_ROLE_KEY\s*=\s*'([^']+)'", text)
        if match:
            return match.group(1).strip()

    raise RuntimeError(
        f"Missing Supabase service role key. Set {SERVICE_ROLE_ENV} or keep the fallback in tools/migrate-images.mjs."
    )


def make_session(service_role_key: str) -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
        }
    )
    return session


def encode_storage_path(path: str) -> str:
    return "/".join(quote(segment, safe="") for segment in path.split("/"))


def public_storage_url(bucket: str, path: str) -> str:
    return f"{STORAGE_BASE}/object/public/{bucket}/{encode_storage_path(path)}"


def is_supabase_public_url(value: str) -> bool:
    value = value.strip()
    return bool(re.match(r"^https?://[^/]+/storage/v1/object/public/[^/]+/", value))


def is_supabase_bucket_path(value: str) -> bool:
    value = value.strip().lstrip("/")
    return bool(re.match(r"^(?:product-images|vendor-covers|user-assets|vendor-docs|site-assets)/", value))


def parse_bucket_path(value: str) -> Tuple[str, str]:
    value = value.strip().lstrip("/")
    parts = value.split("/", 1)
    if len(parts) == 2 and parts[0] in {"product-images", "vendor-covers", "user-assets", "vendor-docs", "site-assets"}:
        return parts[0], parts[1]
    return "", value


def normalize_source_token(token: str) -> str:
    return token.strip()


def split_image_field(image_field: str) -> List[str]:
    return [part.strip() for part in str(image_field or "").split(",") if part.strip()]


def local_candidates(token: str) -> Iterable[Path]:
    cleaned = token.strip().lstrip("/")
    cleaned = cleaned.replace("\\", "/")
    cleaned = re.sub(r"^\.\./+", "", cleaned)
    yield REPO_ROOT / "frontend" / "public" / cleaned
    yield REPO_ROOT / "public" / cleaned
    yield REPO_ROOT / cleaned


def resolve_local_file(token: str) -> Optional[Path]:
    for candidate in local_candidates(token):
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


def fetch_source_bytes(session: requests.Session, token: str) -> Tuple[bytes, str, str]:
    token = normalize_source_token(token)
    if token.startswith("http://") or token.startswith("https://"):
        response = session.get(token, timeout=90)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "").split(";")[0].strip()
        filename = Path(urlparse(token).path).name or "image"
        return response.content, content_type, filename

    if is_supabase_bucket_path(token):
        bucket_name, rel_path = parse_bucket_path(token)
        public_url = public_storage_url(bucket_name or BUCKET_NAME, rel_path)
        response = session.get(public_url, timeout=90)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "").split(";")[0].strip()
        filename = Path(urlparse(public_url).path).name or "image"
        return response.content, content_type, filename

    local_file = resolve_local_file(token)
    if not local_file:
        raise FileNotFoundError(f"Local image not found for token: {token}")

    content = local_file.read_bytes()
    content_type = mimetypes.guess_type(local_file.name)[0] or ""
    return content, content_type, local_file.name


def resize_to_webp(image_bytes: bytes, max_size: Tuple[int, int], quality: int) -> bytes:
    with Image.open(BytesIO(image_bytes)) as image:
        if getattr(image, "is_animated", False):
            raise ValueError("animated images are not supported for thumbnail generation")

        image = image.convert("RGBA")
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        output = BytesIO()
        image.save(output, format="WEBP", quality=quality, method=6)
        return output.getvalue()


def source_hash(token: str) -> str:
    return hashlib.sha1(token.encode("utf-8")).hexdigest()[:16]


def storage_object_prefix(product_id: str, token: str) -> str:
    return f"migrations/products/{product_id}/{source_hash(token)}"


def upload_object(session: requests.Session, bucket: str, path: str, content: bytes, content_type: str) -> None:
    url = f"{STORAGE_BASE}/object/{bucket}/{encode_storage_path(path)}"
    headers = {
        "Content-Type": content_type or "application/octet-stream",
        "cache-control": "max-age=3600",
        "x-upsert": "true",
    }
    response = session.post(url, data=content, headers=headers, timeout=120)
    if response.status_code not in {200, 201}:
        raise RuntimeError(f"Storage upload failed for {path}: {response.status_code} {response.text}")


def read_products(session: requests.Session, page_size: int = 200) -> List[Dict]:
    products: List[Dict] = []
    offset = 0

    while True:
        response = session.get(
            f"{REST_BASE}/products",
            params={
                "select": "id,name,image",
                "order": "id.asc",
                "limit": page_size,
                "offset": offset,
            },
            timeout=60,
        )
        response.raise_for_status()
        batch = response.json()
        if not batch:
            break
        products.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    return products


def update_product_image(session: requests.Session, product_id: str, image: str) -> None:
    response = session.patch(
        f"{REST_BASE}/products",
        params={"id": f"eq.{product_id}"},
        json={"image": image},
        headers={"Prefer": "return=minimal"},
        timeout=60,
    )
    response.raise_for_status()


def migrate_product_image(
    session: requests.Session,
    product: Dict,
    cache: Dict[str, Tuple[str, str]],
) -> Tuple[bool, str]:
    product_id = str(product["id"])
    current_image = str(product.get("image") or "").strip()
    if not current_image:
        return False, "empty"

    tokens = split_image_field(current_image)
    if not tokens:
        return False, "empty"

    migrated_tokens: List[str] = []
    changed = False

    for index, token in enumerate(tokens):
        normalized = normalize_source_token(token)
        if "||" in normalized:
            migrated_tokens.append(normalized)
            continue

        if normalized.startswith("data:") or normalized.startswith("blob:") or normalized == "Images/default.png":
            migrated_tokens.append(normalized)
            continue

        if normalized in cache:
            thumb_url, full_url = cache[normalized]
            migrated_tokens.append(f"{thumb_url}||{full_url}")
            changed = True
            continue

        try:
            source_bytes, _, _ = fetch_source_bytes(session, normalized)
        except Exception as exc:
            print(f"  ! skip product {product_id} token {index + 1}: {exc}")
            migrated_tokens.append(normalized)
            continue

        object_prefix = storage_object_prefix(product_id, normalized)
        thumb_path = f"{object_prefix}__thumb.webp"
        full_path = f"{object_prefix}__full.webp"

        if is_supabase_public_url(normalized) or is_supabase_bucket_path(normalized):
            if normalized.startswith("http"):
                full_url = normalized
            else:
                bucket_name, rel_path = parse_bucket_path(normalized)
                full_url = public_storage_url(bucket_name or BUCKET_NAME, rel_path)
        else:
            try:
                full_content = resize_to_webp(source_bytes, (1600, 1600), 78)
                upload_object(session, BUCKET_NAME, full_path, full_content, "image/webp")
                full_url = public_storage_url(BUCKET_NAME, full_path)
            except Exception as exc:
                print(f"  ! full upload failed for product {product_id} token {index + 1}: {exc}")
                migrated_tokens.append(normalized)
                continue

        try:
            thumb_content = resize_to_webp(source_bytes, (360, 360), 70)
            upload_object(session, BUCKET_NAME, thumb_path, thumb_content, "image/webp")
            thumb_url = public_storage_url(BUCKET_NAME, thumb_path)
        except Exception as exc:
            print(f"  ! thumb upload failed for product {product_id} token {index + 1}: {exc}")
            migrated_tokens.append(normalized)
            continue

        cache[normalized] = (thumb_url, full_url)
        migrated_tokens.append(f"{thumb_url}||{full_url}")
        changed = True
        print(f"  OK migrated product {product_id} token {index + 1} -> thumb/full")

    new_image = ",".join(migrated_tokens)
    if changed and new_image != current_image:
        update_product_image(session, product_id, new_image)
        return True, "updated"

    return False, "unchanged"


def main() -> int:
    key = read_service_role_key()
    session = make_session(key)

    print("=== NewKet product image thumbnail backfill ===")
    print(f"Supabase: {SUPABASE_URL}")
    print(f"Bucket: {BUCKET_NAME}")

    products = read_products(session)
    print(f"Found {len(products)} products.")

    cache: Dict[str, Tuple[str, str]] = {}
    updated = 0
    skipped = 0
    unchanged = 0

    for product in products:
        try:
            did_update, status = migrate_product_image(session, product, cache)
            if did_update:
                updated += 1
            elif status == "unchanged":
                unchanged += 1
            else:
                skipped += 1
        except Exception as exc:
            skipped += 1
            print(f"  ! product {product.get('id')} failed: {exc}")

    print("")
    print(f"Summary: {updated} updated, {unchanged} unchanged, {skipped} skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
