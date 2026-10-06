"""Typeform clone API. FastAPI + stdlib sqlite3. Run: uvicorn main:app --reload"""
import json, re, secrets, sqlite3, csv, io
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

DB = "typeform.db"
TYPES = {"short_text", "long_text", "multiple_choice", "dropdown", "email", "number", "yes_no", "rating"}
app = FastAPI(title="Typeform Clone")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def db():
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON"); return c

SCHEMA = """
CREATE TABLE IF NOT EXISTS workspaces(id INTEGER PRIMARY KEY, name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS forms(id INTEGER PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
  thank_you TEXT NOT NULL DEFAULT 'Thanks for completing this typeform',
  theme TEXT NOT NULL DEFAULT 'pearl',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS questions(id INTEGER PRIMARY KEY, form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '',
  required INTEGER NOT NULL DEFAULT 0, options TEXT DEFAULT '[]');
CREATE TABLE IF NOT EXISTS responses(id INTEGER PRIMARY KEY, form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  submitted_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS answers(id INTEGER PRIMARY KEY, response_id INTEGER NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE, value TEXT NOT NULL);
"""

class WorkspaceIn(BaseModel):
    name: str

class MoveFormIn(BaseModel):
    workspace_id: int

class QIn(BaseModel):
    id: int | None = None
    type: str; title: str; description: str = ""; required: bool = False; options: list[str] = []

class FormIn(BaseModel):
    title: str; thank_you: str = "Thanks for completing this typeform"; questions: list[QIn] = []
    workspace_id: int | None = None
    theme: str = "pearl"

class Submit(BaseModel):
    answers: dict[str, str | int | float | None]

def questions_of(c, fid):
    return [{**dict(r), "required": bool(r["required"]), "options": json.loads(r["options"])}
            for r in c.execute("SELECT * FROM questions WHERE form_id=? ORDER BY position", (fid,))]

def form_full(c, row):
    return {**dict(row), "questions": questions_of(c, row["id"])}

def save_questions(c, fid, qs):
    keep = [q.id for q in qs if q.id]  # delete removed, update kept, insert new (keeps old answers intact)
    marks = ",".join("?" * len(keep)) or "NULL"
    c.execute(f"DELETE FROM questions WHERE form_id=? AND id NOT IN ({marks})", (fid, *keep))
    for i, q in enumerate(qs):
        if q.type not in TYPES: raise HTTPException(422, f"Unknown type {q.type}")
        vals = (i, q.type, q.title, q.description, int(q.required), json.dumps(q.options))
        if q.id: c.execute("UPDATE questions SET position=?,type=?,title=?,description=?,required=?,options=? WHERE id=?", (*vals, q.id))
        else: c.execute("INSERT INTO questions(form_id,position,type,title,description,required,options) VALUES(?,?,?,?,?,?,?)", (fid, *vals))

def get_or_404(c, fid):
    r = c.execute("SELECT * FROM forms WHERE id=?", (fid,)).fetchone()
    if not r: raise HTTPException(404, "Form not found")
    return r

# ---------- workspaces API ----------
@app.get("/api/workspaces")
def list_workspaces():
    with db() as c:
        return [dict(r) for r in c.execute("""
            SELECT w.id, w.name, w.created_at,
                   (SELECT COUNT(*) FROM forms f WHERE f.workspace_id = w.id) AS form_count
            FROM workspaces w ORDER BY w.id ASC
        """)]

@app.post("/api/workspaces")
def create_workspace(body: WorkspaceIn):
    name = body.name.strip()
    if not name: raise HTTPException(422, "Workspace name cannot be empty")
    with db() as c:
        wid = c.execute("INSERT INTO workspaces(name) VALUES(?)", (name,)).lastrowid
        row = c.execute("SELECT w.id, w.name, w.created_at, 0 as form_count FROM workspaces w WHERE id=?", (wid,)).fetchone()
        return dict(row)

