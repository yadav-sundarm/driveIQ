from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, List, Optional
from classifier import classify_file
import tfidf_classifier
import embedder

app = FastAPI()


class FileRequest(BaseModel):
    file_name: str
    mime_type: str
    user_name: str = ""
    known_subjects: Optional[Dict[str, List[str]]] = None
    user_id: Optional[str] = None


class TrainRequest(BaseModel):
    user_id: str
    samples: List[Dict]  # [{"file_name": ..., "category": ...}]


class EmbedBulkRequest(BaseModel):
    user_id: str
    samples: List[Dict]  # [{"file_name": ..., "category": ..., "subject": ...}]


class AddSampleRequest(BaseModel):
    user_id: str
    file_name: str
    category: str
    subject: Optional[str] = None


@app.get("/")
def root():
    return {"status": "ML service running"}


@app.post("/classify")
def classify(request: FileRequest):
    return classify_file(
        request.file_name,
        request.mime_type,
        request.user_name,
        request.known_subjects,
        request.user_id,
    )


@app.post("/train")
def train_endpoint(request: TrainRequest):
    trained = tfidf_classifier.train(request.user_id, request.samples)
    return {"trained": trained}

@app.get("/training-status/{user_id}")
def training_status_endpoint(user_id: str):
    """Explains WHY the TF-IDF model has/hasn't trained for this user —
    e.g. only one category confirmed so far — instead of leaving it a
    silent black box. Cheap to call (reads training_data.json only)."""
    return tfidf_classifier.training_status(user_id)

@app.post("/embed-bulk")
def embed_bulk_endpoint(request: EmbedBulkRequest):
    embedder.bulk_add_to_index(request.user_id, request.samples)
    return {"message": "Embeddings added", "count": len(request.samples)}


@app.post("/add-sample")
def add_sample_endpoint(request: AddSampleRequest):
    """One call updates BOTH ongoing-learning models for this file —
    the doc's backend plan has confirmAction calling this single
    endpoint after a successful move, so it needs to feed both."""
    trained = tfidf_classifier.add_sample(
        request.user_id, request.file_name, request.category
    )
    embedder.add_to_index(
        request.user_id, request.file_name, request.category, request.subject
    )
    return {"trained": trained}