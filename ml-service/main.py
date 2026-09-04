from fastapi import FastAPI
from pydantic import BaseModel
from classifier import classify_file

app = FastAPI()

class FileRequest(BaseModel):
    file_name: str
    mime_type: str

@app.get("/")
def root():
    return {"status": "ML service running"}

@app.post("/classify")
def classify(request: FileRequest):
    result = classify_file(request.file_name, request.mime_type)
    return result