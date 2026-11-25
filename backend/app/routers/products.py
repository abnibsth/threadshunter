from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Product
from app.schemas import ProductCreate, ProductResponse, ProductUpdate

router = APIRouter(prefix="/api/products", tags=["Products"])


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
    product = Product(**payload.model_dump())
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
