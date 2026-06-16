"""Stub RAG ingest module."""

from mimir_shared.models import ClassificationResult


def classify_stub(text: str) -> ClassificationResult:
    return ClassificationResult(tier=0, confidence=1.0, reason=f"stub: {text[:20]}")
