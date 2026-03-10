"""
models/schemas.py
-----------------
WHY THIS FILE EXISTS:
  FastAPI uses Pydantic models for two things:
  1. INPUT validation  — reject bad requests before they hit your DB
  2. OUTPUT serialization — control exactly what JSON shape the API returns

  These are NOT the same as SQLAlchemy DB models (those are in database/db.py).
  Think of these as "the shape of data crossing the API boundary."

PATTERN:
  - Base: shared fields
  - Create: what the client sends (POST body)
  - Response: what the API returns (always includes id + timestamps)
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


# ── Schema Field ──────────────────────────────────────────────────────────────

class SchemaField(BaseModel):
    """
    One field definition inside an ExtractionSchema.
    Tells the AI what to look for and what type to return.
    """
    name: str = Field(..., description="Field name, e.g. 'invoice_number'")
    type: str = Field(..., description="Data type: string | number | date | boolean | list")
    description: str = Field(..., description="What this field represents, used in the AI prompt")
    required: bool = Field(default=True)
    example: Optional[str] = Field(default=None, description="Example value to guide extraction")


# ── ExtractionSchema ──────────────────────────────────────────────────────────

class ExtractionSchemaCreate(BaseModel):
    name: str
    description: Optional[str] = None
    fields: list[SchemaField]


class ExtractionSchemaResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    fields: list[dict]
    created_at: datetime

    class Config:
        from_attributes = True  # allows creating from SQLAlchemy ORM objects


# ── Document ──────────────────────────────────────────────────────────────────

class DocumentResponse(BaseModel):
    id: str
    filename: str
    file_size: int
    page_count: Optional[int]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Extraction ────────────────────────────────────────────────────────────────

class ExtractionRequest(BaseModel):
    """What the client sends to trigger an extraction job."""
    document_id: str
    schema_id: str
    confidence_threshold: float = Field(
        default=0.75,
        ge=0.0,
        le=1.0,
        description="Fields below this confidence are flagged for human review"
    )


class ExtractionResultResponse(BaseModel):
    id: str
    document_id: str
    schema_id: str
    extracted_data: Optional[dict]
    confidence_scores: Optional[dict]
    overall_confidence: Optional[float]
    needs_review: bool
    reviewed: bool
    reviewed_data: Optional[dict]
    processing_time_ms: Optional[int]
    model_used: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewSubmission(BaseModel):
    """Human correction payload — submitted from the Review Queue UI."""
    corrected_data: dict[str, Any]


# ── Export ────────────────────────────────────────────────────────────────────

class ExportRequest(BaseModel):
    result_ids: list[str]
    format: str = Field(default="json", description="json | csv | excel")


# ── Stats ─────────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_documents: int
    total_extractions: int
    avg_confidence: float
    pending_review: int
    reviewed_today: int
