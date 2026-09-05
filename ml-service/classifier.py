import re
from difflib import SequenceMatcher
import spacy

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
    """Elimination-based guess — used only when nothing in the user's
    existing Drive organization gives a better answer."""
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
    """
    Subject detection, in priority order:
    1. A filename token exactly matches an existing subject folder's
       name in the user's Drive — the strongest signal, since they
       organized it themselves.
    2. A filename token matches a keyword already seen in files sitting
       inside that existing folder.
    3. Fall back to elimination-based guessing.
    """
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

def classify_file(file_name: str, mime_type: str, user_name: str = "", known_subjects: dict = None) -> dict:
    keywords = extract_keywords_from_name(file_name)
    category, confidence = classify_by_keywords(keywords)

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