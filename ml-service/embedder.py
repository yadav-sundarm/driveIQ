import os
import pickle
import numpy as np
from sentence_transformers import SentenceTransformer

MODEL_NAME = "all-MiniLM-L6-v2"
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

model = SentenceTransformer(MODEL_NAME)

def get_user_dir(user_id: str) -> str:
    path = os.path.join(DATA_DIR, user_id)
    os.makedirs(path, exist_ok=True)
    return path

def get_embeddings_path(user_id: str) -> str:
    return os.path.join(get_user_dir(user_id), "embeddings.pkl")

def load_index(user_id: str) -> dict:
    path = get_embeddings_path(user_id)
    if not os.path.exists(path):
        return {"vectors": [], "metadata": []}
    with open(path, "rb") as f:
        return pickle.load(f)

def save_index(user_id: str, index: dict):
    with open(get_embeddings_path(user_id), "wb") as f:
        pickle.dump(index, f)

def add_to_index(user_id: str, file_name: str, category: str, subject: str = None):
    index = load_index(user_id)
    vector = model.encode(file_name, normalize_embeddings=True)
    index["vectors"].append(vector)
    index["metadata"].append({
        "file_name": file_name,
        "category": category,
        "subject": subject
    })
    save_index(user_id, index)

def bulk_add_to_index(user_id: str, samples: list):
    """samples = [{"file_name": ..., "category": ..., "subject": ...}]"""
    if not samples:
        return
    index = load_index(user_id)
    file_names = [s["file_name"] for s in samples]
    vectors = model.encode(file_names, normalize_embeddings=True, batch_size=32)
    for i, sample in enumerate(samples):
        index["vectors"].append(vectors[i])
        index["metadata"].append({
            "file_name": sample["file_name"],
            "category": sample["category"],
            "subject": sample.get("subject")
        })
    save_index(user_id, index)

def find_similar(user_id: str, file_name: str, top_k: int = 3) -> list:
    index = load_index(user_id)
    if not index["vectors"]:
        return []

    query_vector = model.encode(file_name, normalize_embeddings=True)
    vectors = np.array(index["vectors"])
    scores = vectors @ query_vector

    top_indices = np.argsort(scores)[::-1][:top_k]
    results = []
    for i in top_indices:
        results.append({
            "file_name": index["metadata"][i]["file_name"],
            "category": index["metadata"][i]["category"],
            "subject": index["metadata"][i]["subject"],
            "score": float(scores[i])
        })
    return results