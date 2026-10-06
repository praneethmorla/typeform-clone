"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api, send, Form, Workspace } from "@/lib/api";
import { toast } from "@/lib/toast";

export default function Dashboard() {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [activeWsId, setActiveWsId] = useState<number | null>(null);
  const [forms, setForms] = useState<Form[] | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title" | "responses">("newest");

  // Dropdown menus
  const [formMenu, setFormMenu] = useState<number | null>(null);
  const [wsMenu, setWsMenu] = useState<number | null>(null);

  // Modals for Forms
  const [renameForm, setRenameForm] = useState<Form | null>(null);
  const [delForm, setDelForm] = useState<Form | null>(null);
  const [moveForm, setMoveForm] = useState<Form | null>(null);
  const [targetWsId, setTargetWsId] = useState<number | null>(null);

  // Modals for Workspaces
  const [newWsModal, setNewWsModal] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [renameWs, setRenameWs] = useState<Workspace | null>(null);
  const [renameWsName, setRenameWsName] = useState("");
  const [delWs, setDelWs] = useState<Workspace | null>(null);

  const loadWorkspaces = async () => {
    try {
      const data = await api<Workspace[]>("/api/workspaces");
      setWorkspaces(data);
      if (data.length > 0) {
        setActiveWsId(prev => (prev && data.some(w => w.id === prev) ? prev : data[0].id));
      }
    } catch {
      toast("Can't reach the API. Is the backend running?");
    }
  };

  const loadForms = (wsId: number) => {
    api<Form[]>(`/api/forms?workspace_id=${wsId}`)
      .then(setForms)
      .catch(() => toast("Couldn't load forms for this workspace."));
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (activeWsId !== null) {
      loadForms(activeWsId);
    }
  }, [activeWsId]);

  const activeWs = useMemo(() => {
    return workspaces?.find(w => w.id === activeWsId) || null;
  }, [workspaces, activeWsId]);

  const displayedForms = useMemo(() => {
    if (!forms) return null;
    let list = [...forms];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(f => f.title.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      if (sortBy === "newest") return b.id - a.id;
      if (sortBy === "oldest") return a.id - b.id;
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "responses") return (b.response_count ?? 0) - (a.response_count ?? 0);
      return 0;
    });

    return list;
  }, [forms, search, sortBy]);

  const createForm = async () => {
    if (!activeWsId) return;
    try {
      const f = await api<Form>(
        "/api/forms",
        send("POST", {
          title: "New form",
          workspace_id: activeWsId,
          questions: [{ type: "short_text", title: "Your question here", description: "", required: false, options: [] }],
        })
      );
      location.href = `/forms/${f.id}`;
    } catch {
      toast("Couldn't create form.");
    }
  };

  const createWorkspace = async () => {
    const trimmed = newWsName.trim();
    if (!trimmed) return;
    try {
      const created = await api<Workspace>("/api/workspaces", send("POST", { name: trimmed }));
      setNewWsModal(false);
      setNewWsName("");
      toast(`Workspace “${created.name}” created`);
      await loadWorkspaces();
      setActiveWsId(created.id);
    } catch {
      toast("Couldn't create workspace.");
    }
  };

  const updateWorkspace = async () => {
    if (!renameWs) return;
    const trimmed = renameWsName.trim();
    if (!trimmed) return;
    try {
      await api(`/api/workspaces/${renameWs.id}`, send("PUT", { name: trimmed }));
      setRenameWs(null);
      toast("Workspace renamed");
      loadWorkspaces();
    } catch {
      toast("Couldn't rename workspace.");
    }
  };

  const deleteWorkspace = async () => {
    if (!delWs) return;
    try {
      await api(`/api/workspaces/${delWs.id}`, send("DELETE"));
      const deletedId = delWs.id;
      setDelWs(null);
      toast(`Workspace “${delWs.name}” deleted`);
      const updated = await api<Workspace[]>("/api/workspaces");
      setWorkspaces(updated);
      if (activeWsId === deletedId && updated.length > 0) {
        setActiveWsId(updated[0].id);
      }
    } catch {
      toast("Couldn't delete workspace.");
    }
  };

  const doMoveForm = async () => {
    if (!moveForm || !targetWsId) return;
    try {
      await api(`/api/forms/${moveForm.id}/move`, send("POST", { workspace_id: targetWsId }));
      const targetName = workspaces?.find(w => w.id === targetWsId)?.name || "workspace";
      toast(`Moved to “${targetName}”`);
      setMoveForm(null);
      setTargetWsId(null);
      if (activeWsId) loadForms(activeWsId);
      loadWorkspaces();
    } catch {
      toast("Couldn't move form.");
    }
  };

  const actForm = async (fn: () => Promise<any>, msg: string) => {
    setFormMenu(null);
    try {
      await fn();
      toast(msg);
      if (activeWsId) loadForms(activeWsId);
      loadWorkspaces();
    } catch {
      toast("Action failed.");
    }
  };

  return (
    <div
      className="tf-shell"
      onClick={() => {
        setFormMenu(null);
        setWsMenu(null);
      }}
    >
      {/* Top Header */}
      <header className="tf-top-nav">
        <div className="tf-logo-wrap">
          <div className="tf-avatar-p">P</div>
          <span className="tf-user-title">praneethamorla4</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Workspace: {activeWs?.name || "My workspace"}</span>
        </div>
      </header>

      {/* Main Body: Sidebar + Main Area */}
      <div className="tf-dash-body">
        {/* Left Sidebar */}
        <aside className="tf-sidebar">
          {/* Create Form Button */}
          <button className="tf-create-btn" onClick={createForm} disabled={!activeWsId}>
            <span style={{ fontSize: 16 }}>+</span> Create form
          </button>

          {/* Search Box */}
          <div className="tf-side-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search forms…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Workspaces Section */}
          <div className="tf-ws-section">
            <div className="tf-ws-header">
              <span>Workspaces</span>
              <button
                className="tf-ws-add-btn"
                title="Create workspace"
                onClick={() => {
                  setNewWsName("");
                  setNewWsModal(true);
                }}
              >
                +
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {workspaces === null && (
                <div style={{ padding: "6px 10px", fontSize: 13, color: "var(--muted)" }}>Loading…</div>
              )}
              {workspaces?.map(w => {
                const isActive = w.id === activeWsId;
                return (
                  <div
                    key={w.id}
                    className={`tf-ws-item ${isActive ? "active" : ""}`}
                    onClick={() => {
                      setActiveWsId(w.id);
                      setSearch("");
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {w.name}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{w.form_count ?? 0}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right Main Area */}
        <main className="tf-main">
          {/* Header Row */}
          <div className="tf-main-header">
            <div className="tf-ws-title-wrap">
              <h1 className="tf-ws-title">{activeWs ? activeWs.name : "My workspace"}</h1>
              <div className="menu" onClick={e => e.stopPropagation()}>
                <button
                  className="btn ghost icon-only"
                  style={{ border: "none" }}
                  onClick={e => {
                    e.stopPropagation();
                    if (activeWs) setWsMenu(wsMenu === activeWs.id ? null : activeWs.id);
                  }}
                  title="Workspace options"
                >
                  ⋯
                </button>
                {wsMenu && activeWs && wsMenu === activeWs.id && (
                  <div style={{ top: 32, left: 0 }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setWsMenu(null);
                        setRenameWs(activeWs);
                        setRenameWsName(activeWs.name);
                      }}
                    >
                      Rename workspace
                    </button>
                    {workspaces && workspaces.length > 1 && (
                      <button
                        style={{ color: "var(--err)" }}
                        onClick={() => {
                          setWsMenu(null);
                          setDelWs(activeWs);
                        }}
                      >
                        Delete workspace
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Controls Right: Sort & View Mode */}
            <div className="tf-controls-right">
              <select
                className="tf-sort-select"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
              >
                <option value="newest">Date created ⌵</option>
                <option value="oldest">Date created (oldest) ⌵</option>
                <option value="title">Alphabetical (A–Z) ⌵</option>
                <option value="responses">Most responses ⌵</option>
              </select>

              <div className="tf-view-switch">
                <button
                  className={`tf-view-btn ${viewMode === "list" ? "active" : ""}`}
                  onClick={() => setViewMode("list")}
                  title="List view"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                  List
                </button>
                <button
                  className={`tf-view-btn ${viewMode === "grid" ? "active" : ""}`}
                  onClick={() => setViewMode("grid")}
                  title="Grid view"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  Grid
                </button>
              </div>
            </div>
          </div>

          {/* Loading and Empty States */}
          {forms === null && <div className="tf-table-card" style={{ padding: 24 }}>Loading forms…</div>}

          {forms !== null && forms.length === 0 && (
            <div className="tf-table-card" style={{ padding: 48, textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No forms yet in this workspace</div>
              <p style={{ color: "var(--muted)", margin: "0 0 16px", fontSize: 14 }}>
                Create your first form to start collecting responses.
              </p>
              <button className="btn" onClick={createForm}>
                + Create form
              </button>
            </div>
          )}

          {forms !== null && forms.length > 0 && displayedForms?.length === 0 && (
            <div className="tf-table-card" style={{ padding: 24, color: "var(--muted)" }}>
              No forms match “{search}”.
            </div>
          )}

          {/* LIST VIEW (Table matching Screenshot 1 layout with ONLY working data) */}
          {forms !== null && forms.length > 0 && displayedForms && displayedForms.length > 0 && viewMode === "list" && (
            <div className="tf-table-card">
              <table className="tf-table">
                <thead>
                  <tr>
                    <th style={{ width: "46%" }}>Form name</th>
                    <th style={{ width: "16%" }}>Responses</th>
                    <th style={{ width: "16%" }}>Status</th>
                    <th style={{ width: "16%" }}>Created date</th>
                    <th style={{ width: "6%" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {displayedForms.map(f => (
                    <tr className="row-hover" key={f.id}>
                      {/* Icon + Title */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div className="tf-form-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                              <rect x="5" y="4" width="14" height="16" rx="3" fill="none" stroke="#fff" strokeWidth="2" />
                              <line x1="8" y1="9" x2="16" y2="9" stroke="#fff" strokeWidth="2" />
                              <line x1="8" y1="13" x2="16" y2="13" stroke="#fff" strokeWidth="2" />
                              <line x1="8" y1="17" x2="12" y2="17" stroke="#fff" strokeWidth="2" />
                            </svg>
                          </div>
                          <div>
                            <Link href={`/forms/${f.id}`} className="tf-form-title">
                              {f.title}
                            </Link>
                          </div>
                        </div>
                      </td>

                      {/* Responses count */}
                      <td style={{ color: "var(--muted)" }}>
                        {f.response_count ?? 0}
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`badge-tag ${f.status === "published" ? "pub" : ""}`}>
                          {f.status}
                        </span>
                      </td>

                      {/* Created Date */}
                      <td style={{ color: "var(--muted)", fontSize: 13 }}>
                        {f.created_at ? new Date(f.created_at + "Z").toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "Oct 06, 2026"}
                      </td>

                      {/* Actions ⋯ menu */}
                      <td>
                        <div className="menu" onClick={e => e.stopPropagation()}>
                          <button
                            className="btn ghost icon-only"
                            style={{ border: "none" }}
                            onClick={e => {
                              e.stopPropagation();
                              setFormMenu(formMenu === f.id ? null : f.id);
                            }}
                          >
                            ⋯
                          </button>
                          {formMenu === f.id && (
                            <div style={{ right: 0 }} onClick={e => e.stopPropagation()}>
                              <Link href={`/forms/${f.id}`} style={{ display: "block" }}>
                                <button>Edit form</button>
                              </Link>
                              <Link href={`/forms/${f.id}/responses`} style={{ display: "block" }}>
                                <button>View results</button>
                              </Link>
                              {f.status === "published" && (
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${location.origin}/f/${f.slug}`);
                                    toast("Public link copied");
                                    setFormMenu(null);
                                  }}
                                >
                                  Copy link
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setFormMenu(null);
                                  setRenameForm(f);
                                }}
                              >
                                Rename
                              </button>
                              {workspaces && workspaces.length > 1 && (
                                <button
                                  onClick={() => {
                                    setFormMenu(null);
                                    const other = workspaces.find(w => w.id !== activeWsId);
                                    setTargetWsId(other ? other.id : workspaces[0].id);
                                    setMoveForm(f);
                                  }}
                                >
                                  Move to workspace…
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  actForm(() => api(`/api/forms/${f.id}/duplicate`, send("POST")), "Form duplicated")
                                }
                              >
                                Duplicate
                              </button>
                              <button
                                onClick={() =>
                                  actForm(
                                    () =>
                                      api(
                                        `/api/forms/${f.id}/status/${f.status === "published" ? "draft" : "published"}`,
                                        send("POST")
                                      ),
                                    f.status === "published" ? "Unpublished" : "Published"
                                  )
                                }
                              >
                                {f.status === "published" ? "Unpublish" : "Publish"}
                              </button>
                              <button
                                style={{ color: "var(--err)" }}
                                onClick={() => {
                                  setFormMenu(null);
                                  setDelForm(f);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* GRID VIEW (Only working data) */}
          {forms !== null && forms.length > 0 && displayedForms && displayedForms.length > 0 && viewMode === "grid" && (
            <div className="tf-grid">
              {displayedForms.map(f => (
                <div className="tf-grid-card" key={f.id}>
                  <div className="tf-grid-top">
                    <div className="tf-form-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="5" y="4" width="14" height="16" rx="3" fill="none" stroke="#fff" strokeWidth="2" />
                        <line x1="8" y1="9" x2="16" y2="9" stroke="#fff" strokeWidth="2" />
                        <line x1="8" y1="13" x2="16" y2="13" stroke="#fff" strokeWidth="2" />
                        <line x1="8" y1="17" x2="12" y2="17" stroke="#fff" strokeWidth="2" />
                      </svg>
                    </div>
                    <span className={`badge-tag ${f.status === "published" ? "pub" : ""}`}>{f.status}</span>
                  </div>

                  <div className="tf-grid-body">
                    <Link href={`/forms/${f.id}`} className="tf-form-title" style={{ fontSize: 15 }}>
                      {f.title}
                    </Link>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                      {f.response_count ?? 0} responses
                    </div>
                  </div>

                  <div className="tf-grid-foot">
                    <div style={{ display: "flex", gap: 6 }}>
                      <Link className="btn ghost sm" href={`/forms/${f.id}/responses`}>
                        Results
                      </Link>
                      {f.status === "published" && (
                        <button
                          className="btn ghost sm"
                          onClick={() => {
                            navigator.clipboard.writeText(`${location.origin}/f/${f.slug}`);
                            toast("Link copied");
                          }}
                        >
                          Copy
                        </button>
                      )}
                    </div>

                    <div className="menu" onClick={e => e.stopPropagation()}>
                      <button
                        className="btn ghost icon-only"
                        style={{ border: "none" }}
                        onClick={e => {
                          e.stopPropagation();
                          setFormMenu(formMenu === f.id ? null : f.id);
                        }}
                      >
                        ⋯
                      </button>
                      {formMenu === f.id && (
                        <div style={{ right: 0 }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setFormMenu(null);
                              setRenameForm(f);
                            }}
                          >
                            Rename
                          </button>
                          {workspaces && workspaces.length > 1 && (
                            <button
                              onClick={() => {
                                setFormMenu(null);
                                const other = workspaces.find(w => w.id !== activeWsId);
                                setTargetWsId(other ? other.id : workspaces[0].id);
                                setMoveForm(f);
                              }}
                            >
                              Move to workspace…
                            </button>
                          )}
                          <button
                            onClick={() =>
                              actForm(() => api(`/api/forms/${f.id}/duplicate`, send("POST")), "Form duplicated")
                            }
                          >
                            Duplicate
                          </button>
                          <button
                            style={{ color: "var(--err)" }}
                            onClick={() => {
                              setFormMenu(null);
                              setDelForm(f);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Modal: Create Workspace */}
      {newWsModal && (
        <div className="modal-bg" onClick={() => setNewWsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Create a new workspace</h3>
            <label className="lbl">Workspace name</label>
            <input
              className="plain"
              placeholder="e.g. Marketing, Feedback, Personal"
              autoFocus
              value={newWsName}
              onChange={e => setNewWsName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") createWorkspace();
              }}
            />
            <div style={{ marginTop: 20, textAlign: "right" }}>
              <button className="btn ghost" onClick={() => setNewWsModal(false)}>
                Cancel
              </button>{" "}
              <button className="btn" disabled={!newWsName.trim()} onClick={createWorkspace}>
                Create workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Rename Workspace */}
      {renameWs && (
        <div className="modal-bg" onClick={() => setRenameWs(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Rename workspace</h3>
            <label className="lbl">Workspace name</label>
            <input
              className="plain"
              autoFocus
              value={renameWsName}
              onChange={e => setRenameWsName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") updateWorkspace();
              }}
            />
            <div style={{ marginTop: 20, textAlign: "right" }}>
              <button className="btn ghost" onClick={() => setRenameWs(null)}>
                Cancel
              </button>{" "}
              <button className="btn" disabled={!renameWsName.trim()} onClick={updateWorkspace}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Workspace */}
      {delWs && (
        <div className="modal-bg" onClick={() => setDelWs(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Delete “{delWs.name}”?</h3>
            <p style={{ color: "var(--muted)", fontSize: 14 }}>
              This workspace and all its {delWs.form_count ?? 0} forms and responses will be permanently deleted.
            </p>
            <div style={{ marginTop: 20, textAlign: "right" }}>
              <button className="btn ghost" onClick={() => setDelWs(null)}>
                Cancel
              </button>{" "}
              <button className="btn" style={{ background: "var(--err)" }} onClick={deleteWorkspace}>
                Delete workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Move Form */}
      {moveForm && (
        <div className="modal-bg" onClick={() => setMoveForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Move “{moveForm.title}”</h3>
            <label className="lbl">Select destination workspace</label>
            <select
              className="plain"
              value={targetWsId ?? ""}
              onChange={e => setTargetWsId(Number(e.target.value))}
            >
              {workspaces?.map(w => (
                <option key={w.id} value={w.id} disabled={w.id === activeWsId}>
                  {w.name} {w.id === activeWsId ? "(Current)" : ""}
                </option>
              ))}
            </select>
            <div style={{ marginTop: 20, textAlign: "right" }}>
              <button className="btn ghost" onClick={() => setMoveForm(null)}>
                Cancel
              </button>{" "}
              <button className="btn" disabled={!targetWsId || targetWsId === activeWsId} onClick={doMoveForm}>
                Move form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Rename Form */}
      {renameForm && (
        <div className="modal-bg" onClick={() => setRenameForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Rename form</h3>
            <input
              className="plain"
              autoFocus
              value={renameForm.title}
              onChange={e => setRenameForm({ ...renameForm, title: e.target.value })}
              onKeyDown={async e => {
                if (e.key === "Enter" && renameForm.title.trim()) {
                  const full = await api<Form>(`/api/forms/${renameForm.id}`);
                  await api(`/api/forms/${renameForm.id}`, send("PUT", { ...full, title: renameForm.title }));
                  setRenameForm(null);
                  toast("Form renamed");
                  if (activeWsId) loadForms(activeWsId);
                }
              }}
            />
            <div style={{ marginTop: 16, textAlign: "right" }}>
              <button className="btn ghost" onClick={() => setRenameForm(null)}>
                Cancel
              </button>{" "}
              <button
                className="btn"
                disabled={!renameForm.title.trim()}
                onClick={async () => {
                  const full = await api<Form>(`/api/forms/${renameForm.id}`);
                  await api(`/api/forms/${renameForm.id}`, send("PUT", { ...full, title: renameForm.title }));
                  setRenameForm(null);
                  toast("Form renamed");
                  if (activeWsId) loadForms(activeWsId);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Form */}
      {delForm && (
        <div className="modal-bg" onClick={() => setDelForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Delete “{delForm.title}”?</h3>
            <p>This also deletes its {delForm.response_count ?? 0} responses and can’t be undone.</p>
            <div style={{ textAlign: "right" }}>
              <button className="btn ghost" onClick={() => setDelForm(null)}>
                Cancel
              </button>{" "}
              <button
                className="btn"
                style={{ background: "var(--err)" }}
                onClick={async () => {
                  await api(`/api/forms/${delForm.id}`, send("DELETE"));
                  setDelForm(null);
                  toast("Form deleted");
                  if (activeWsId) loadForms(activeWsId);
                  loadWorkspaces();
                }}
              >
                Delete form
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
