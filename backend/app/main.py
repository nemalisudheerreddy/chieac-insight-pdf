"""FastAPI entry point for ChiEAC InsightPDF.

Project designed and implemented by Sudheer Reddy Nemali for ChiEAC.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .rag import answer_question, index_pdf, remove_session
from .schemas import AskRequest, AskResponse

load_dotenv()

app = FastAPI(
    title="ChiEAC InsightPDF API",
    description="Upload a PDF and ask grounded questions about its contents.",
    version="1.0.0",
)

# FRONTEND_ORIGIN may contain one URL or a comma-separated list of URLs.
allowed_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict:
    return {
        "name": "ChiEAC InsightPDF API",
        "status": "online",
        "created_by": "Sudheer Reddy Nemali",
    }


@app.get("/health")
def health() -> dict:
    return {"status": "healthy"}


@app.post("/api/upload")
async def upload_pdf(
    session_id: str = Form(...),
    file: UploadFile = File(...),
) -> dict:
    """Receive one PDF and build its searchable vector index."""

    if file.content_type != "application/pdf" and not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(file_bytes) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="The PDF must be 15 MB or smaller.")

    try:
        result = index_pdf(session_id, file.filename, file_bytes)
        return {"message": "Document is ready for questions.", **result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to process this PDF: {exc}") from exc


@app.post("/api/ask", response_model=AskResponse)
def ask_question(payload: AskRequest) -> dict:
    """Answer a question using the document stored for the session."""

    try:
        return answer_question(payload.session_id, payload.question.strip())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to answer the question: {exc}") from exc


@app.delete("/api/session/{session_id}")
def clear_session(session_id: str) -> dict:
    """Clear a user's uploaded document."""

    removed = remove_session(session_id)
    return {"removed": removed}
