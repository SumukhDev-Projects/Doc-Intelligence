"""
database/db.py
--------------
WHY THIS FILE EXISTS:
  Sets up the PostgreSQL connection using SQLAlchemy ORM.
  Defines all database tables as Python classes (models).
  Every table in your Postgres DB maps to a class here.

WHAT IT DOES:
  - Creates the DB engine (the connection pool to Postgres)
  - Defines 3 tables: Document, ExtractionSchema, ExtractionResult
  - `get_db()` is a FastAPI dependency injected into every route that needs DB access
"""

from sqlalchemy import (
    create_engine, Column, String, Integer, Float,
    DateTime, Text, JSON, ForeignKey, Boolean
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

# ── Engine & Session ──────────────────────────────────────────────────────────
# create_engine: opens the connection pool to Postgres
# pool_pre_ping: validates connections before use (prevents stale connection errors)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://docint:docint_secret@db:5432/doc_intelligence")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# SessionLocal: factory for DB sessions. Each request gets its own session.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base: all ORM models inherit from this
Base = declarative_base()


# ── Models (DB Tables) ────────────────────────────────────────────────────────

class Document(Base):
    """
    Stores metadata for every uploaded document.
    Does NOT store the file itself — that lives in /uploads on disk.
    """
    __tablename__ = "documents"

    id = Column(String, primary_key=True)                    # UUID
    filename = Column(String, nullable=False)                # original file name
    file_path = Column(String, nullable=False)               # path on disk
    file_size = Column(Integer)                              # bytes
    page_count = Column(Integer)                             # number of PDF pages
    status = Column(String, default="uploaded")              # uploaded | processing | done | error
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # One document can have many extraction results
    results = relationship("ExtractionResult", back_populates="document", cascade="all, delete")


class ExtractionSchema(Base):
    """
    Stores user-defined extraction schemas.
    A schema is a JSON spec of what fields to extract from documents.
    Example: {"invoice_number": "string", "total_amount": "number", "vendor": "string"}
    """
    __tablename__ = "extraction_schemas"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)                    # e.g. "Invoice Schema"
    description = Column(Text)                               # what this schema is for
    fields = Column(JSON, nullable=False)                    # list of field definitions
    created_at = Column(DateTime, default=datetime.utcnow)

    results = relationship("ExtractionResult", back_populates="schema")


class ExtractionResult(Base):
    """
    Stores the result of running a schema against a document.
    This is the core output table — what fields were extracted,
    with what confidence, and whether a human has reviewed/corrected them.
    """
    __tablename__ = "extraction_results"

    id = Column(String, primary_key=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    schema_id = Column(String, ForeignKey("extraction_schemas.id"), nullable=False)
    extracted_data = Column(JSON)                            # the actual extracted values
    confidence_scores = Column(JSON)                         # per-field confidence 0.0–1.0
    overall_confidence = Column(Float)                       # average confidence
    needs_review = Column(Boolean, default=False)            # flagged if confidence < threshold
    reviewed = Column(Boolean, default=False)                # human has reviewed this
    reviewed_data = Column(JSON)                             # human-corrected values
    reviewed_at = Column(DateTime)
    processing_time_ms = Column(Integer)                     # how long extraction took
    model_used = Column(String)                              # which Claude model was used
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="results")
    schema = relationship("ExtractionSchema", back_populates="results")


# ── Dependency ────────────────────────────────────────────────────────────────

def get_db():
    """
    FastAPI dependency. Yields a DB session per request, always closes it.
    Usage in routes: db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Called once at startup to create all tables if they don't exist."""
    Base.metadata.create_all(bind=engine)
