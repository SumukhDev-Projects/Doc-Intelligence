"""
services/pdf_parser.py
----------------------
WHY THIS FILE EXISTS:
  Before the AI can extract data, we need raw text from the PDF.
  This service handles ALL document parsing — PDFs, images, text files.
  It's isolated here so swapping parsers (e.g., switching from pdfplumber
  to a different library) only touches this one file.

WHAT IT DOES:
  1. Extracts text page-by-page from PDFs using pdfplumber
  2. Extracts table data from PDFs (the hard part most tools skip)
  3. Returns a structured ParsedDocument with per-page content
  4. Handles parse errors gracefully without crashing the whole pipeline

KEY DECISION — Why pdfplumber over PyMuPDF?
  pdfplumber is better at table extraction (uses pdfminer under the hood).
  PyMuPDF is faster for pure text. We use pdfplumber as primary, PyMuPDF as fallback.
"""

import pdfplumber
import fitz  # PyMuPDF — used as fallback
from dataclasses import dataclass
from typing import Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class ParsedPage:
    """Represents one page of extracted content."""
    page_number: int
    text: str                        # raw text content
    tables: list[list[list[str]]]    # list of tables, each table is rows of cells
    char_count: int


@dataclass
class ParsedDocument:
    """Full document parse result."""
    pages: list[ParsedPage]
    total_pages: int
    total_chars: int
    has_tables: bool
    parse_method: str                # "pdfplumber" or "pymupdf" (for debugging)

    def full_text(self) -> str:
        """Returns all pages concatenated — used as context for the AI."""
        return "\n\n--- PAGE BREAK ---\n\n".join(
            f"[Page {p.page_number}]\n{p.text}" for p in self.pages
        )

    def tables_as_text(self) -> str:
        """
        Converts extracted tables to markdown-style text.
        This is critical for invoices, financial statements, any tabular data.
        """
        if not self.has_tables:
            return ""

        result = []
        for page in self.pages:
            for i, table in enumerate(page.tables):
                result.append(f"\n[Table {i+1} on Page {page.page_number}]")
                if table and table[0]:
                    # First row as header
                    headers = " | ".join(str(cell or "") for cell in table[0])
                    result.append(headers)
                    result.append("-" * len(headers))
                    for row in table[1:]:
                        result.append(" | ".join(str(cell or "") for cell in row))
        return "\n".join(result)


class PDFParser:
    """
    Parses PDF documents into structured text + table data.
    
    Usage:
        parser = PDFParser()
        doc = parser.parse("/path/to/invoice.pdf")
        print(doc.full_text())
    """

    def parse(self, file_path: str) -> ParsedDocument:
        """
        Main entry point. Tries pdfplumber first, falls back to PyMuPDF.
        Returns a ParsedDocument regardless of which method succeeded.
        """
        try:
            return self._parse_with_pdfplumber(file_path)
        except Exception as e:
            logger.warning(f"pdfplumber failed for {file_path}: {e}. Falling back to PyMuPDF.")
            return self._parse_with_pymupdf(file_path)

    def _parse_with_pdfplumber(self, file_path: str) -> ParsedDocument:
        """
        Primary parser. Better at tables because it understands PDF's
        underlying coordinate system for cell boundaries.
        """
        pages = []

        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages):
                # Extract text — preserves layout better than raw extraction
                text = page.extract_text(x_tolerance=2, y_tolerance=2) or ""

                # Extract tables — each table is list[list[str]]
                raw_tables = page.extract_tables() or []
                # Clean None values from cells
                tables = [
                    [[str(cell) if cell is not None else "" for cell in row] for row in table]
                    for table in raw_tables
                ]

                pages.append(ParsedPage(
                    page_number=i + 1,
                    text=text,
                    tables=tables,
                    char_count=len(text)
                ))

        total_chars = sum(p.char_count for p in pages)
        has_tables = any(len(p.tables) > 0 for p in pages)

        return ParsedDocument(
            pages=pages,
            total_pages=len(pages),
            total_chars=total_chars,
            has_tables=has_tables,
            parse_method="pdfplumber"
        )

    def _parse_with_pymupdf(self, file_path: str) -> ParsedDocument:
        """
        Fallback parser. Faster, handles more corrupt PDFs,
        but less accurate for table extraction.
        """
        pages = []
        doc = fitz.open(file_path)

        for i, page in enumerate(doc):
            text = page.get_text("text") or ""
            pages.append(ParsedPage(
                page_number=i + 1,
                text=text,
                tables=[],  # PyMuPDF table extraction requires extra setup
                char_count=len(text)
            ))

        doc.close()

        return ParsedDocument(
            pages=pages,
            total_pages=len(pages),
            total_chars=sum(p.char_count for p in pages),
            has_tables=False,
            parse_method="pymupdf"
        )
