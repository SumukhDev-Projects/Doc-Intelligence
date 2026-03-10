"""
main.py
-------
WHY THIS FILE EXISTS:
  The FastAPI application entry point. This is what uvicorn runs.
  All routes are defined here — in a larger app you'd split into routers,
  but for clarity everything is in one file so you can read the full API surface.

ARCHITECTURE:
  Request → Route Handler → Service/Agent → Database
                                ↓
                           Claude API (for extraction routes)

ROUTE GROUPS:
  /documents  — upload and manage PDF documents
  /schemas    — create and manage extraction schemas
  /extract    — run AI extraction jobs
  /review     — human review queue for low-confidence extractions
  /export     — download results as JSON/CSV/Excel
  /stats      — dashboard statistics
"""

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func
import uuid
import os
import aiofiles
from datetime import datetime, date

from database.db import get_db, create_tables, Document, ExtractionSchema, ExtractionResult
from models.schemas import (
    ExtractionSchemaCreate, ExtractionSchemaResponse,
    DocumentResponse, ExtractionRequest, ExtractionResultResponse,
    ReviewSubmission, ExportRequest, DashboardStats
)
from agents.extractor import ExtractionAgent
from services.pdf_parser import PDFParser
from services.exporter import ExportService

# ── App Setup ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Document Intelligence API",
    description="Extract structured data from documents using AI",
    version="1.0.0",
    docs_url="/docs",    # Swagger UI at /docs
    redoc_url="/redoc"   # ReDoc at /redoc
)

# CORS — allows the React frontend (localhost:3000) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Instantiate services (stateless, safe to share)
pdf_parser = PDFParser()
extraction_agent = ExtractionAgent()
export_service = ExportService()


@app.on_event("startup")
async def startup():
    """Create DB tables on first run. Idempotent — safe to run every time."""
    create_tables()


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "doc-intelligence-api"}


# ── Documents ─────────────────────────────────────────────────────────────────

