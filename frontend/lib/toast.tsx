"use client";
import { useEffect, useState } from "react";
export const toast = (m: string) => window.dispatchEvent(new CustomEvent("toast", { detail: m }));
export function Toaster() {
  const [m, setM] = useState("");
  useEffect(() => {
    let t: any; const h = (e: any) => { setM(e.detail); clearTimeout(t); t = setTimeout(() => setM(""), 2500); };
    window.addEventListener("toast", h); return () => window.removeEventListener("toast", h);
  }, []);
  return m ? <div className="toast" role="status">{m}</div> : null;
}
