"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, API, Form } from "@/lib/api";

interface R { id: number; submitted_at: string; answers: Record<string, string> }
interface Data { form: Form; responses: R[]; stats: Record<string, { answered: number; counts?: Record<string, number>; average?: number }> }

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [view, setView] = useState<"summary" | "responses">("summary");
  const [open, setOpen] = useState<R | null>(null);
  useEffect(() => { api<Data>(`/api/forms/${id}/responses`).then(setD); }, [id]);
  if (!d) return <div className="wrap">Loading…</div>;
  const { form, responses, stats } = d;

  return <>
    <div className="topbar"><Link href="/" className="logo">←</Link><b>{form.title}</b><div className="spacer" />
      <Link className="btn ghost" href={`/forms/${id}`}>Edit</Link><a className="btn ghost" href={`${API}/api/forms/${id}/export.csv`}>Export CSV</a></div>
    <div className="wrap">
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>{(["summary", "responses"] as const).map(v => <button key={v} className={"btn " + (view === v ? "" : "ghost")} onClick={() => setView(v)}>{v === "summary" ? "Summary" : `Responses (${responses.length})`}</button>)}</div>
      {responses.length === 0 && <div className="card row">No responses yet. Publish the form and share its link to start collecting them.</div>}
      {responses.length > 0 && view === "summary" && form.questions.map((q, n) => { const s = stats[q.id!]; const max = Math.max(1, ...Object.values(s.counts ?? {}));
        return <div className="card" key={q.id} style={{ padding: 18, marginBottom: 12 }}><b>{n + 1}. {q.title}</b><div style={{ color: "var(--muted)", fontSize: 13 }}>{s.answered} of {responses.length} answered{s.average !== undefined && ` · average ${s.average}`}</div>
          {s.counts && Object.entries(s.counts).map(([k, c]) => <div className="bar-row" key={k}><span style={{ width: 110 }}>{k}</span><i style={{ width: `${(c / max) * 60}%`, minWidth: 2 }} /><span>{c}</span></div>)}
          {!s.counts && responses.slice(0, 3).map(r => r.answers[q.id!] && <div key={r.id} style={{ marginTop: 6, fontSize: 14 }}>“{r.answers[q.id!]}”</div>)}</div>; })}
      {responses.length > 0 && view === "responses" && <div className="card" style={{ overflow: "auto" }}><table><thead><tr><th>Submitted</th>{form.questions.map(q => <th key={q.id}>{q.title}</th>)}</tr></thead>
        <tbody>{responses.map(r => <tr className="click" key={r.id} onClick={() => setOpen(r)}><td>{new Date(r.submitted_at + "Z").toLocaleString()}</td>{form.questions.map(q => <td key={q.id}>{r.answers[q.id!] ?? "—"}</td>)}</tr>)}</tbody></table></div>}
    </div>
    {open && <div className="modal-bg" onClick={() => setOpen(null)}><div className="modal" style={{ width: "min(560px,94vw)", maxHeight: "85vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
      <h3 style={{ marginTop: 0 }}>Response #{open.id}</h3>{form.questions.map(q => <div key={q.id} style={{ marginBottom: 12 }}><div style={{ color: "var(--muted)", fontSize: 13 }}>{q.title}</div><div>{open.answers[q.id!] ?? "—"}</div></div>)}
      <div style={{ textAlign: "right" }}><button className="btn" onClick={() => setOpen(null)}>Close</button></div></div></div>}
  </>;
}
