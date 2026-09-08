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
    """Categories with fewer than MIN_SAMPLES_PER_CATEGORY confirmed
    files get folded into a single OTHER_LABEL bucket instead of being
    excluded outright. This means an eligible category only needs
    *some* confirmed history in a different category to start training
    against — it does NOT need that other history to itself cross the
    5-sample threshold.

    Important edge case: if literally every confirmed sample so far
    belongs to the one eligible category (nothing confirmed in any
    other category yet), there is no data left to put in OTHER_LABEL,
    labels end up with a single distinct value, and training is
    intentionally skipped (see train()) until the user confirms at
    least one file elsewhere. This is expected, not a bug — a classifier
    can't be fit with only one class."""
    counts = Counter(s["category"] for s in samples)
    eligible_categories = {
        c for c, n in counts.items() if n >= MIN_SAMPLES_PER_CATEGORY
    }

    if not eligible_categories:
        return [], []

    texts = []
    labels = []
    for s in samples:
        texts.append(_prepare_text(s["file_name"]))
        labels.append(
            s["category"] if s["category"] in eligible_categories else OTHER_LABEL
        )

    return texts, labels


def training_status(user_id: str) -> dict:
    """Diagnostic info on why the model has or hasn't trained, so this
    isn't a black box to callers (e.g. Settings/NeedsReview UI could
    surface `detail` to explain why smart suggestions aren't active yet).
    Does not load the pickled model — just reasons about the saved
    training_data.json, so it's cheap to call.
    """
    samples = load_training_data(user_id)
    counts = Counter(s["category"] for s in samples)
    eligible = {c for c, n in counts.items() if n >= MIN_SAMPLES_PER_CATEGORY}
    other_count = sum(n for c, n in counts.items() if c not in eligible)

    if not eligible:
        return {
            "trained": False,
            "reason": "no_category_has_enough_samples",
            "eligible_categories": [],
            "detail": f"No category has reached {MIN_SAMPLES_PER_CATEGORY} confirmed samples yet.",
        }

    if other_count == 0:
        return {
            "trained": False,
            "reason": "only_one_category_confirmed",
            "eligible_categories": sorted(eligible),
            "detail": (
                "Confirm at least one file in a different category to "
                "activate smart suggestions for "
                f"{', '.join(sorted(eligible))}."
            ),
        }

    return {"trained": True, "eligible_categories": sorted(eligible), "reason": None, "detail": None}


def train(user_id: str, samples: list) -> bool:
    """samples = [{"file_name": ..., "category": ...}] — replaces
    whatever training data currently exists for this user. Returns
    True if a model was actually (re)trained, False if there still
    isn't at least one category with enough data AND at least one
    sample outside it to contrast against (see training_status() for
    the specific reason, e.g. only one category confirmed so far)."""
    save_training_data(user_id, samples)

    texts, labels = _prepare_training_set(samples)

    # Need at least 2 distinct labels to train anything. OTHER_LABEL
    # can supply the second label, but only if at least one confirmed
    # sample actually falls outside the eligible categor(y/ies) — if
    # every sample so far is in the single eligible category, there's
    # nothing to fold into OTHER_LABEL and this intentionally stays
    # untrained (see training_status()).
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