"""Pydantic models shared across workers."""

from pydantic import BaseModel, Field


class ClassificationResult(BaseModel):
    tier: int = Field(..., ge=0, le=2)
    confidence: float = Field(..., ge=0.0, le=1.0)
    reason: str
