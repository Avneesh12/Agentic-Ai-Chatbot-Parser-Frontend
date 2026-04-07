"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload, X, FileText, CheckCircle2, XCircle, AlertCircle,
  Loader2, Database, ChevronDown, ChevronUp, Trash2
} from "lucide-react";
import { uploadFiles, ENABLE_RAG_UPLOAD } from "@/lib/api";
import type { FileUploadResult, UploadResponse } from "@/lib/api";

const ALLOWED = [".pdf", ".docx", ".txt", ".csv", ".xlsx", ".md"];
const MAX_SIZE_MB = 20;

interface QueuedFile { file: File; id: string; }

function fileExt(name: string) {
  return name.split(".").pop()?.toUpperCase() ?? "FILE";
}

function fileSizeFmt(bytes: number) {
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusIcon({ status }: { status: FileUploadResult["status"] }) {
  if (status === "indexed")  return <CheckCircle2 size={14} style={{ color: "var(--teal)" }} />;
  if (status === "error")    return <XCircle      size={14} style={{ color: "var(--red)" }} />;
  return                            <AlertCircle  size={14} style={{ color: "var(--amber)" }} />;
}

interface Props {
  onClose: () => void;
}

export default function UploadPanel({ onClose }: Props) {
  const [queue,       setQueue]       = useState<QueuedFile[]>([]);
  const [uploading,   setUploading]   = useState(false);
  const [result,      setResult]      = useState<UploadResponse | null>(null);
  const [dragOver,    setDragOver]    = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: File[]) => {
    const valid = incoming.filter(f => {
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      return ALLOWED.includes(ext) && f.size <= MAX_SIZE_MB * 1024 * 1024;
    });
    const ids = valid.map(f => ({ file: f, id: `${f.name}-${Date.now()}-${Math.random()}` }));
    setQueue(prev => {
      const names = new Set(prev.map(q => q.file.name));
      return [...prev, ...ids.filter(q => !names.has(q.file.name))].slice(0, 20);
    });
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const remove = (id: string) => setQueue(prev => prev.filter(q => q.id !== id));

  const upload = async () => {
    if (!queue.length || uploading) return;
    setUploading(true); setResult(null);
    try {
      const res = await uploadFiles(queue.map(q => q.file));
      setResult(res);
      setQueue([]);
    } catch (err: unknown) {
      setResult({
        summary: { total: queue.length, indexed: 0, failed: queue.length },
        files: queue.map(q => ({
          filename: q.file.name,
          status: "error",
          reason: err instanceof Error ? err.message : "Upload failed",
        })),
      });
    } finally { setUploading(false); }
  };

  if (!ENABLE_RAG_UPLOAD) return null;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--surface)" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ width: 34, height: 34, background: "var(--teal-dim)", border: "1px solid rgba(0,212,170,0.25)" }}>
            <Database size={15} style={{ color: "var(--teal)" }} />
          </div>
          <div className="min-w-0">
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>
              Knowledge Base
            </p>
            {/* Format list wraps on narrow screens */}
            <p style={{ fontSize: 10, color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              PDF · DOCX · TXT · CSV · XLSX · MD
            </p>
          </div>
        </div>
        {/* Close — 44x44 */}
        <button onClick={onClose}
          className="flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
          style={{ width: 44, height: 44, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--ink3)" }}>
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 flex flex-col gap-4 min-h-0">

        {/* ── Drop zone ────────────────────────────────────────────────── */}
        <div
          className={`rounded-xl flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all ${dragOver ? "drag-over" : ""}`}
          style={{
            minHeight: 130,
            border: "2px dashed var(--border2)",
            background: dragOver ? "rgba(0,212,170,0.04)" : "var(--bg2)",
            padding: "20px 16px",
          }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div className="flex items-center justify-center rounded-xl"
            style={{ width: 44, height: 44, background: "var(--surface2)", border: "1px solid var(--border2)" }}>
            <Upload size={18} style={{ color: dragOver ? "var(--teal)" : "var(--ink3)" }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 3 }}>
              {dragOver ? "Drop to add files" : "Drag & drop files here"}
            </p>
            <p style={{ fontSize: 11, color: "var(--ink3)" }}>
              or tap to browse · max {MAX_SIZE_MB} MB · up to 20 files
            </p>
          </div>
          <input ref={inputRef} type="file" multiple hidden accept={ALLOWED.join(",")} onChange={onPick} />
        </div>

        {/* ── Queue ────────────────────────────────────────────────────── */}
        {queue.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {queue.length} file{queue.length > 1 ? "s" : ""} queued
              </p>
              <button onClick={() => setQueue([])}
                className="flex items-center gap-1 text-xs transition-colors"
                style={{ color: "var(--ink3)", background: "none", border: "none", cursor: "pointer", minHeight: "var(--touch-min)", padding: "0 4px" }}>
                <Trash2 size={11} /> Clear all
              </button>
            </div>
            {queue.map(q => (
              <div key={q.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                {/* File type badge */}
                <div className="flex items-center justify-center rounded text-xs font-bold flex-shrink-0"
                  style={{ width: 32, height: 32, background: "var(--surface3)", color: "var(--teal)", fontFamily: "var(--font-display)", fontSize: 9 }}>
                  {fileExt(q.file.name)}
                </div>
                {/* File name — truncates on narrow screens */}
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 12, color: "var(--ink)", fontWeight: 500 }} className="truncate">
                    {q.file.name}
                  </p>
                  <p style={{ fontSize: 10, color: "var(--ink3)" }}>{fileSizeFmt(q.file.size)}</p>
                </div>
                {/* Remove — 44x44 touch target */}
                <button onClick={() => remove(q.id)}
                  className="flex-shrink-0 flex items-center justify-center transition-colors"
                  style={{ width: 36, height: 36, color: "var(--ink3)", background: "none", border: "none", cursor: "pointer", minHeight: "unset" }}>
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Upload button ─────────────────────────────────────────────── */}
        {queue.length > 0 && (
          <button onClick={upload} disabled={uploading}
            className="w-full rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all flex-shrink-0"
            style={{
              fontFamily: "var(--font-display)",
              background: uploading ? "var(--surface3)" : "linear-gradient(135deg, var(--teal), var(--blue))",
              color: uploading ? "var(--ink3)" : "#000",
              cursor: uploading ? "not-allowed" : "pointer",
              border: "none",
              boxShadow: uploading ? "none" : "0 4px 20px rgba(0,212,170,0.2)",
              padding: "14px",
              minHeight: "var(--touch-min)",
            }}>
            {uploading
              ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Indexing…</>
              : <><Upload size={14} /> Index {queue.length} file{queue.length > 1 ? "s" : ""}</>
            }
          </button>
        )}

        {/* ── Result ───────────────────────────────────────────────────── */}
        {result && (
          <div className="rounded-xl overflow-hidden fade-up"
            style={{ border: "1px solid var(--border2)", background: "var(--bg2)" }}>
            {/* Summary bar */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-3"
              style={{ borderBottom: result.files.length > 0 ? "1px solid var(--border)" : "none" }}>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <CheckCircle2 size={16} style={{ color: result.summary.indexed > 0 ? "var(--teal)" : "var(--red)", flexShrink: 0 }} />
                <div className="min-w-0">
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                    {result.summary.indexed > 0 ? "Indexed successfully" : "Index failed"}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--ink3)" }}>
                    {result.summary.indexed}/{result.summary.total} files added
                  </p>
                </div>
              </div>
              {/* Toggle — 44x44 */}
              <button onClick={() => setShowDetails(p => !p)}
                style={{ width: 44, height: 44, color: "var(--ink3)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "unset" }}>
                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {/* Per-file detail */}
            {showDetails && (
              <div className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
                {result.files.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 px-3 sm:px-4 py-2.5">
                    <StatusIcon status={f.status} />
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 12, color: "var(--ink)", fontWeight: 500 }} className="truncate">{f.filename}</p>
                      <p style={{ fontSize: 10, color: "var(--ink3)" }}>
                        {f.status === "indexed"
                          ? `${f.chunks_inserted} chunks indexed`
                          : f.reason ?? f.status
                        }
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      f.status === "indexed" ? "badge-rag" : f.status === "error" ? "" : "badge-tool"
                    }`} style={f.status === "error" ? { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--red)" } : {}}>
                      {f.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {!queue.length && !result && (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <FileText size={28} style={{ color: "var(--ink3)" }} />
            <p style={{ fontSize: 12, color: "var(--ink3)", lineHeight: 1.6 }}>
              Upload your documents to ground the AI's<br />answers in your own knowledge base.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
