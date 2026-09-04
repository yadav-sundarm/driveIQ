import re
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
    "Assignments": ["assignment", "pract", "practical", "lab", "homework", "submission"],
    "Notes": ["notes", "note", "lecture", "summary", "chapter", "unit"],
    "Documents": ["report", "resume", "cv", "letter", "proposal", "document", "doc"],
    "Archives": ["zip", "rar", "archive", "backup"],
    "Images": ["photo", "pic", "picture", "screenshot", "img", "scan"],
    "Miscellaneous": []
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

def classify_file(file_name: str, mime_type: str) -> dict:
    keywords = extract_keywords_from_name(file_name)
    category, confidence = classify_by_keywords(keywords)
    
    file_type = MIME_TYPE_MAP.get(mime_type, "other")
    
    # Override for archives
    if file_type == "zip":
        category = "Archives"
        confidence = 1.0
    
    return {
        "category": category,
        "confidence": confidence,
        "keywords": keywords,
        "file_type": file_type
    }