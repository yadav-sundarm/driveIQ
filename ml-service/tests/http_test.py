import requests

BASE = "http://localhost:8000"
USER = "http_test_user"


def p(label, resp):
    print(f"[{label}] {resp.status_code} -> {resp.json()}")


print("=== root ===")
p("root", requests.get(f"{BASE}/"))

print("\n=== classify: brand new user ===")
p("classify no user_id", requests.post(f"{BASE}/classify", json={
    "file_name": "OOP_Assignment1_Sundarm.pdf",
    "mime_type": "application/pdf",
    "user_name": "Sundarm Yadav",
}))

print("\n=== training-status: no data yet ===")
p("status (empty)", requests.get(f"{BASE}/training-status/{USER}"))

print("\n=== train: 5 samples, single category ===")
p("train", requests.post(f"{BASE}/train", json={
    "user_id": USER,
    "samples": [{"file_name": f"DBMS_Assignment{i}.pdf", "category": "Assignments"} for i in range(1, 6)],
}))
p("status (1 category)", requests.get(f"{BASE}/training-status/{USER}"))

print("\n=== classify: should still fall back to rule-based, not misfire on unrelated file ===")
p("classify meme", requests.post(f"{BASE}/classify", json={
    "file_name": "random_meme.jpg",
    "mime_type": "image/jpeg",
    "user_name": "Sundarm Yadav",
    "user_id": USER,
}))

print("\n=== add-sample: adds a Notes file too (2nd category) ===")
p("add-sample", requests.post(f"{BASE}/add-sample", json={
    "user_id": USER,
    "file_name": "OOP_Unit1_Notes_Sundarm.pdf",
    "category": "Notes",
    "subject": "OOP",
}))
p("status (2 categories, still <5 Notes)", requests.get(f"{BASE}/training-status/{USER}"))

print("\n=== embed-bulk ===")
p("embed-bulk", requests.post(f"{BASE}/embed-bulk", json={
    "user_id": USER,
    "samples": [
        {"file_name": "DBMS_Unit1_Notes_Sundarm.pdf", "category": "Notes", "subject": "DBMS"},
        {"file_name": "DBMS_Unit2_Notes_Sundarm.pdf", "category": "Notes", "subject": "DBMS"},
    ],
}))

print("\n=== classify with mix of models now active ===")
p("classify assignment-like", requests.post(f"{BASE}/classify", json={
    "file_name": "CN_Assignment2_Sundarm.pdf",
    "mime_type": "application/pdf",
    "user_name": "Sundarm Yadav",
    "user_id": USER,
}))

print("\n=== bad input: malformed request should get a clean 422, not a crash ===")
r = requests.post(f"{BASE}/classify", json={"file_name": "x.pdf"})  # missing mime_type
print(f"[missing required field] {r.status_code} -> {r.text[:200]}")

r = requests.post(f"{BASE}/train", json={"user_id": USER})  # missing samples
print(f"[missing samples] {r.status_code} -> {r.text[:200]}")