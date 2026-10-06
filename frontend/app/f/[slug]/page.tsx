"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { api, send, Form, Question } from "@/lib/api";
import { getTheme, getThemeStyles } from "@/lib/themes";
import QuestionInput from "@/lib/QuestionInput";

const check = (q: Question, v: string): string | null => {
  if (!v.trim()) return q.required ? "Please fill this in" : null;
  if (q.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return "Hmm... that email doesn't look right";
  if (q.type === "number" && isNaN(Number(v))) return "Numbers only please";
  return null;
};

export default function Fill() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [missing, setMissing] = useState(false);
  const [i, setI] = useState(-1); // -1 = welcome, qs.length = thank-you
  const [back, setBack] = useState(false);
  const [ans, setAns] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const iRef = useRef(i);
  iRef.current = i;

  useEffect(() => {
    api<Form>(`/api/public/${slug}`)
      .then(setForm)
      .catch(() => setMissing(true));
  }, [slug]);

  const qs = form?.questions ?? [];
  const q = qs[i];
  const val = q ? ans[q.id!] ?? "" : "";

  const go = (to: number) => {
    setBack(to < i);
    setErr(null);
    setI(to);
  };

  const next = async () => {
    if (!form) return;
    if (i === -1) return go(0);
    const e = check(q, val);
    if (e) return setErr(e);
    if (i < qs.length - 1) return go(i + 1);
    setBusy(true);
    try {
      await api(`/api/public/${slug}/responses`, send("POST", { answers: ans }));
      go(qs.length);
    } catch (x: any) {
      const errs = x.detail?.errors;
      if (errs) {
        const bad = qs.findIndex(s => errs[s.id!]);
        go(bad);
        setErr(errs[qs[bad].id!]);
      } else {
        setErr("Something went wrong. Please try again.");
      }
    }
    setBusy(false);
  };

  const nextRef = useRef(next);
  nextRef.current = next;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement).tagName;
      if (e.key === "Enter" && t !== "INPUT" && t !== "TEXTAREA" && t !== "BUTTON") nextRef.current();
      if (e.key === "ArrowUp" && t !== "SELECT" && iRef.current > 0) go(iRef.current - 1);
      if (e.key === "ArrowDown" && t !== "SELECT") nextRef.current();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  if (missing) {
    return (
      <div className="fill">
        <div className="slides">
          <div className="slide">
            <h1 className="q-title">This form isn't available</h1>
            <p className="q-desc">It may be unpublished or the link is wrong.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!form) return null;

  const pct = i < 0 ? 0 : Math.min(100, (i / qs.length) * 100);
  const themeStyles = getThemeStyles(form.theme);
  const themeDef = getTheme(form.theme);

  return (
    <div className="fill" style={themeStyles}>
      <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)}>
        <i style={{ width: pct + "%" }} />
      </div>

      <div className="slides">
        <div className={"slide" + (back ? " back" : "")} key={i}>
          {i === -1 && (
            <>
              <h1 className="q-title" style={{ fontSize: 42, fontWeight: 600, marginBottom: 16 }}>
                {form.title}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 24 }}>
                <button
                  className="fill-btn"
                  style={{ fontSize: 20, padding: "12px 30px", borderRadius: 8 }}
                  onClick={next}
                >
                  Start
                </button>
                <span className="hint">
                  press <b>Enter ↵</b>
                </span>
              </div>
            </>
          )}

          {q && (
            <>
              <h2 className="q-title">
                <span style={{ color: themeDef.btn, fontSize: 18, fontWeight: 700, marginRight: 6 }}>
                  {i + 1} →
                </span>
                {q.title}
                {q.required && <span style={{ color: "var(--err)" }}> *</span>}
              </h2>

              {q.description && <p className="q-desc">{q.description}</p>}

              <QuestionInput
                q={q}
                value={val}
                autoFocus
                onChange={v => {
                  setAns({ ...ans, [q.id!]: v });
                  setErr(null);
                }}
                onEnter={next}
              />

              {err && <div className="err" role="alert">{err}</div>}

              <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 14 }}>
                <button
                  className="fill-btn"
                  disabled={busy}
                  onClick={next}
                  style={{ fontSize: 18, padding: "10px 24px", borderRadius: 6 }}
                >
                  {i === qs.length - 1 ? (busy ? "Submitting…" : "Submit") : "OK ✓"}
                </button>
                <span className="hint">
                  press <b>Enter ↵</b>
                </span>
              </div>
            </>
          )}

          {i === qs.length && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 44, marginBottom: 16 }}>🎉</div>
              <h1 className="q-title" style={{ fontSize: 36, fontWeight: 600, marginBottom: 12 }}>
                {form.thank_you}
              </h1>
              <p className="q-desc">Your response has been recorded.</p>
            </div>
          )}
        </div>
      </div>

      {q && (
        <div className="nav">
          <button aria-label="Previous question" onClick={() => go(i - 1)} disabled={i === 0}>
            ↑
          </button>
          <button aria-label="Next question" onClick={next}>
            ↓
          </button>
        </div>
      )}
    </div>
  );
}
