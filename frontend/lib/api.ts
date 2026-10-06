export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export type QType = "short_text" | "long_text" | "multiple_choice" | "dropdown" | "email" | "number" | "yes_no" | "rating";
export interface Workspace { id: number; name: string; created_at?: string; form_count?: number }
export interface Question { id?: number; type: QType; title: string; description: string; required: boolean; options: string[]; _key?: string }
export interface Form { id: number; title: string; slug: string; status: "draft" | "published"; thank_you: string; questions: Question[]; response_count?: number; workspace_id?: number; theme?: string }
export const TYPE_LABELS: Record<QType, string> = { short_text: "Short text", long_text: "Long text", multiple_choice: "Multiple choice", dropdown: "Dropdown", email: "Email", number: "Number", yes_no: "Yes / No", rating: "Rating" };

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API + path, { ...init, headers: { "Content-Type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(typeof body.detail === "string" ? body.detail : "Request failed"), { detail: body.detail });
  return body;
}
export const send = (method: string, data?: unknown) => ({ method, body: data ? JSON.stringify(data) : undefined });