@app.get("/api/workspaces/{wid}")
def get_workspace(wid: int):
    with db() as c:
        r = c.execute("SELECT w.id, w.name, w.created_at, (SELECT COUNT(*) FROM forms f WHERE f.workspace_id=w.id) AS form_count FROM workspaces w WHERE id=?", (wid,)).fetchone()
        if not r: raise HTTPException(404, "Workspace not found")
        return dict(r)

@app.put("/api/workspaces/{wid}")
def update_workspace(wid: int, body: WorkspaceIn):
    name = body.name.strip()
    if not name: raise HTTPException(422, "Workspace name cannot be empty")
    with db() as c:
        if not c.execute("SELECT 1 FROM workspaces WHERE id=?", (wid,)).fetchone():
            raise HTTPException(404, "Workspace not found")
        c.execute("UPDATE workspaces SET name=? WHERE id=?", (name, wid))
        r = c.execute("SELECT w.id, w.name, w.created_at, (SELECT COUNT(*) FROM forms f WHERE f.workspace_id=w.id) AS form_count FROM workspaces w WHERE id=?", (wid,)).fetchone()
        return dict(r)

@app.delete("/api/workspaces/{wid}")
def delete_workspace(wid: int):
    with db() as c:
        count = c.execute("SELECT COUNT(*) as cnt FROM workspaces").fetchone()["cnt"]
        if count <= 1:
            raise HTTPException(400, "Cannot delete the only remaining workspace")
        if not c.execute("SELECT 1 FROM workspaces WHERE id=?", (wid,)).fetchone():
            raise HTTPException(404, "Workspace not found")
        c.execute("DELETE FROM forms WHERE workspace_id=?", (wid,))
        c.execute("DELETE FROM workspaces WHERE id=?", (wid,))
        return {"ok": True}

# ---------- forms API ----------
@app.get("/api/forms")
def list_forms(workspace_id: int | None = None):
    with db() as c:
        if workspace_id is not None:
            return [dict(r) for r in c.execute("""SELECT f.id,f.workspace_id,f.title,f.slug,f.status,f.theme,f.created_at,
              (SELECT COUNT(*) FROM responses r WHERE r.form_id=f.id) AS response_count
              FROM forms f WHERE f.workspace_id=? ORDER BY f.id DESC""", (workspace_id,))]
        return [dict(r) for r in c.execute("""SELECT f.id,f.workspace_id,f.title,f.slug,f.status,f.theme,f.created_at,
          (SELECT COUNT(*) FROM responses r WHERE r.form_id=f.id) AS response_count
          FROM forms f ORDER BY f.id DESC""")]

@app.post("/api/forms")
def create_form(body: FormIn):
    with db() as c:
        wid = body.workspace_id
        if not wid:
            w = c.execute("SELECT id FROM workspaces ORDER BY id ASC LIMIT 1").fetchone()
            wid = w["id"] if w else 1
        else:
            if not c.execute("SELECT 1 FROM workspaces WHERE id=?", (wid,)).fetchone():
                raise HTTPException(404, "Workspace not found")
        fid = c.execute("INSERT INTO forms(workspace_id,title,slug,thank_you,theme) VALUES(?,?,?,?,?)",
                        (wid, body.title, secrets.token_urlsafe(6), body.thank_you, body.theme)).lastrowid
        save_questions(c, fid, body.questions)
        return form_full(c, get_or_404(c, fid))

@app.get("/api/forms/{fid}")
def get_form(fid: int):
    with db() as c: return form_full(c, get_or_404(c, fid))

@app.put("/api/forms/{fid}")
def update_form(fid: int, body: FormIn):
    with db() as c:
        curr = get_or_404(c, fid)
        wid = body.workspace_id if body.workspace_id is not None else curr["workspace_id"]
        c.execute("UPDATE forms SET title=?,thank_you=?,workspace_id=?,theme=? WHERE id=?", (body.title, body.thank_you, wid, body.theme, fid))
        save_questions(c, fid, body.questions)
        return form_full(c, get_or_404(c, fid))