@app.post("/documents/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Accepts a PDF upload, saves it to disk, parses page count.
    Returns document metadata — NOT the extraction result yet.
    Extraction is a separate step triggered by POST /extract.
    
    WHY SEPARATE UPLOAD + EXTRACT?
    Lets users upload a batch of documents, then choose which schema
    to run against each one. More flexible than a single upload+extract endpoint.
    """
    # Validate file type
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported currently.")

    doc_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{doc_id}_{file.filename}")

    # Save file to disk asynchronously
    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    # Quick parse to get page count (lightweight, no AI)
    try:
        parsed = pdf_parser.parse(file_path)
        page_count = parsed.total_pages
    except Exception:
        page_count = None

    # Save document record to DB
    doc = Document(
        id=doc_id,
        filename=file.filename,
        file_path=file_path,
        file_size=len(content),
        page_count=page_count,
        status="uploaded"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return doc


@app.get("/documents", response_model=list[DocumentResponse])
def list_documents(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """Returns all uploaded documents, newest first."""
    return db.query(Document).order_by(Document.created_at.desc()).offset(skip).limit(limit).all()


@app.get("/documents/{doc_id}", response_model=DocumentResponse)
def get_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # Delete file from disk
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    db.delete(doc)
    db.commit()
    return {"deleted": doc_id}


# ── Schemas ───────────────────────────────────────────────────────────────────

@app.post("/schemas", response_model=ExtractionSchemaResponse)
def create_schema(schema: ExtractionSchemaCreate, db: Session = Depends(get_db)):
    """
    Creates a reusable extraction schema.
    A schema defines what fields to extract from documents.
    One schema can be applied to many documents.
    """
    db_schema = ExtractionSchema(
        id=str(uuid.uuid4()),
        name=schema.name,
        description=schema.description,
        fields=[f.model_dump() for f in schema.fields]
    )
    db.add(db_schema)
    db.commit()
    db.refresh(db_schema)
    return db_schema


@app.get("/schemas", response_model=list[ExtractionSchemaResponse])
def list_schemas(db: Session = Depends(get_db)):
    return db.query(ExtractionSchema).order_by(ExtractionSchema.created_at.desc()).all()


@app.get("/schemas/{schema_id}", response_model=ExtractionSchemaResponse)
def get_schema(schema_id: str, db: Session = Depends(get_db)):
    schema = db.query(ExtractionSchema).filter(ExtractionSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found")
    return schema


@app.delete("/schemas/{schema_id}")
def delete_schema(schema_id: str, db: Session = Depends(get_db)):
    schema = db.query(ExtractionSchema).filter(ExtractionSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found")
    db.delete(schema)
    db.commit()
    return {"deleted": schema_id}


# ── Extraction ────────────────────────────────────────────────────────────────

@app.post("/extract", response_model=ExtractionResultResponse)
def run_extraction(
    request: ExtractionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Core endpoint: runs the AI extraction agent.
    
    Flow:
    1. Load document + schema from DB
    2. Parse PDF into text + tables
    3. Run ExtractionAgent (calls Claude API)
    4. Save result to DB
    5. Return result with confidence scores
    
    This is synchronous for simplicity. In production you'd use
    Celery or background tasks for large documents.
    """
    # Load document
    doc = db.query(Document).filter(Document.id == request.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Load schema
    schema = db.query(ExtractionSchema).filter(ExtractionSchema.id == request.schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found")

    # Mark as processing
    doc.status = "processing"
    db.commit()

    try:
        # Parse document
        parsed_doc = pdf_parser.parse(doc.file_path)

        # Run AI extraction
        result = extraction_agent.extract(
            document=parsed_doc,
            schema_fields=schema.fields,
            confidence_threshold=request.confidence_threshold
        )

        # Save result
        db_result = ExtractionResult(
            id=str(uuid.uuid4()),
            document_id=doc.id,
            schema_id=schema.id,
            extracted_data=result["extracted_data"],
            confidence_scores=result["confidence_scores"],
            overall_confidence=result["overall_confidence"],
            needs_review=result["needs_review"],
            processing_time_ms=result["processing_time_ms"],
            model_used=result["model_used"]
        )
        db.add(db_result)

        doc.status = "done"
        db.commit()
        db.refresh(db_result)

        return db_result

    except Exception as e:
        doc.status = "error"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@app.get("/extract/results", response_model=list[ExtractionResultResponse])
def list_results(
    needs_review: bool = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Returns extraction results, optionally filtered to only those needing review."""
    query = db.query(ExtractionResult).order_by(ExtractionResult.created_at.desc())
    if needs_review is not None:
        query = query.filter(ExtractionResult.needs_review == needs_review)
    return query.offset(skip).limit(limit).all()


@app.get("/extract/results/{result_id}", response_model=ExtractionResultResponse)
def get_result(result_id: str, db: Session = Depends(get_db)):
    result = db.query(ExtractionResult).filter(ExtractionResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    return result


# ── Review ────────────────────────────────────────────────────────────────────

@app.post("/review/{result_id}", response_model=ExtractionResultResponse)
def submit_review(
    result_id: str,
    submission: ReviewSubmission,
    db: Session = Depends(get_db)
):
    """
    Human review endpoint — accepts corrected data for a flagged extraction.
    
    WHY THIS MATTERS:
    Low-confidence extractions are shown to a human reviewer who can correct
    the values. The corrected data is stored separately from AI-extracted data,
    so you can always see what the AI got wrong vs. what was corrected.
    This creates a feedback loop — in a future version, corrections could
    fine-tune the model.
    """
    result = db.query(ExtractionResult).filter(ExtractionResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")

    result.reviewed_data = submission.corrected_data
    result.reviewed = True
    result.reviewed_at = datetime.utcnow()
    result.needs_review = False  # Reviewed — remove from queue
    db.commit()
    db.refresh(result)

    return result


# ── Export ────────────────────────────────────────────────────────────────────

@app.post("/export")
def export_results(request: ExportRequest, db: Session = Depends(get_db)):
    """
    Exports a list of extraction results as JSON, CSV, or Excel.
    Uses reviewed_data if available, otherwise extracted_data.
    """
    results = db.query(ExtractionResult).filter(
        ExtractionResult.id.in_(request.result_ids)
    ).all()

    if not results:
        raise HTTPException(status_code=404, detail="No results found for given IDs")

    content, content_type = export_service.export(results, request.format)

    ext_map = {"json": "json", "csv": "csv", "excel": "xlsx"}
    filename = f"extractions_{date.today()}.{ext_map.get(request.format, 'json')}"

    return Response(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ── Stats ─────────────────────────────────────────────────────────────────────

@app.get("/stats", response_model=DashboardStats)
def get_stats(db: Session = Depends(get_db)):
    """Returns dashboard statistics for the overview cards in the UI."""
    today = date.today()

    total_docs = db.query(func.count(Document.id)).scalar()
    total_extractions = db.query(func.count(ExtractionResult.id)).scalar()
    avg_conf = db.query(func.avg(ExtractionResult.overall_confidence)).scalar() or 0.0
    pending_review = db.query(func.count(ExtractionResult.id)).filter(
        ExtractionResult.needs_review == True,
        ExtractionResult.reviewed == False
    ).scalar()
    reviewed_today = db.query(func.count(ExtractionResult.id)).filter(
        func.date(ExtractionResult.reviewed_at) == today
    ).scalar()

    return DashboardStats(
        total_documents=total_docs,
        total_extractions=total_extractions,
        avg_confidence=round(float(avg_conf), 3),
        pending_review=pending_review,
        reviewed_today=reviewed_today
    )
