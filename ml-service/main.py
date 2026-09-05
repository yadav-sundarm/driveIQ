from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, List, Optional
from classifier import classify_file

app = FastAPI()

class FileRequest(BaseModel):
    file_name: str
    mime_type: str
    user_name: str = ""
    known_subjects: Optional[Dict[str, List[str]]] = None

@app.get("/")
def root():
    return {"status": "ML service running"}

@app.post("/classify")
def classify(request: FileRequest):
    result = classify_file(
        request.file_name,
        request.mime_type,
        request.user_name,
        request.known_subjects,
    )
    return result