@app.post("/api/forms/{fid}/move")
def move_form(fid: int, body: MoveFormIn):
    with db() as c:
        get_or_404(c, fid)
        if not c.execute("SELECT 1 FROM workspaces WHERE id=?", (body.workspace_id,)).fetchone():
            raise HTTPException(404, "Target workspace not found")
        c.execute("UPDATE forms SET workspace_id=? WHERE id=?", (body.workspace_id, fid))
        return form_full(c, get_or_404(c, fid))

@app.delete("/api/forms/{fid}")
def delete_form(fid: int):
    with db() as c: get_or_404(c, fid); c.execute("DELETE FROM forms WHERE id=?", (fid,)); return {"ok": True}

@app.post("/api/forms/{fid}/duplicate")
def duplicate(fid: int):
    with db() as c:
        f = form_full(c, get_or_404(c, fid))
        body = FormIn(title=f"{f['title']} (copy)", thank_you=f["thank_you"], workspace_id=f.get("workspace_id"), theme=f.get("theme", "pearl"),
                      questions=[QIn(**{k: q[k] for k in ("type", "title", "description", "required", "options")}) for q in f["questions"]])
    return create_form(body)

@app.post("/api/forms/{fid}/status/{status}")
def set_status(fid: int, status: str):
    if status not in ("draft", "published"): raise HTTPException(422, "Bad status")
    with db() as c:
        get_or_404(c, fid); c.execute("UPDATE forms SET status=? WHERE id=?", (status, fid)); return {"status": status}

# ---------- public respondent API ----------
@app.get("/api/public/{slug}")
def public_form(slug: str):
    with db() as c:
        r = c.execute("SELECT * FROM forms WHERE slug=? AND status='published'", (slug,)).fetchone()
        if not r: raise HTTPException(404, "This form is not available")
        return form_full(c, r)

def validate(q, v):
    if v is None or str(v).strip() == "":
        return "This field is required" if q["required"] else None
    v, t = str(v), q["type"]
    if t == "email" and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", v): return "Enter a valid email"
    if t == "number":
        try: float(v)
        except ValueError: return "Enter a valid number"
    if t == "rating" and v not in list("12345"): return "Pick a rating from 1 to 5"
    if t == "yes_no" and v not in ("Yes", "No"): return "Choose Yes or No"
    if t in ("multiple_choice", "dropdown") and v not in q["options"]: return "Choose one of the options"
    return None

@app.post("/api/public/{slug}/responses")
def submit(slug: str, body: Submit):
    with db() as c:
        r = c.execute("SELECT * FROM forms WHERE slug=? AND status='published'", (slug,)).fetchone()
        if not r: raise HTTPException(404, "This form is not available")
        qs = questions_of(c, r["id"])
        errors = {str(q["id"]): e for q in qs if (e := validate(q, body.answers.get(str(q["id"]))))}
        if errors: raise HTTPException(422, {"errors": errors})
        rid = c.execute("INSERT INTO responses(form_id) VALUES(?)", (r["id"],)).lastrowid
        for q in qs:
            v = body.answers.get(str(q["id"]))
            if v not in (None, ""): c.execute("INSERT INTO answers(response_id,question_id,value) VALUES(?,?,?)", (rid, q["id"], str(v)))
        return {"id": rid}

# ---------- results ----------
def responses_of(c, fid):
    out = []
    for r in c.execute("SELECT * FROM responses WHERE form_id=? ORDER BY id DESC", (fid,)):
        a = {str(x["question_id"]): x["value"] for x in c.execute("SELECT * FROM answers WHERE response_id=?", (r["id"],))}
        out.append({"id": r["id"], "submitted_at": r["submitted_at"], "answers": a})
    return out

