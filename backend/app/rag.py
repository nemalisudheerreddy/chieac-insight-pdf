"""Core Retrieval-Augmented Generation logic.

Created for the ChiEAC Data Science Alliance project by Sudheer Reddy Nemali.
The implementation intentionally avoids a heavy vector-database dependency so
that the demo is simple to understand and inexpensive to deploy.
"""

from __future__ import annotations

import io
import os
from dataclasses import dataclass
from threading import Lock

import numpy as np
from openai import OpenAI
from pypdf import PdfReader


@dataclass
class Chunk:
    """One searchable section of a PDF."""

    text: str
    page: int
    embedding: np.ndarray


# In-memory storage is enough for a portfolio demo. Each browser receives its
# own session ID, so uploaded documents remain isolated from other visitors.
_SESSIONS: dict[str, dict] = {}
_SESSION_LOCK = Lock()


def _client() -> OpenAI:
    """Create the OpenAI client only when an API operation is requested."""

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured on the server.")
    return OpenAI(api_key=api_key)


def _clean_text(text: str) -> str:
    """Normalize whitespace while preserving readable sentences."""

    return " ".join(text.replace("\x00", " ").split())


def _split_text(text: str, chunk_size: int = 1200, overlap: int = 180) -> list[str]:
    """Split text into overlapping chunks without cutting every sentence abruptly."""

    if len(text) <= chunk_size:
        return [text] if text.strip() else []

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        candidate = text[start:end]

        # Prefer ending at natural punctuation when possible.
        if end < len(text):
            natural_end = max(candidate.rfind(". "), candidate.rfind("? "), candidate.rfind("! "))
            if natural_end > chunk_size * 0.6:
                end = start + natural_end + 1
                candidate = text[start:end]

        candidate = candidate.strip()
        if candidate:
            chunks.append(candidate)

        if end >= len(text):
            break
        start = max(end - overlap, start + 1)

    return chunks


def _embed_texts(texts: list[str]) -> list[np.ndarray]:
    """Create normalized OpenAI embeddings in one batched request."""

    model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    response = _client().embeddings.create(model=model, input=texts)
    vectors: list[np.ndarray] = []

    for item in response.data:
        vector = np.asarray(item.embedding, dtype=np.float32)
        norm = np.linalg.norm(vector)
        vectors.append(vector / norm if norm else vector)

    return vectors


def index_pdf(session_id: str, filename: str, file_bytes: bytes) -> dict:
    """Extract, chunk, embed, and save a PDF for one browser session."""

    reader = PdfReader(io.BytesIO(file_bytes))
    page_chunks: list[tuple[str, int]] = []

    for page_number, page in enumerate(reader.pages, start=1):
        page_text = _clean_text(page.extract_text() or "")
        for chunk_text in _split_text(page_text):
            page_chunks.append((chunk_text, page_number))

    if not page_chunks:
        raise ValueError(
            "No readable text was found. Please upload a text-based PDF rather than a scanned image PDF."
        )

    embeddings = _embed_texts([text for text, _ in page_chunks])
    chunks = [
        Chunk(text=text, page=page, embedding=embedding)
        for (text, page), embedding in zip(page_chunks, embeddings, strict=True)
    ]

    with _SESSION_LOCK:
        _SESSIONS[session_id] = {
            "filename": filename,
            "page_count": len(reader.pages),
            "chunks": chunks,
        }

    return {
        "filename": filename,
        "page_count": len(reader.pages),
        "chunk_count": len(chunks),
    }


def _retrieve(session_id: str, question: str, top_k: int = 6) -> list[tuple[Chunk, float]]:
    """Find the chunks whose embeddings are closest to the user question."""

    with _SESSION_LOCK:
        session = _SESSIONS.get(session_id)

    if not session:
        raise KeyError("No document is loaded for this session.")

    query_vector = _embed_texts([question])[0]
    scored = [
        (chunk, float(np.dot(query_vector, chunk.embedding)))
        for chunk in session["chunks"]
    ]
    scored.sort(key=lambda item: item[1], reverse=True)
    return scored[: min(top_k, len(scored))]


def answer_question(session_id: str, question: str) -> dict:
    """Retrieve evidence and ask OpenAI to answer only from that evidence."""

    retrieved = _retrieve(session_id, question)
    context_sections = []
    source_items = []

    for index, (chunk, score) in enumerate(retrieved, start=1):
        context_sections.append(f"[Source {index} | Page {chunk.page}]\n{chunk.text}")
        source_items.append(
            {
                "page": chunk.page,
                "excerpt": chunk.text[:280] + ("…" if len(chunk.text) > 280 else ""),
                "similarity": round(score, 4),
            }
        )

    context = "\n\n".join(context_sections)
    model = os.getenv("OPENAI_CHAT_MODEL", "gpt-4.1-mini")

    system_prompt = """You are ChiEAC InsightPDF, a careful document assistant.
Answer the user's question using only the supplied PDF context.

Rules:
1. Never invent information that is not present in the context.
2. If the answer is absent, say that clearly.
3. Cite supporting pages inline using the format [Page 2].
4. For summaries, cover all major sections represented in the context.
5. Be clear, structured, and concise.
"""

    response = _client().chat.completions.create(
        model=model,
        temperature=0.1,
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"PDF CONTEXT:\n{context}\n\nUSER QUESTION:\n{question}",
            },
        ],
    )

    answer = response.choices[0].message.content or "I could not generate an answer."
    return {"answer": answer, "sources": source_items, "model": model}


def remove_session(session_id: str) -> bool:
    """Delete one browser session and its document from memory."""

    with _SESSION_LOCK:
        return _SESSIONS.pop(session_id, None) is not None
