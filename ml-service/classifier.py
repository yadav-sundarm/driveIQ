import re
from difflib import SequenceMatcher
import spacy

import tfidf_classifier
import embedder

nlp = spacy.load("en_core_web_sm")

MIME_TYPE_MAP = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/zip": "zip",
    "image/jpeg": "image",
    "image/png": "image",
    "image/jpg": "image",
}

KEYWORD_PATTERNS = {
    "Certificates": ["certificate", "cert", "appreciation", "award", "achievement", "completion"],
    "Assignments": ["assignment", "pract", "prac", "practical", "lab", "homework", "submission"],
    "Notes": ["notes", "note", "lecture", "summary", "chapter", "unit"],
    "Documents": ["report", "resume", "cv", "letter", "proposal", "document", "doc"],
    "Archives": ["zip", "rar", "archive", "backup"],
    "Images": ["photo", "pic", "picture", "screenshot", "img", "scan"],
    "Miscellaneous": []
}

ALL_CATEGORY_KEYWORDS = {kw for patterns in KEYWORD_PATTERNS.values() for kw in patterns}
SUBJECT_ELIGIBLE_CATEGORIES = {"Assignments", "Notes", "Certificates", "Documents"}

STOPWORDS = {
    "of", "the", "a", "an", "in", "on", "at", "to", "for", "and", "or",
    "is", "it", "by", "as", "be", "was", "were", "this", "that",
    "th", "st", "nd", "rd", "no", "vs",
}

# Ensemble weights — sum to 1.0
RULE_WEIGHT = 0.4
TFIDF_WEIGHT = 0.4
EMBEDDING_WEIGHT = 0.2


def extract_keywords_from_name(file_name: str) -> list:
    name_without_ext = re.sub(r'\.[^.]+$', '', file_name).lower()
    name_cleaned = re.sub(r'[_\-]', ' ', name_without_ext)
    doc = nlp(name_cleaned)
    keywords = [token.lemma_.lower() for token in doc if not token.is_stop and not token.is_punct]
    return keywords


def classify_by_keywords(keywords: list) -> tuple:
    scores = {}
    for category, patterns in KEYWORD_PATTERNS.items():
        score = sum(1 for kw in keywords if any(p in kw for p in patterns))
        if score > 0:
            scores[category] = score

    if not scores:
        return "Miscellaneous", 0.0

    best_category = max(scores, key=scores.get)
    confidence = min(scores[best_category] / 3, 1.0)
    return best_category, round(confidence, 2)


def is_name_match(token: str, name_parts: list) -> bool:
    token_lower = token.lower()
    for part in name_parts:
        if not part:
            continue
        if token_lower == part or SequenceMatcher(None, token_lower, part).ratio() > 0.8:
            return True
    return False


def extract_subject_fallback(file_name: str, user_name: str = ""):
    name_without_ext = re.sub(r'\.[^.]+$', '', file_name)
    raw_tokens = [t for t in re.split(r'[_\-\s]+', name_without_ext) if t]
    name_parts = [p.lower() for p in re.split(r'\s+', user_name) if p]

    def clean_token(t):
        return re.sub(r'[^A-Za-z]', '', t)

    candidates = []
    for token in raw_tokens:
        clean = clean_token(token)
        if not clean or clean.isdigit():
            continue
        if clean.lower() in ALL_CATEGORY_KEYWORDS or clean.lower() in STOPWORDS:
            continue
        if is_name_match(clean, name_parts):
            continue
        candidates.append(clean)

    if not candidates:
        return None

    for c in candidates:
        if c.isupper() and len(c) <= 6:
            return c

    return candidates[0].upper()


def extract_subject(file_name: str, user_name: str = "", known_subjects: dict = None):
    known_subjects = known_subjects or {}
    name_without_ext = re.sub(r'\.[^.]+$', '', file_name)
    raw_tokens = [t for t in re.split(r'[_\-\s]+', name_without_ext) if t]
    tokens_lower = [re.sub(r'[^A-Za-z0-9]', '', t).lower() for t in raw_tokens]

    known_lower_map = {k.lower(): k for k in known_subjects.keys()}
    for tok in tokens_lower:
        if tok and tok in known_lower_map:
            return known_lower_map[tok]

    if known_subjects:
        scores = {}
        for subject, learned_keywords in known_subjects.items():
            score = sum(1 for tok in tokens_lower if tok and tok in learned_keywords)
            if score > 0:
                scores[subject] = score
        if scores:
            return max(scores, key=scores.get)

    return extract_subject_fallback(file_name, user_name)


def _ensemble_category(file_name: str, keywords: list, user_id: str = None):
    """
    Blends three signals:
    - rule-based keyword matching (always available)
    - per-user TF-IDF+NaiveBayes on confirmed history (None until enough data)
    - per-user embedding similarity to past confirmed files (None until any data)

    Each available model casts a weighted vote for ITS predicted category.
    Confidence is normalized against the weight actually available, not
    a fixed total — so a brand-new user running rule-based alone gets
    back exactly the rule-based confidence, rather than an artificially
    deflated score just because the other two haven't seen data yet.
    As TF-IDF/embeddings come online and agree with the rules, confidence
    on agreed categories climbs toward auto-confirm territory; when they
    disagree, the vote splits and confidence correctly drops.
    """
    rule_category, rule_confidence = classify_by_keywords(keywords)

    tfidf_result = tfidf_classifier.predict(user_id, file_name) if user_id else None

    embedding_result = None
    if user_id:
        matches = embedder.find_similar(user_id, file_name, top_k=1)
        if matches:
            embedding_result = matches[0]

    votes = {}
    available_weight = 0.0

    votes[rule_category] = votes.get(rule_category, 0.0) + RULE_WEIGHT * rule_confidence
    available_weight += RULE_WEIGHT

    if tfidf_result:
        votes[tfidf_result["category"]] = (
            votes.get(tfidf_result["category"], 0.0)
            + TFIDF_WEIGHT * tfidf_result["confidence"]
        )
        available_weight += TFIDF_WEIGHT

    if embedding_result:
        votes[embedding_result["category"]] = (
            votes.get(embedding_result["category"], 0.0)
            + EMBEDDING_WEIGHT * embedding_result["score"]
        )
        available_weight += EMBEDDING_WEIGHT

    best_category = max(votes, key=votes.get)
    confidence = votes[best_category] / available_weight if available_weight > 0 else 0.0

    return best_category, round(min(confidence, 1.0), 2)


def classify_file(
    file_name: str,
    mime_type: str,
    user_name: str = "",
    known_subjects: dict = None,
    user_id: str = None,
) -> dict:
    keywords = extract_keywords_from_name(file_name)
    category, confidence = _ensemble_category(file_name, keywords, user_id)

    file_type = MIME_TYPE_MAP.get(mime_type, "other")

    if file_type == "zip":
        category = "Archives"
        confidence = 1.0

    subject = None
    if category in SUBJECT_ELIGIBLE_CATEGORIES:
        subject = extract_subject(file_name, user_name, known_subjects)

    return {
        "category": category,
        "confidence": confidence,
        "keywords": keywords,
        "file_type": file_type,
        "subject": subject
    }