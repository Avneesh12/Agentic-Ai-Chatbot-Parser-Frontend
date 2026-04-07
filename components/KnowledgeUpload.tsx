"use client";

/**
 * KnowledgeUpload — RAG document ingestion panel.
 *
 * Visibility is controlled by the env var NEXT_PUBLIC_ENABLE_RAG_UPLOAD=true.
 * When false/absent the component renders nothing.
 *
 * Features:
 *  - Drag-and-drop OR click-to-browse
 *  - Multi-file (PDF, DOCX, TXT, CSV, XLSX, MD) up to 20 MB each
 *  - Per-file progress + status badges (indexed / rejected / error)
 *  - Summary bar on completion
 *  - Full keyboard/a11y support
 */

import { useState, useRef, useCallback, DragEvent } from "react";
import {
  Upload, X, FileText, FileSpreadsheet, File,
  CheckCircle2, XCircle, AlertCircle, Loader2,
  Database, Sparkles, Info,
} from "lucide-react";
import { uploadDocuments, FileUploadResult } from "@/lib/api";

const ENABLED = process.env.NEXT_PUBLIC_ENABLE_RAG_UPLOAD === "true";
const ALLOWED_EXT = [".pdf", ".docx", ".txt", ".csv", ".xlsx", ".md"];
const MAX_SIZE_MB = 20;
const MAX_FILES   = 20;

// ── File type icon ───────────────────────────────────────────────────────────

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const cls = "flex-shrink-0";
  if (["csv", "xlsx"].includes(ext))  return <FileSpreadsheet size={15} className={cls} style={{ color: "#6fffd4" }} />;
  if (["pdf"].includes(ext))          return <FileText        size={15} className={cls} style={{ color: "#ff6f91" }} />;
  return <File size={15} className={cls} style={{ color: "#7c6fff" }} />;
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, reason }: { status?: string; reason?: string }) {
  if (!status) return null;

  const styles: Record<string, React.CSSProperties> = {
    indexed:  { background: "rgba(111,255,212,0.1)",  border: "1px solid rgba(111,255,212,0.3)",  color: "#6fffd4" },
    rejected: { background: "rgba(248,113,113,0.1)",  border: "1px solid rgba(248,113,113,0.3)",  color: "#f87171" },
    error:    { background: "rgba(251,191,36,0.1)",   border: "1px solid rgba(251,191,36,0.3)",   color: "#fbbf24" },
    uploading:{ background: "rgba(124,111,255,0.1)",  border: "1px solid rgba(124,111,255,0.3)",  color: "#7c6fff" },
  };

  const icons: Record<string, React.ReactNode> = {
    indexed:  <CheckCircle2 size={10} />,
    rejected: <XCircle      size={10} />,
    error:    <AlertCircle  size={10} />,
    uploading:<Loader2      size={10} className="animate-spin" />,
  };

  const labels: Record<string, string> = {
    indexed:  "Indexed",
    rejected: "Rejected",
    error:    "Error",
    uploading:"Uploading…",
  };

  return (
    <span
      title={reason}
      style={{
        display: "inline-flex", alignItems: "center", gap: "4px",
        padding: "2px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 600,
        whiteSpace: "nowrap", cursor: reason ? "help" : "default",
        ...styles[status],
      }}
    >
      {icons[status]}
      {labels[status]}
    </span>
  );
}

// ── Staged file row ──────────────────────────────────────────────────────────

interface StagedFile {
  file: File;
  id: string;
  status?: "uploading" | "indexed" | "rejected" | "error";
  chunks?: number;
  reason?: string;
}

