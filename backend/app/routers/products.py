from __future__ import annotations

import csv
import io
import re
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Product
from app.schemas import (
    BulkProductImportRequest,
    BulkProductImportResponse,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
)

router = APIRouter(prefix="/api/products", tags=["Products"])

ALLOWED_SHOPEE_HOSTS = {
    "s.shopee.co.id",
    "shp.ee",
    "id.shp.ee",
    "shopee.co.id",
    "www.shopee.co.id",
}

SHOPEE_SHORTLINK_RE = re.compile(
    r"https?://(?:s\.shopee\.co\.id|(?:id\.)?shp\.ee)/[A-Za-z0-9_-]+",
    flags=re.IGNORECASE,
)
ANY_SHOPEE_URL_RE = re.compile(
    r"https?://(?:s\.shopee\.co\.id|(?:id\.)?shp\.ee|(?:www\.)?shopee\.co\.id)/\S+",
    flags=re.IGNORECASE,
)


def validate_user_shopee_link(url: str) -> str:
    cleaned = (url or "").strip()
    if "example-" in cleaned.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Link masih berupa link contoh (example). Gunakan link resmi dari akun Shopee Affiliate kamu.",
        )

    parsed = urlparse(cleaned)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"} or host not in ALLOWED_SHOPEE_HOSTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Affiliate link wajib berasal dari Shopee Affiliate Indonesia (https://s.shopee.co.id/... atau https://shp.ee/...).",
        )
    return cleaned


def _infer_category_and_keywords(name: str, default_category: str) -> Tuple[str, str]:
    lower = name.lower()
    category_rules = [
        ("Parfum & Fragrance", ["parfum", "edp", "eau de", "fragrance", "extrait", "decant", "scent"]),
        ("Audio & Gadget", ["tws", "headphone", "earphone", "sony", "anker", "charger", "kabel", "hub", "usb", "powerbank", "kipas", "goojodoq", "ugreen"]),
        ("Home Office", ["keyboard", "mouse", "monitor", "desk", "kursi", "lampu meja", "stand laptop"]),
        ("Skincare & Beauty", ["skincare", "moisturizer", "serum", "sunscreen", "cushion", "toner", "facial", "ceramide"]),
        ("Fashion & Tas", ["tas", "kemeja", "celana", "sepatu", "jaket", "topi", "slingbag", "backpack"]),
    ]

    chosen_cat = default_category or "Shopee Affiliate"
    for cat_label, hints in category_rules:
        if any(h in lower for h in hints):
            chosen_cat = cat_label
            break

    stop_words = {
        "for", "and", "with", "the", "original", "official", "garansi", "resmi",
        "murah", "promo", "cod", "new", "terbaru", "pria", "wanita", "unisex", "in",
    }
    words = re.findall(r"[A-Za-z0-9]{3,}", lower)
    seen: List[str] = []
    for w in words:
        if w not in stop_words and w not in seen:
            seen.append(w)
        if len(seen) >= 7:
            break
    return chosen_cat, ", ".join(seen)


def _format_price_str(raw_price: str) -> str:
    val = (raw_price or "").strip()
    if not val:
        return ""
    if val.lower().startswith("rp"):
        return val
    digits = re.sub(r"[^\d]", "", val)
    if digits:
        num = int(digits)
        return f"Rp {num:,}".replace(",", ".")
    return val


def _parse_shopee_bulk_text(
    raw_text: str, default_category: str
) -> Tuple[List[Dict[str, str]], int]:
    text = raw_text.lstrip("\ufeff").strip()
    items: List[Dict[str, str]] = []
    skipped = 0

    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not lines:
        return [], 0

    # 1. Detect Shopee Affiliate CSV ("Buat Link Massal" export)
    first_line_lower = lines[0].lower()
    is_csv = (
        ("," in lines[0] or ";" in lines[0] or "\t" in lines[0])
        and any(
            header_kw in first_line_lower
            for header_kw in ("nama produk", "item name", "product name", "link komisi", "offer link", "short link")
        )
    )

    if is_csv:
        delimiter = "\t" if "\t" in lines[0] else (";" if lines[0].count(";") > lines[0].count(",") else ",")
        reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
        for row in reader:
            norm_row = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
            name = (
                norm_row.get("nama produk")
                or norm_row.get("item name")
                or norm_row.get("product name")
                or norm_row.get("nama item")
                or ""
            )
            # Prioritize Affiliate Commission Link (Link Komisi / Offer Link / Short Link) over raw Product Link!
            aff_link = (
                norm_row.get("link komisi")
                or norm_row.get("offer link")
                or norm_row.get("short link")
                or norm_row.get("tautan pendek")
                or norm_row.get("link affiliate")
                or ""
            )
            if not aff_link:
                # Scan row values for s.shopee.co.id / shp.ee shortlink
                for cell in norm_row.values():
                    m = SHOPEE_SHORTLINK_RE.search(cell)
                    if m:
                        aff_link = m.group(0)
                        break

            price = (
                norm_row.get("harga")
                or norm_row.get("price")
                or norm_row.get("harga diskon")
                or ""
            )
            shop_name = norm_row.get("nama toko") or norm_row.get("shop name") or ""

            if not name or not aff_link:
                skipped += 1
                continue

            cat, kw = _infer_category_and_keywords(name, default_category)
            points = f"produk original dari {shop_name}, banyak review positif" if shop_name else "produk original berkualitas, review pembeli bagus"
            items.append(
                {
                    "name": name[:255],
                    "category": cat,
                    "keywords": kw,
                    "price_range": _format_price_str(price)[:100],
                    "selling_points": points,
                    "affiliate_link": aff_link.rstrip(".,;)"),
                }
            )
        return items, skipped

    # 2. Free-form text paste (e.g., copied blocks or "Nama Produk | Harga | https://s.shopee.co.id/...")
    pending_lines: List[str] = []
    for raw_line in lines:
        line = raw_line.strip()
        match = SHOPEE_SHORTLINK_RE.search(line) or ANY_SHOPEE_URL_RE.search(line)
        if not match:
            pending_lines.append(line)
            continue

        link = match.group(0).rstrip(".,;)")
        remainder = line.replace(match.group(0), " ").strip(" -|:\t,;")

        price_found = ""
        price_match = re.search(r"Rp\.?\s?[\d\.,]+(?:\s?-\s?Rp\.?\s?[\d\.,]+)?", remainder, re.IGNORECASE)
        if not price_match and pending_lines:
            for pl in pending_lines:
                pm = re.search(r"Rp\.?\s?[\d\.,]+", pl, re.IGNORECASE)
                if pm:
                    price_match = pm
                    break
        if price_match:
            price_found = price_match.group(0).strip()
            remainder = remainder.replace(price_found, " ").strip(" -|:\t,;")

        name_candidate = remainder
        if not name_candidate and pending_lines:
            # Take first meaningful non-price line from preceding lines in block
            for pl in pending_lines:
                cleaned_pl = re.sub(r"^[\-\*\d\.\)\s]+", "", pl).strip()
                if len(cleaned_pl) >= 4 and not cleaned_pl.lower().startswith(("komisi", "terjual", "rp")):
                    name_candidate = cleaned_pl
                    break

        pending_lines = []
        if not name_candidate:
            skipped += 1
            continue

        cat, kw = _infer_category_and_keywords(name_candidate, default_category)
        items.append(
            {
                "name": name_candidate[:255],
                "category": cat,
                "keywords": kw,
                "price_range": price_found[:100],
                "selling_points": "produk recommended, kualitas oke sesuai harga",
                "affiliate_link": link,
            }
        )

    return items, skipped