@app.get("/api/forms/{fid}/responses")
def responses(fid: int):
    with db() as c:
        f = form_full(c, get_or_404(c, fid)); rs = responses_of(c, fid); stats = {}
        for q in f["questions"]:
            vals = [r["answers"][str(q["id"])] for r in rs if str(q["id"]) in r["answers"]]
            s = {"answered": len(vals)}
            if q["type"] in ("multiple_choice", "dropdown", "yes_no", "rating"):
                keys = q["options"] or (["Yes", "No"] if q["type"] == "yes_no" else list("12345"))
                s["counts"] = {k: vals.count(k) for k in keys}
            if q["type"] in ("number", "rating") and vals: s["average"] = round(sum(map(float, vals)) / len(vals), 2)
            stats[str(q["id"])] = s
        return {"form": f, "responses": rs, "stats": stats}

@app.get("/api/forms/{fid}/export.csv", response_class=PlainTextResponse)
def export_csv(fid: int):
    with db() as c:
        f = form_full(c, get_or_404(c, fid)); buf = io.StringIO(); w = csv.writer(buf)
        w.writerow(["Submitted at"] + [q["title"] for q in f["questions"]])
        for r in responses_of(c, fid): w.writerow([r["submitted_at"]] + [r["answers"].get(str(q["id"]), "") for q in f["questions"]])
        return buf.getvalue()

# ---------- seed data ----------
def seed(c, default_wid=1):
    def mk(title, status, qs, resp):
        fid = c.execute("INSERT INTO forms(workspace_id,title,slug,status) VALUES(?,?,?,?)",
                        (default_wid, title, secrets.token_urlsafe(6), status)).lastrowid
        save_questions(c, fid, [QIn(**q) for q in qs]); ids = [q["id"] for q in questions_of(c, fid)]
        for row in resp:
            rid = c.execute("INSERT INTO responses(form_id) VALUES(?)", (fid,)).lastrowid
            for qid, v in zip(ids, row): c.execute("INSERT INTO answers(response_id,question_id,value) VALUES(?,?,?)", (rid, qid, str(v)))
    mk("Customer Feedback", "published", [
        dict(type="short_text", title="What's your name?", required=True),
        dict(type="email", title="What's your email?", description="We'll only use it to follow up.", required=True),
        dict(type="multiple_choice", title="How did you hear about us?", options=["Friend", "Social media", "Search", "Other"]),
        dict(type="rating", title="How would you rate our service?", required=True),
        dict(type="yes_no", title="Would you recommend us?"),
        dict(type="long_text", title="Anything else you'd like to tell us?")],
       [["Asha", "asha@example.com", "Friend", 5, "Yes", "Loved it"], ["Ravi", "ravi@example.com", "Search", 4, "Yes", "Fast support"],
        ["Meera", "meera@example.com", "Social media", 3, "No", "Pricing is steep"]])
    mk("Event Registration", "published", [
        dict(type="short_text", title="Full name", required=True), dict(type="email", title="Email", required=True),
        dict(type="number", title="How many guests are you bringing?"),
        dict(type="dropdown", title="Preferred session", options=["Morning", "Afternoon", "Evening"], required=True)],
       [["Kiran", "kiran@example.com", 2, "Morning"], ["Sana", "sana@example.com", 0, "Evening"]])
    mk("Untitled draft", "draft", [dict(type="short_text", title="Your question here")], [])

@app.on_event("startup")
def startup():
    with db() as c:
        c.executescript(SCHEMA)
        w = c.execute("SELECT id FROM workspaces LIMIT 1").fetchone()
        if not w:
            c.execute("INSERT INTO workspaces(id, name) VALUES(1, 'My workspace')")
            default_wid = 1
        else:
            default_wid = w["id"]

        cols = [r[1] for r in c.execute("PRAGMA table_info(forms)").fetchall()]
        if "workspace_id" not in cols:
            c.execute("ALTER TABLE forms ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE")
            c.execute("UPDATE forms SET workspace_id=? WHERE workspace_id IS NULL", (default_wid,))
        else:
            c.execute("UPDATE forms SET workspace_id=? WHERE workspace_id IS NULL", (default_wid,))

        if "theme" not in cols:
            c.execute("ALTER TABLE forms ADD COLUMN theme TEXT NOT NULL DEFAULT 'pearl'")

        if not c.execute("SELECT 1 FROM forms").fetchone(): seed(c, default_wid)
