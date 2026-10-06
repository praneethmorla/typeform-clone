"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, send, Form, Question, QType, TYPE_LABELS } from "@/lib/api";
import { THEME_LIST, getTheme, getThemeStyles } from "@/lib/themes";
import QuestionInput from "@/lib/QuestionInput";
import { toast } from "@/lib/toast";

const blank = (type: QType): Question => ({
  type,
  title: "Your question here",
  description: "",
  required: false,
  options: type === "multiple_choice" || type === "dropdown" ? ["Option 1", "Option 2"] : [],
  _key: Math.random().toString(36),
});

export default function Builder() {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [sel, setSel] = useState(0);
  const [selectedBlock, setSelectedBlock] = useState<"question" | "ending">("question");
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [showDesign, setShowDesign] = useState(false);
  const [deviceView, setDeviceView] = useState<"desktop" | "mobile">("desktop");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api<Form>(`/api/forms/${id}`).then(f => {
      setForm({
        ...f,
        theme: f.theme || "pearl",
        questions: f.questions.map(q => ({ ...q, _key: String(q.id) })),
      });
    });
  }, [id]);

  if (!form) return <div style={{ padding: 40, textAlign: "center" }}>Loading…</div>;

  const currentTheme = getTheme(form.theme);
  const themeStyles = getThemeStyles(form.theme);
  const qs = form.questions;
  const q = qs[sel] || qs[0];

  const edit = (patch: Partial<Form>) => {
    setForm(prev => (prev ? { ...prev, ...patch } : null));
    setDirty(true);
  };

  const editQ = (patch: Partial<Question>) =>
    edit({ questions: qs.map((x, i) => (i === sel ? { ...x, ...patch } : x)) });

  const move = (from: number, to: number) => {
    const a = [...qs];
    const [m] = a.splice(from, 1);
    a.splice(to, 0, m);
    edit({ questions: a });
    setSel(to);
  };

  const save = async (): Promise<Form> => {
    const payload = {
      ...form,
      theme: form.theme || "pearl",
      questions: qs.map(({ _key, ...r }) => r),
    };
    const saved = await api<Form>(`/api/forms/${id}`, send("PUT", payload));
    setForm({
      ...saved,
      theme: saved.theme || form.theme || "pearl",
      questions: saved.questions.map(x => ({ ...x, _key: String(x.id) })),
    });
    setDirty(false);
    return saved;
  };

  const doSave = () =>
    save()
      .then(() => toast("Saved"))
      .catch(() => toast("Couldn't save. Check questions and try again."));

  const publish = async () => {
    const next = form.status === "published" ? "draft" : "published";
    try {
      await save();
      await api(`/api/forms/${id}/status/${next}`, send("POST"));
      setForm(f => (f ? { ...f, status: next } : null));
      toast(next === "published" ? "Published. Link ready to share" : "Unpublished");
    } catch {
      toast("Couldn't update status");
    }
  };

  const link = typeof window !== "undefined" ? `${location.origin}/f/${form.slug}` : "";

  return (
    <div className="tb-shell">
      {/* 1. Builder Topbar */}
      <header className="tb-topbar">
        <div className="tb-bread">
          <Link href="/" className="btn ghost sm" title="Back to dashboard">
            ← Forms
          </Link>
          <span style={{ color: "var(--muted)" }}>&gt;</span>
          <input
            value={form.title}
            onChange={e => edit({ title: e.target.value })}
            style={{
              border: 0,
              fontSize: 14,
              fontWeight: 600,
              background: "transparent",
              outline: 0,
              width: 200,
            }}
          />
        </div>

        {/* Center Tab: Content */}
        <div className="tb-center-tabs">
          <div className="tb-tab active">Content</div>
        </div>

        {/* Right Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            className="btn ghost sm"
            onClick={() => {
              navigator.clipboard.writeText(link);
              toast("Public link copied to clipboard");
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Share
          </button>

          <Link className="btn ghost sm" href={`/forms/${id}/responses`}>
            Results
          </Link>

          <button className="btn ghost sm" onClick={doSave} disabled={!dirty}>
            Save
          </button>

          <button className="btn green sm" onClick={publish}>
            {form.status === "published" ? "Unpublish" : "Publish"}
          </button>

          <div className="tf-avatar-circle" style={{ marginLeft: 4 }}>PM</div>
        </div>
      </header>

      {/* 2. Builder Sub-action Bar */}
      <div className="tb-subbar">
        <div className="tb-sub-left">
          <button
            className="btn sm"
            style={{ background: "#262627", color: "#fff" }}
            onClick={() => setAdding(true)}
          >
            + Add content
          </button>

          <button
            className="btn ghost sm"
            onClick={() => setShowDesign(!showDesign)}
            style={{ background: showDesign ? "#eee" : "transparent" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 10 10 0 0 0 0-20" />
            </svg>
            Design ({currentTheme.name})
          </button>
        </div>

        {/* Device toggle and Preview */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            className={`btn ghost sm ${deviceView === "desktop" ? "active" : ""}`}
            style={{ background: deviceView === "desktop" ? "#eee" : "transparent", padding: "6px 8px" }}
            onClick={() => setDeviceView("desktop")}
            title="Desktop view"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </button>

          <button
            className={`btn ghost sm ${deviceView === "mobile" ? "active" : ""}`}
            style={{ background: deviceView === "mobile" ? "#eee" : "transparent", padding: "6px 8px" }}
            onClick={() => setDeviceView("mobile")}
            title="Mobile view"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="2" width="14" height="20" rx="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          </button>

          {form.status === "published" && (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="btn ghost sm"
              style={{ marginLeft: 6 }}
              title="Open respondent form"
            >
              ▶ Preview
            </a>
          )}
        </div>
      </div>

      {/* 3. 3-Column Studio Grid */}
      <div className="tb-studio">
        {/* Left Column: Pages / Questions List */}
        <aside className="tb-col-left">
          <div className="tb-sec-title">Pages</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {qs.map((x, i) => {
              const isSelected = selectedBlock === "question" && i === sel;
              return (
                <div
                  key={x._key}
                  draggable
                  className={`tb-block-card ${isSelected ? "active" : ""}`}
                  onClick={() => {
                    setSelectedBlock("question");
                    setSel(i);
                  }}
                  onDragStart={() => setDrag(i)}
                  onDragOver={e => {
                    e.preventDefault();
                    setOver(i);
                  }}
                  onDrop={() => {
                    if (drag !== null) move(drag, i);
                    setDrag(null);
                    setOver(null);
                  }}
                  onDragEnd={() => {
                    setDrag(null);
                    setOver(null);
                  }}
                >
                  <span className="tb-block-badge">{i + 1}</span>
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: 13,
                    }}
                  >
                    {x.title || "Untitled"}
                  </span>
                  <button
                    className="btn ghost icon-only"
                    style={{ border: "none", padding: 2, width: 20, height: 20, fontSize: 11 }}
                    title="Delete question"
                    onClick={e => {
                      e.stopPropagation();
                      if (qs.length === 1) return toast("A form needs at least one question");
                      edit({ questions: qs.filter((_, j) => j !== i) });
                      setSel(Math.max(0, i - (i >= sel ? 1 : 0)));
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          <button
            className="btn ghost sm"
            style={{ width: "100%", borderStyle: "dashed", marginTop: 4 }}
            onClick={() => setAdding(true)}
          >
            + Add content
          </button>

          {/* Endings Section */}
          <div style={{ marginTop: 14 }}>
            <div className="tb-sec-title" style={{ marginBottom: 6 }}>Endings</div>
            <div
              className={`tb-block-card ${selectedBlock === "ending" ? "active" : ""}`}
              onClick={() => setSelectedBlock("ending")}
            >
              <span className="tb-block-badge">🏁</span>
              <span style={{ flex: 1, fontSize: 13 }}>Thank-you screen</span>
            </div>
          </div>
        </aside>

        {/* Center Column: Live Preview Canvas Stage */}
        <main className="tb-stage">
          {selectedBlock === "question" && q && (
            <div
              className={`tb-canvas-card ${deviceView === "mobile" ? "mobile" : ""}`}
              style={{
                ...themeStyles,
                background: currentTheme.bg,
                color: currentTheme.color,
              }}
            >
              <div
                className="tb-q-num-badge"
                style={{ background: currentTheme.btn, color: currentTheme.btnText }}
              >
                {sel + 1}
              </div>

              <input
                value={q.title}
                onChange={e => editQ({ title: e.target.value })}
                placeholder="Your question here..."
                style={{
                  border: 0,
                  fontSize: 22,
                  fontWeight: 600,
                  outline: 0,
                  background: "transparent",
                  color: currentTheme.color,
                  marginBottom: 6,
                  width: "100%",
                }}
              />

              <input
                value={q.description}
                onChange={e => editQ({ description: e.target.value })}
                placeholder="Description (optional)"
                style={{
                  border: 0,
                  fontSize: 14,
                  outline: 0,
                  background: "transparent",
                  color: currentTheme.mutedColor,
                  marginBottom: 24,
                  width: "100%",
                }}
              />

              <div style={{ pointerEvents: "none" }}>
                <QuestionInput q={q} value="" onChange={() => {}} />
              </div>
            </div>
          )}

          {selectedBlock === "ending" && (
            <div
              className={`tb-canvas-card ${deviceView === "mobile" ? "mobile" : ""}`}
              style={{
                ...themeStyles,
                background: currentTheme.bg,
                color: currentTheme.color,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 16 }}>🎉</div>
              <textarea
                className="plain"
                rows={3}
                value={form.thank_you}
                onChange={e => edit({ thank_you: e.target.value })}
                style={{
                  textAlign: "center",
                  fontSize: 18,
                  fontWeight: 600,
                  border: "1px dashed var(--line)",
                  background: "transparent",
                  color: currentTheme.color,
                }}
              />
              <p style={{ fontSize: 13, color: currentTheme.mutedColor, marginTop: 12 }}>
                Respondents will see this completion message after submitting.
              </p>
            </div>
          )}
        </main>

        {/* Right Column: Properties Inspector */}
        <aside className="tb-col-right">
          {selectedBlock === "question" && q ? (
            <>
              <div className="tb-inspector-sec">
                <span style={{ fontSize: 13, fontWeight: 600 }}>Question Properties</span>
              </div>

              {/* Answer Type Selector */}
              <div className="tb-inspector-sec">
                <label className="lbl">Answer Type</label>
                <select
                  className="plain"
                  value={q.type}
                  onChange={e => {
                    const t = e.target.value as QType;
                    editQ({
                      type: t,
                      options:
                        t === "multiple_choice" || t === "dropdown"
                          ? q.options.length
                            ? q.options
                            : ["Option 1", "Option 2"]
                          : [],
                    });
                  }}
                >
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* Setting Switches (Required) */}
              <div className="tb-inspector-sec">
                <div className="tb-switch-row">
                  <span>Required</span>
                  <div
                    className={`tb-toggle ${q.required ? "on" : ""}`}
                    onClick={() => editQ({ required: !q.required })}
                  />
                </div>
              </div>

              {/* Options Editor (Multiple choice / Dropdown) */}
              {(q.type === "multiple_choice" || q.type === "dropdown") && (
                <div className="tb-inspector-sec">
                  <label className="lbl">Choices</label>
                  {q.options.map((o, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                      <input
                        className="plain"
                        value={o}
                        onChange={e =>
                          editQ({
                            options: q.options.map((item, j) => (j === idx ? e.target.value : item)),
                          })
                        }
                      />
                      <button
                        className="btn ghost icon-only"
                        disabled={q.options.length < 2}
                        onClick={() => editQ({ options: q.options.filter((_, j) => j !== idx) })}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    className="btn ghost sm"
                    style={{ marginTop: 4 }}
                    onClick={() => editQ({ options: [...q.options, `Choice ${q.options.length + 1}`] })}
                  >
                    + Add choice
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="tb-inspector-sec">
              <span style={{ fontSize: 13, fontWeight: 600 }}>Thank-You Screen</span>
              <label className="lbl">Message</label>
              <textarea
                className="plain"
                rows={4}
                value={form.thank_you}
                onChange={e => edit({ thank_you: e.target.value })}
              />
            </div>
          )}
        </aside>
      </div>

      {/* 4. Design Theme Popover Modal */}
      {showDesign && (
        <div className="modal-bg" onClick={() => setShowDesign(false)}>
          <div className="modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Design Themes</h3>
              <button
                className="btn ghost icon-only"
                style={{ border: "none" }}
                onClick={() => setShowDesign(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", gap: 16, borderBottom: "1px solid var(--line)", marginTop: 14 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  borderBottom: "2px solid var(--ink)",
                  paddingBottom: 6,
                }}
              >
                Gallery
              </span>
            </div>

            {/* Gallery theme cards */}
            <div className="tb-theme-grid">
              {THEME_LIST.map(theme => (
                <div
                  key={theme.id}
                  className={`tb-theme-card ${currentTheme.id === theme.id ? "active" : ""}`}
                  style={{ background: theme.bg }}
                  onClick={() => {
                    edit({ theme: theme.id });
                    toast(`Theme: ${theme.name} applied`);
                  }}
                >
                  <div style={{ color: theme.color, fontSize: 13, fontWeight: 600 }}>Question</div>
                  <div style={{ color: theme.choiceText, fontSize: 11, opacity: 0.8, marginBottom: 12 }}>
                    Answer
                  </div>
                  <div
                    style={{
                      height: 12,
                      width: 40,
                      borderRadius: 3,
                      background: theme.btn,
                      marginBottom: 14,
                    }}
                  />
                  <div style={{ fontSize: 12, color: theme.color, fontWeight: 500 }}>
                    {theme.name} {currentTheme.id === theme.id && "✓"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add a question */}
      {adding && (
        <div className="modal-bg" onClick={() => setAdding(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Add content</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <button
                  key={k}
                  className="btn ghost"
                  style={{ justifyContent: "flex-start", padding: "10px 12px" }}
                  onClick={() => {
                    edit({ questions: [...qs, blank(k as QType)] });
                    setSel(qs.length);
                    setSelectedBlock("question");
                    setAdding(false);
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