@router.get("", response_model=List[ProductResponse])
async def list_products(
    search: Optional[str] = Query(default=None, description="Search name, category, or keywords"),
    category: Optional[str] = Query(default=None, description="Filter by category"),
    active_only: bool = Query(default=False, description="Return only active products"),
    db: AsyncSession = Depends(get_db),
) -> List[Product]:
    stmt = select(Product).order_by(Product.created_at.desc(), Product.id.desc())

    if active_only:
        stmt = stmt.where(Product.is_active.is_(True))

    if category and category.strip() and category.lower() != "all":
        stmt = stmt.where(Product.category.ilike(category.strip()))

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Product.name.ilike(pattern),
                Product.category.ilike(pattern),
                Product.keywords.ilike(pattern),
                Product.selling_points.ilike(pattern),
            )
        )

    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/bulk-import", response_model=BulkProductImportResponse)
async def bulk_import_shopee_products(
    payload: BulkProductImportRequest,
    db: AsyncSession = Depends(get_db),
) -> BulkProductImportResponse:
    parsed_items, skipped = _parse_shopee_bulk_text(
        payload.raw_text, payload.default_category
    )
    if not parsed_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Tidak ditemukan pasangan Nama Produk + Link Shopee Affiliate (https://s.shopee.co.id/...). "
                "Upload CSV dari 'Buat Link Massal' Shopee Affiliate atau paste daftar Nama Produk + Link."
            ),
        )

    existing_res = await db.execute(select(Product))
    existing_by_link = {p.affiliate_link.strip(): p for p in existing_res.scalars().all()}

    imported_count = 0
    updated_count = 0
    touched: List[Product] = []

    for item in parsed_items:
        try:
            clean_link = validate_user_shopee_link(item["affiliate_link"])
        except HTTPException:
            skipped += 1
            continue

        if clean_link in existing_by_link:
            prod = existing_by_link[clean_link]
            prod.name = item["name"]
            if item["price_range"]:
                prod.price_range = item["price_range"]
            prod.is_active = True
            updated_count += 1
            touched.append(prod)
        else:
            prod = Product(
                name=item["name"],
                category=item["category"],
                keywords=item["keywords"],
                price_range=item["price_range"],
                selling_points=item["selling_points"],
                affiliate_link=clean_link,
                is_active=True,
            )
            db.add(prod)
            existing_by_link[clean_link] = prod
            imported_count += 1
            touched.append(prod)

    await db.commit()
    for prod in touched:
        await db.refresh(prod)

    return BulkProductImportResponse(
        imported_count=imported_count,
        updated_count=updated_count,
        skipped_count=skipped,
        items=[ProductResponse.model_validate(p) for p in touched],
    )


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
) -> Product:
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id={product_id} not found.",
        )
    return product


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
) -> Product:
    data = payload.model_dump()
    data["affiliate_link"] = validate_user_shopee_link(data["affiliate_link"])
    product = Product(**data)
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.patch("/{product_id}", response_model=ProductResponse)
@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: AsyncSession = Depends(get_db),
) -> Product:
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id={product_id} not found.",
        )

    updates = payload.model_dump(exclude_unset=True)
    if "affiliate_link" in updates and updates["affiliate_link"] is not None:
        updates["affiliate_link"] = validate_user_shopee_link(updates["affiliate_link"])

    for field_name, value in updates.items():
        setattr(product, field_name, value)

    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
) -> Response:
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id={product_id} not found.",
        )

    await db.delete(product)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
