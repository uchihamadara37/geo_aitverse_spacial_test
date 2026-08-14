"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import UploadZone from "@/components/UploadZone";
import ParameterPanel, { type Params } from "@/components/ParameterPanel";
import ProcessingStatus from "@/components/ProcessingStatus";
import ResultPanel from "@/components/ResultPanel";
import {
  checkHealth, submitJob, pollStatus, deleteJob, listJobs,
  type JobStatus, type HealthResponse,
} from "@/lib/api";

const DEFAULT_PARAMS: Params = {
  tile_width:     640,
  tile_height:    640,
  conf_threshold: 0.25,
  nms_threshold:  0.40,
  min_distance:   3.0,
  gsd_x:          0,
  gsd_y:          0,
};

type AppState = "idle" | "uploading" | "processing" | "done" | "error";

export default function Home() {
  const [health,  setHealth]  = useState<HealthResponse | null>(null);
  const [file,    setFile]    = useState<File | null>(null);
  const [params,  setParams]  = useState<Params>(DEFAULT_PARAMS);
  const [state,   setState]   = useState<AppState>("idle");
  const [job,     setJob]     = useState<JobStatus | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [history, setHistory] = useState<JobStatus[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Health check on mount ── */
  useEffect(() => {
    checkHealth().then(setHealth).catch(() => setHealth(null));
    listJobs().then(setHistory).catch(() => {});
  }, []);

  /* ── Stop polling on unmount ── */
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  /* ── Start polling once a job exists ── */
  const startPolling = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const s = await pollStatus(jobId);
        setJob(s);
        if (s.status === "done") {
          setState("done");
          clearInterval(pollRef.current!);
          // Refresh history
          listJobs().then(setHistory).catch(() => {});
        } else if (s.status === "error") {
          setState("error");
          setError(s.message);
          clearInterval(pollRef.current!);
          listJobs().then(setHistory).catch(() => {});
        }
      } catch {
        // keep polling
      }
    }, 2000);
  }, []);

  /* ── Submit ── */
  const handleSubmit = async () => {
    console.log("Submitting job with params:", params);
    if (!file) { setError("Pilih file TIF terlebih dahulu"); return; }
    setError(null);
    setState("uploading");
    try {
      const { job_id } = await submitJob(file, {
        ...params,
        gsd_x: params.gsd_x || undefined,
        gsd_y: params.gsd_y || undefined,
      });
      const initial = await pollStatus(job_id);
      setJob(initial);
      setState("processing");
      startPolling(job_id);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Upload gagal");
      setState("error");
    }
  };

  /* ── Reset ── */
  const handleReset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setFile(null);
    setJob(null);
    setError(null);
    setState("idle");
    listJobs().then(setHistory).catch(() => {});
  };

  const isProcessing = state === "uploading" || state === "processing";
  const isDone       = state === "done";

  return (
    <div className="app-root">
      {/* ─── Header ─────────────────────────── */}
      <header className="header">
        <div className="header-inner">
          <a href="/" className="logo">
            <div className="logo-icon">🛰</div>
            <span className="logo-text">Geo<span>Spacial</span></span>
          </a>

          <div className="health-badge">
            <div className={`health-dot${health?.status === "ok" && health.model_found ? " ok" : health === null ? "" : " err"}`} />
            {health === null
              ? "Menghubungkan…"
              : health.status === "ok" && health.model_found
              ? "Backend aktif · Model tersedia"
              : "Backend / Model tidak ditemukan"}
          </div>
        </div>
      </header>

      {/* ─── Main ───────────────────────────── */}
      <main className="main">
        {/* Hero */}
        <div className="hero">
          <div className="hero-tag">
            <span>🌿</span> Deteksi Objek Spasial — YOLO ONNX
          </div>
          <h1>Deteksi Otomatis<br />dari Citra Satelit</h1>
          <p>
            Upload GeoTIFF, atur parameter deteksi, lalu unduh hasilnya
            sebagai shapefile yang siap digunakan di QGIS atau ArcGIS.
          </p>
        </div>

        {/* Content grid */}
        <div className="content-grid">
          {/* LEFT: Upload + Status + Result */}
          <div>
            <div className="card">
              <div className="card-header">
                <div className="card-header-icon">📡</div>
                <div>
                  <h2>Upload Citra Satelit</h2>
                  <p>Format GeoTIFF (.tif / .tiff)</p>
                </div>
              </div>
              <div className="card-body">
                <UploadZone onFileSelect={setFile} disabled={isProcessing} />

                {error && (
                  <div className="error-banner mt-12">⚠️ {error}</div>
                )}

                <div className="mt-16">
                  {!isDone ? (
                    <button
                      id="btn-process"
                      className="btn-primary"
                      onClick={handleSubmit}
                      disabled={!file || isProcessing}
                    >
                      {state === "uploading"
                        ? <><span className="status-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Mengupload…</>
                        : state === "processing"
                        ? <><span className="status-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Memproses…</>
                        : <><span>🚀</span> Mulai Proses Deteksi</>
                      }
                    </button>
                  ) : (
                    <button id="btn-reset" className="btn-primary" onClick={handleReset}>
                      <span>🔄</span> Proses File Baru
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Status */}
            {job && <ProcessingStatus job={job} />}

            {/* Result */}
            {job?.status === "done" && <ResultPanel job={job} />}
          </div>

          {/* RIGHT: Parameter panel */}
          <div>
            <div className="card">
              <div className="card-header">
                <div className="card-header-icon">⚙️</div>
                <div>
                  <h2>Parameter Deteksi</h2>
                  <p>Sesuaikan sebelum memproses</p>
                </div>
              </div>
              <div className="card-body">
                <ParameterPanel params={params} onChange={setParams} disabled={isProcessing} />
                <div className="param-divider" />
                <button
                  id="btn-reset-params"
                  className="btn-secondary"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => setParams(DEFAULT_PARAMS)}
                  disabled={isProcessing}
                >
                  ↺ Reset ke Default
                </button>
              </div>
            </div>

            {/* How it works */}
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <div className="card-header-icon">📖</div>
                <div>
                  <h2>Cara Kerja</h2>
                  <p>Pipeline otomatis 3 langkah</p>
                </div>
              </div>
              <div className="card-body">
                {[
                  { n: "01", icon: "✂️", title: "Tiling",   desc: "Gambar TIF dipotong menjadi tile 640×640 px dengan overlap." },
                  { n: "02", icon: "🔍", title: "Deteksi",  desc: "Model YOLO ONNX mendeteksi objek (sawit) di setiap tile." },
                  { n: "03", icon: "📦", title: "Shapefile", desc: "Koordinat spasial digabung dan di-filter, lalu diekspor ke .shp." },
                ].map((s) => (
                  <div key={s.n} style={{
                    display: "flex", gap: 12, marginBottom: 16,
                    paddingBottom: 16, borderBottom: "1px solid var(--border)",
                  }}
                    className={s.n === "03" ? "" : ""}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: "var(--teal-glow)", border: "1px solid var(--border-bright)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "1.1rem",
                    }}>
                      {s.icon}
                    </div>
                    <div>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 6,
                        marginBottom: 3,
                      }}>
                        <span style={{ fontSize: "0.65rem", color: "var(--teal)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{s.n}</span>
                        <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>{s.title}</span>
                      </div>
                      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.5 }}>{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Job history */}
            {history.length > 0 && (
              <div className="job-history">
                <h3>🕘 Riwayat Job</h3>
                {history.slice(-5).reverse().map((j) => (
                  <div key={j.job_id} className="job-item">
                    <div>
                      <div className="job-item-name">{j.filename ?? "—"}</div>
                      <div className="job-item-meta">
                        {j.object_count != null ? `${j.object_count} objek` : j.message}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className={`status-pill ${j.status}`}>{j.status}</span>
                      {j.status === "done" && (
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/download/${j.job_id}`}
                          download
                          className="btn-secondary"
                          style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                        >
                          ⬇
                        </a>
                      )}
                      <button
                        onClick={() => deleteJob(j.job_id).then(() => listJobs().then(setHistory).catch(() => {}))}
                        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.9rem", padding: 4 }}
                        title="Hapus job"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ─── Footer ─────────────────────────── */}
      <footer className="footer">
        🛰️ &nbsp;Geo AIT — Spatial Object Detection · YOLO ONNX · GeoTIFF → Shapefile
      </footer>
    </div>
  );
}
