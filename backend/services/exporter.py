"""
services/exporter.py
--------------------
WHY THIS FILE EXISTS:
  Extraction results need to leave the system in usable formats.
  This service handles JSON, CSV, and Excel exports.
  It's isolated here so adding new formats (e.g., XML, Google Sheets)
  is a one-file change.

WHAT IT DOES:
  - Takes a list of ExtractionResult ORM objects
  - Flattens nested JSON (extracted_data, confidence_scores) into rows
  - Returns bytes + content_type for FastAPI's Response()
"""

import json
import io
import pandas as pd
from database.db import ExtractionResult
import logging

logger = logging.getLogger(__name__)


class ExportService:

    def export(self, results: list[ExtractionResult], format: str) -> tuple[bytes, str]:
        """
        Exports results in the requested format.
        Returns (file_bytes, content_type) tuple for streaming response.
        """
        if format == "json":
            return self._to_json(results)
        elif format == "csv":
            return self._to_csv(results)
        elif format == "excel":
            return self._to_excel(results)
        else:
            raise ValueError(f"Unsupported format: {format}. Use json, csv, or excel.")

    def _build_rows(self, results: list[ExtractionResult]) -> list[dict]:
        """
        Flattens each result into a flat dict row.
        extracted_data fields become top-level columns.
        confidence_scores become confidence_[field] columns.
        """
        rows = []
        for result in results:
            row = {
                "result_id": result.id,
                "document_id": result.document_id,
                "schema_id": result.schema_id,
                "overall_confidence": result.overall_confidence,
                "needs_review": result.needs_review,
                "reviewed": result.reviewed,
                "created_at": str(result.created_at),
            }

            # Use reviewed data if available, otherwise extracted data
            data = result.reviewed_data or result.extracted_data or {}
            for key, value in data.items():
                row[key] = value

            # Add per-field confidence
            for key, value in (result.confidence_scores or {}).items():
                row[f"confidence_{key}"] = value

            rows.append(row)
        return rows

    def _to_json(self, results: list[ExtractionResult]) -> tuple[bytes, str]:
        rows = self._build_rows(results)
        content = json.dumps(rows, indent=2, default=str).encode("utf-8")
        return content, "application/json"

    def _to_csv(self, results: list[ExtractionResult]) -> tuple[bytes, str]:
        rows = self._build_rows(results)
        df = pd.DataFrame(rows)
        buffer = io.StringIO()
        df.to_csv(buffer, index=False)
        return buffer.getvalue().encode("utf-8"), "text/csv"

    def _to_excel(self, results: list[ExtractionResult]) -> tuple[bytes, str]:
        rows = self._build_rows(results)
        df = pd.DataFrame(rows)
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Extractions")
            # Auto-size columns
            worksheet = writer.sheets["Extractions"]
            for col in worksheet.columns:
                max_length = max(len(str(cell.value or "")) for cell in col)
                worksheet.column_dimensions[col[0].column_letter].width = min(max_length + 2, 50)
        return buffer.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
