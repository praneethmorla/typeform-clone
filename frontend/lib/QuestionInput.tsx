"use client";
import { Question } from "./api";
// Shared answer control: used by the real respondent flow and the builder's live preview.
export default function QuestionInput({ q, value, onChange, onEnter, autoFocus }: { q: Question; value: string; onChange: (v: string) => void; onEnter?: () => void; autoFocus?: boolean }) {
  const key = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !(q.type === "long_text" && e.shiftKey)) { e.preventDefault(); onEnter?.(); } };
  switch (q.type) {
    case "long_text": return <textarea className="underline" rows={2} autoFocus={autoFocus} value={value} placeholder="Type your answer here..." onChange={e => onChange(e.target.value)} onKeyDown={key} />;
    case "multiple_choice": case "yes_no": {
      const opts = q.type === "yes_no" ? ["Yes", "No"] : q.options;
      return <div>{opts.map((o, i) => <button key={o + i} type="button" className={"choice" + (value === o ? " sel" : "")} onClick={() => { onChange(o); setTimeout(() => onEnter?.(), 350); }}><b>{String.fromCharCode(65 + i)}</b>{o}</button>)}</div>;
    }
    case "dropdown": return <select className="underline" autoFocus={autoFocus} value={value} onChange={e => onChange(e.target.value)}><option value="">Type or select an option</option>{q.options.map(o => <option key={o}>{o}</option>)}</select>;
    case "rating": return <div className="stars">{[1, 2, 3, 4, 5].map(n => <button key={n} type="button" aria-label={`${n} stars`} className={Number(value) >= n ? "on" : ""} onClick={() => { onChange(String(n)); setTimeout(() => onEnter?.(), 350); }}>★</button>)}</div>;
    default: return <input className="underline" autoFocus={autoFocus} type={q.type === "number" ? "number" : q.type === "email" ? "email" : "text"} value={value} placeholder={q.type === "email" ? "name@example.com" : "Type your answer here..."} onChange={e => onChange(e.target.value)} onKeyDown={key} />;
  }
}
