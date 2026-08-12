const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface JobStatus {
  job_id: string;
  status: "queued" | "running" | "done" | "error";
  message: string;
  progress: number;
  object_count: number | null;
  filename: string | null;
  created_at: string | null;
}

export interface HealthResponse {
  status: string;
  model_found: boolean;
  yaml_found: boolean;
  model_path: string;
  yaml_path: string;
}

export interface ProcessParams {
  tile_width: number;
  tile_height: number;
  min_distance: number;
  conf_threshold: number;
  nms_threshold: number;
  gsd_x?: number;
  gsd_y?: number;
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("Backend tidak dapat dijangkau");
  return res.json();
}

export async function submitJob(file: File, params: ProcessParams): Promise<{ job_id: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("tile_width",     String(params.tile_width));
  form.append("tile_height",    String(params.tile_height));
  form.append("min_distance",   String(params.min_distance));
  form.append("conf_threshold", String(params.conf_threshold));
  form.append("nms_threshold",  String(params.nms_threshold));
  if (params.gsd_x) form.append("gsd_x", String(params.gsd_x));
  if (params.gsd_y) form.append("gsd_y", String(params.gsd_y));
  console.log("Submitting job test");

  const res = await fetch(`${API_BASE}/api/process`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload gagal" }));
    throw new Error(err.error || "Upload gagal");
  }
  return res.json();
}

export async function pollStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/api/status/${jobId}`);
  if (!res.ok) throw new Error("Gagal mengambil status");
  return res.json();
}

export function downloadUrl(jobId: string): string {
  return `${API_BASE}/api/download/${jobId}`;
}

export async function listJobs(): Promise<JobStatus[]> {
  const res = await fetch(`${API_BASE}/api/jobs`);
  if (!res.ok) throw new Error("Gagal mengambil daftar job");
  return res.json();
}

export async function deleteJob(jobId: string): Promise<void> {
  await fetch(`${API_BASE}/api/jobs/${jobId}`, { method: "DELETE" });
}
