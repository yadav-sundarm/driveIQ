import os
import json
import re
import pickle
from collections import Counter
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
MIN_SAMPLES_PER_CATEGORY = 5
OTHER_LABEL = "__other__"


def get_user_dir(user_id: str) -> str:
    path = os.path.join(DATA_DIR, user_id)
    os.makedirs(path, exist_ok=True)
    return path


def get_model_path(user_id: str) -> str:
    return os.path.join(get_user_dir(user_id), "tfidf_model.pkl")


def get_training_data_path(user_id: str) -> str:
    return os.path.join(get_user_dir(user_id), "training_data.json")


def load_training_data(user_id: str) -> list:
    path = get_training_data_path(user_id)
    if not os.path.exists(path):
        return []
    with open(path, "r") as f:
        return json.load(f)


def save_training_data(user_id: str, samples: list):
    with open(get_training_data_path(user_id), "w") as f:
        json.dump(samples, f)


def load_model(user_id: str):
    path = get_model_path(user_id)
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        return pickle.load(f)


def save_model(user_id: str, vectorizer, classifier):
    with open(get_model_path(user_id), "wb") as f:
        pickle.dump({"vectorizer": vectorizer, "classifier": classifier}, f)


def _prepare_text(file_name: str) -> str:
    name_without_ext = re.sub(r"\.[^.]+$", "", file_name).lower()
    return re.sub(r"[_\-]", " ", name_without_ext)


def _prepare_training_set(samples: list):
    counts = Counter(s["category"] for s in samples)
    eligible_categories = {
        c for c, n in counts.items() if n >= MIN_SAMPLES_PER_CATEGORY
    }

    if not eligible_categories:
        return [], []

    texts = []
    labels = []
    has_other = False

    for s in samples:
        texts.append(_prepare_text(s["file_name"]))
        if s["category"] in eligible_categories:
            labels.append(s["category"])
        else:
            labels.append(OTHER_LABEL)
            has_other = True

    # If only one eligible category exists and no below-threshold samples
    # are available to populate __other__, synthesize one neutral negative
    # (empty string → all-zero TF-IDF vector, matches nothing real) so
    # sklearn can train a binary one-vs-rest classifier instead of bailing.
    # Without this, early users who confirm 5+ files all in the same
    # category get silently zero TF-IDF contribution.
    if len(eligible_categories) == 1 and not has_other:
        texts.append("")
        labels.append(OTHER_LABEL)

    return texts, labels

def train(user_id: str, samples: list) -> bool:
    """samples = [{"file_name": ..., "category": ...}] — replaces
    whatever training data currently exists for this user. Returns
    True if a model was actually (re)trained, False if there still
    isn't at least one category with enough data."""
    save_training_data(user_id, samples)

    texts, labels = _prepare_training_set(samples)

    # Need at least 2 distinct labels to train anything — but OTHER_LABEL
    # counts as one of them now, so a single qualifying category plus
    # "everything else" is enough to get started
    if len(set(labels)) < 2:
        model_path = get_model_path(user_id)
        if os.path.exists(model_path):
            os.remove(model_path)
        return False

    vectorizer = TfidfVectorizer()
    X = vectorizer.fit_transform(texts)

    classifier = MultinomialNB()
    classifier.fit(X, labels)

    save_model(user_id, vectorizer, classifier)
    return True


def add_sample(user_id: str, file_name: str, category: str) -> bool:
    """Adds one confirmed sample and retrains from scratch. Retraining
    on every confirm is fine at this scale (a student's Drive — at most
    a few hundred files total) — not worth incremental partial_fit."""
    samples = load_training_data(user_id)
    samples.append({"file_name": file_name, "category": category})
    return train(user_id, samples)


def predict(user_id: str, file_name: str):
    """Returns {"category": ..., "confidence": ...}, or None if there's
    no trained model yet, OR the model's best guess is just "Other" —
    a bucket label the rest of the system doesn't understand, which we
    treat the same as "no confident specific answer"."""
    model = load_model(user_id)
    if model is None:
        return None

    vectorizer = model["vectorizer"]
    classifier = model["classifier"]

    text = _prepare_text(file_name)
    X = vectorizer.transform([text])

    probabilities = classifier.predict_proba(X)[0]
    best_index = probabilities.argmax()
    category = classifier.classes_[best_index]
    confidence = float(probabilities[best_index])

    if category == OTHER_LABEL:
        return None

    return {"category": category, "confidence": round(confidence, 2)}