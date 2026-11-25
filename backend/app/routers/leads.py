from __future__ import annotations

import math
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import LeadPost, Product
from app.schemas import (
    LeadListResponse,
    LeadPostResponse,
    LeadReplyRequest,
    LeadUpdateRequest,
    PaginationMeta,
)
from app.services.scraper import scraper_service

router = APIRouter(prefix="/api/leads", tags=["Leads"])


@router.get("", response_model=LeadListResponse)
async def list_leads(
    lead_status: Optional[str] = Query(
        default=None,
        alias="status",
        description="Filter by status: PENDING_REVIEW, COMMENTED, IGNORED, FAILED, or ALL",
    ),
    search: Optional[str] = Query(default=None, description="Search username, text, or keyword"),
    min_score: Optional[int] = Query(default=None, ge=0, le=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=18, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> LeadListResponse:
    # Status tab counts across all leads
    counts_stmt = select(LeadPost.status, func.count(LeadPost.id)).group_by(LeadPost.status)
    counts_res = await db.execute(counts_stmt)
    counts: Dict[str, int] = {
        "PENDING_REVIEW": 0,
        "COMMENTED": 0,
        "IGNORED": 0,
        "FAILED": 0,
    }
    for st, cnt in counts_res.all():
        counts[st] = int(cnt)
    counts["ALL"] = sum(counts.values())

    base_stmt = select(LeadPost).options(selectinload(LeadPost.matched_product))
    count_stmt = select(func.count(LeadPost.id))

    if lead_status and lead_status.upper() != "ALL":
        normalized_status = lead_status.upper()
        base_stmt = base_stmt.where(LeadPost.status == normalized_status)
        count_stmt = count_stmt.where(LeadPost.status == normalized_status)

    if min_score is not None:
        base_stmt = base_stmt.where(LeadPost.intent_score >= min_score)
        count_stmt = count_stmt.where(LeadPost.intent_score >= min_score)

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        search_filter = or_(
            LeadPost.author_username.ilike(pattern),
            LeadPost.post_text.ilike(pattern),
            LeadPost.keyword_matched.ilike(pattern),
            LeadPost.draft_reply.ilike(pattern),
        )
        base_stmt = base_stmt.where(search_filter)
        count_stmt = count_stmt.where(search_filter)

    total_items = int((await db.execute(count_stmt)).scalar_one())
    total_pages = max(1, math.ceil(total_items / page_size))

    # Prioritize highest intent leads first when reviewing queue
    if lead_status and lead_status.upper() == "PENDING_REVIEW":
        base_stmt = base_stmt.order_by(LeadPost.intent_score.desc(), LeadPost.scraped_at.desc())
    else:
        base_stmt = base_stmt.order_by(LeadPost.scraped_at.desc(), LeadPost.intent_score.desc())

    offset = (page - 1) * page_size
    rows = list((await db.execute(base_stmt.offset(offset).limit(page_size))).scalars().all())

    return LeadListResponse(
        items=[LeadPostResponse.model_validate(r) for r in rows],
        counts=counts,
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total_items=total_items,
            total_pages=total_pages,
        ),
    )


@router.get("/{lead_id}", response_model=LeadPostResponse)
async def get_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
) -> LeadPost:
    stmt = (
        select(LeadPost)
        .options(selectinload(LeadPost.matched_product))
        .where(LeadPost.id == lead_id)
    )
    lead = (await db.execute(stmt)).scalar_one_or_none()
    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with id={lead_id} not found.",
        )
    return lead


@router.patch("/{lead_id}", response_model=LeadPostResponse)
async def update_lead(
    lead_id: int,
    payload: LeadUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> LeadPost:
    stmt = (
        select(LeadPost)
        .options(selectinload(LeadPost.matched_product))
        .where(LeadPost.id == lead_id)
    )
    lead = (await db.execute(stmt)).scalar_one_or_none()
    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with id={lead_id} not found.",
        )

    updates = payload.model_dump(exclude_unset=True)
    if "matched_product_id" in updates and updates["matched_product_id"] is not None:
        product = await db.get(Product, updates["matched_product_id"])
        if product is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product with id={updates['matched_product_id']} does not exist.",
            )

    for field_name, value in updates.items():
        setattr(lead, field_name, value)

    await db.commit()
    refreshed = (
        await db.execute(
            select(LeadPost)
            .options(selectinload(LeadPost.matched_product))
            .where(LeadPost.id == lead_id)
        )
    ).scalar_one()
    return refreshed


@router.post("/{lead_id}/reply", response_model=LeadPostResponse)
async def trigger_lead_reply(
    lead_id: int,
    payload: Optional[LeadReplyRequest] = None,
    db: AsyncSession = Depends(get_db),
) -> LeadPost:
    lead = await db.get(LeadPost, lead_id)
    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with id={lead_id} not found.",
        )

    if payload and payload.draft_reply is not None:
        trimmed = payload.draft_reply.strip()
        if not trimmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Draft reply cannot be empty.",
            )
        lead.draft_reply = trimmed
        await db.commit()

    try:
        updated_lead = await scraper_service.send_reply(lead_id)
        return updated_lead
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Playwright reply failed: {exc}",
        ) from exc


@router.post("/{lead_id}/ignore", response_model=LeadPostResponse)
async def ignore_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
) -> LeadPost:
    stmt = (
        select(LeadPost)
        .options(selectinload(LeadPost.matched_product))
        .where(LeadPost.id == lead_id)
    )
    lead = (await db.execute(stmt)).scalar_one_or_none()
    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with id={lead_id} not found.",
        )

    lead.status = "IGNORED"
    await db.commit()
    return lead


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
) -> Response:
    lead = await db.get(LeadPost, lead_id)
    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with id={lead_id} not found.",
        )
    await db.delete(lead)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