function StagedRow({ sf, onRemove }: { sf: StagedFile; onRemove: (id: string) => void }) {
  const sizeMB = (sf.file.size / 1024 / 1024).toFixed(1);
  const busy   = sf.status === "uploading";

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "8px 12px", borderRadius: "10px",
        background: "var(--surface2)", border: "1px solid var(--border)",
        transition: "border-color 0.2s",
      }}
    >
      <FileIcon name={sf.file.name} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: "12px", fontWeight: 500, color: "var(--text)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {sf.file.name}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{sizeMB} MB</span>
          {sf.status === "indexed" && sf.chunks !== undefined && (
            <span style={{ fontSize: "10px", color: "#6fffd4" }}>· {sf.chunks} chunks</span>
          )}
        </div>
      </div>

      <StatusBadge status={sf.status} reason={sf.reason} />

      {!busy && !sf.status && (
        <button
          onClick={() => onRemove(sf.id)}
          aria-label={`Remove ${sf.file.name}`}
          style={{
            width: "22px", height: "22px", borderRadius: "6px",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "none", border: "1px solid var(--border)",
            color: "var(--text-muted)", cursor: "pointer", flexShrink: 0,
          }}
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function KnowledgeUpload() {
  if (!ENABLED) return null;

  const [staged, setStaged]       = useState<StagedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [summary, setSummary]     = useState<{ indexed: number; failed: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Validate + stage files ──────────────────────────────────────────────

  const stageFiles = useCallback((raw: File[]) => {
    const remaining = MAX_FILES - staged.length;
    const incoming  = raw.slice(0, remaining);
    const newItems: StagedFile[] = [];

    for (const f of incoming) {
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) continue;           // silently skip bad types
      if (f.size > MAX_SIZE_MB * 1024 * 1024) continue;  // silently skip too-large
      // Deduplicate by name+size
      const dup = staged.some(s => s.file.name === f.name && s.file.size === f.size);
      if (dup) continue;
      newItems.push({ file: f, id: `${f.name}-${Date.now()}-${Math.random()}` });
    }

    setStaged(prev => [...prev, ...newItems]);
    setSummary(null);
  }, [staged]);

  // ── Drag handlers ───────────────────────────────────────────────────────

  const onDragOver  = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e: DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const onDrop      = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    stageFiles(Array.from(e.dataTransfer.files));
  };

  // ── Remove a staged file ────────────────────────────────────────────────

  const removeFile = useCallback((id: string) => {
    setStaged(prev => prev.filter(s => s.id !== id));
  }, []);

  // ── Upload ───────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    const pending = staged.filter(s => !s.status);
    if (!pending.length || uploading) return;

    setUploading(true);
    setSummary(null);

    // Mark all pending as uploading
    setStaged(prev => prev.map(s =>
      !s.status ? { ...s, status: "uploading" } : s
    ));

    try {
      const result = await uploadDocuments(pending.map(s => s.file));

      // Map results back to staged files by filename
      setStaged(prev => prev.map(s => {
        const r = result.files.find(
          (f: FileUploadResult) => f.filename === s.file.name
        );
        if (!r) return s;
        return {
          ...s,
          status:  r.status as StagedFile["status"],
          chunks:  r.chunks_inserted,
          reason:  r.reason,
        };
      }));

      setSummary({ indexed: result.summary.indexed, failed: result.summary.failed });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setStaged(prev => prev.map(s =>
        s.status === "uploading" ? { ...s, status: "error", reason: msg } : s
      ));
    } finally {
      setUploading(false);
    }
  };

  // ── Clear completed files ───────────────────────────────────────────────

  const clearDone = () => {
    setStaged(prev => prev.filter(s => !s.status || s.status === "uploading"));
    setSummary(null);
  };

  // ── Derived state ───────────────────────────────────────────────────────

  const pendingCount  = staged.filter(s => !s.status).length;
  const hasAnyDone    = staged.some(s => s.status && s.status !== "uploading");
  const canUpload     = pendingCount > 0 && !uploading;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "0" }}>

      {/* ── Drop zone ────────────────────────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop files here or click to browse"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        style={{
          margin: "16px 16px 0",
          border: `2px dashed ${isDragging ? "var(--accent)" : "var(--border)"}`,
          borderRadius: "14px",
          padding: "24px 16px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
          background: isDragging ? "rgba(124,111,255,0.06)" : "var(--surface2)",
          cursor: "pointer",
          transition: "all 0.2s",
          flexShrink: 0,
        }}
      >
        <div style={{
          width: "44px", height: "44px", borderRadius: "12px",
          background: "linear-gradient(135deg, var(--accent), var(--accent2))",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: isDragging ? "0 0 20px var(--glow)" : "none",
          transition: "box-shadow 0.2s",
        }}>
          <Upload size={20} color="white" />
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", margin: 0 }}>
            {isDragging ? "Drop files here" : "Drag & drop files"}
          </p>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "4px 0 0" }}>
            or <span style={{ color: "var(--accent)" }}>click to browse</span>
          </p>
        </div>
        <div style={{
          display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center",
        }}>
          {ALLOWED_EXT.map(ext => (
            <span key={ext} style={{
              fontSize: "10px", padding: "2px 8px", borderRadius: "999px",
              background: "var(--surface)", border: "1px solid var(--border)",
              color: "var(--text-muted)", fontFamily: "DM Mono, monospace",
            }}>
              {ext}
            </span>
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_EXT.join(",")}
          style={{ display: "none" }}
          onChange={e => {
            stageFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {/* ── Limits hint ──────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "6px",
        padding: "8px 20px 0",
        flexShrink: 0,
      }}>
        <Info size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: 0 }}>
          Max {MAX_FILES} files · {MAX_SIZE_MB} MB each · Duplicates skipped automatically
        </p>
      </div>

      {/* ── Staged file list ──────────────────────────────────────────────── */}
      {staged.length > 0 && (
        <div style={{
          flex: 1, overflowY: "auto", padding: "10px 16px",
          display: "flex", flexDirection: "column", gap: "6px", minHeight: 0,
        }}>
          {staged.map(sf => (
            <StagedRow key={sf.id} sf={sf} onRemove={removeFile} />
          ))}
        </div>
      )}

      {/* ── Empty state (no files staged) ───────────────────────────────── */}
      {staged.length === 0 && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: "10px",
          padding: "24px",
        }}>
          <Database size={28} style={{ color: "var(--border)" }} />
          <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
            Your uploaded documents will be chunked, embedded, and added to the AI knowledge base.
          </p>
        </div>
      )}

      {/* ── Summary banner ───────────────────────────────────────────────── */}
      {summary && (
        <div style={{
          margin: "0 16px",
          padding: "10px 14px",
          borderRadius: "10px",
          background: summary.failed === 0
            ? "rgba(111,255,212,0.08)" : "rgba(251,191,36,0.08)",
          border: `1px solid ${summary.failed === 0 ? "rgba(111,255,212,0.25)" : "rgba(251,191,36,0.25)"}`,
          display: "flex", alignItems: "center", gap: "8px",
          flexShrink: 0,
        }}>
          {summary.failed === 0
            ? <CheckCircle2 size={14} style={{ color: "#6fffd4", flexShrink: 0 }} />
            : <AlertCircle  size={14} style={{ color: "#fbbf24", flexShrink: 0 }} />
          }
          <p style={{ fontSize: "12px", color: "var(--text)", margin: 0 }}>
            <strong>{summary.indexed}</strong> indexed
            {summary.failed > 0 && <>, <strong style={{ color: "#fbbf24" }}>{summary.failed}</strong> failed</>}
          </p>
        </div>
      )}

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div style={{
        padding: "12px 16px 16px",
        display: "flex", gap: "8px",
        borderTop: staged.length > 0 ? "1px solid var(--border)" : "none",
        flexShrink: 0,
      }}>
        {hasAnyDone && (
          <button
            onClick={clearDone}
            style={{
              flex: 1, padding: "10px", borderRadius: "10px",
              background: "var(--surface2)", border: "1px solid var(--border)",
              color: "var(--text-muted)", fontSize: "12px", fontWeight: 600,
              cursor: "pointer", fontFamily: "Syne, sans-serif",
            }}
          >
            Clear done
          </button>
        )}

        {pendingCount > 0 && (
          <button
            onClick={handleUpload}
            disabled={!canUpload}
            style={{
              flex: 2, padding: "10px", borderRadius: "10px",
              background: canUpload
                ? "linear-gradient(135deg, var(--accent), #9c6fff)"
                : "var(--border)",
              border: "none",
              color: "white", fontSize: "12px", fontWeight: 700,
              cursor: canUpload ? "pointer" : "not-allowed",
              fontFamily: "Syne, sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              opacity: canUpload ? 1 : 0.5,
              boxShadow: canUpload ? "0 4px 16px rgba(124,111,255,0.3)" : "none",
              transition: "all 0.2s",
            }}
          >
            {uploading
              ? <><Loader2 size={13} className="animate-spin" /> Uploading…</>
              : <><Sparkles size={13} /> Index {pendingCount} file{pendingCount > 1 ? "s" : ""}</>
            }
          </button>
        )}
      </div>
    </div>
  );
}
