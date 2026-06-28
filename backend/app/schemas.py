"""Pydantic request and response models for the ChiEAC InsightPDF API."""

from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    """Payload sent when a user asks a question about the uploaded PDF."""

    session_id: str = Field(min_length=8, max_length=100)
    question: str = Field(min_length=2, max_length=2000)


class SourceItem(BaseModel):
    """A small excerpt used to support an answer."""

    page: int
    excerpt: str
    similarity: float


class AskResponse(BaseModel):
    """Answer returned to the frontend."""

    answer: str
    sources: list[SourceItem]
    model: str
