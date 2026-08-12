import os
import sys

# Force UTF-8 output agar emoji tidak crash di Windows cp1252
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
import uuid
import shutil
import zipfile
import threading
import tempfile
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

# ── Tambahkan root folder ke sys.path agar bisa import script.py ──
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT_DIR)

from script import process_tif_to_shapefile  # noqa: E402 — script.py tidak diubah

app = Flask(__name__)
CORS(app)

# ── Konfigurasi path model (relatif terhadap root project) ──
MODEL_PATH = os.path.join(ROOT_DIR, "palmCounting-model.onnx")
YAML_PATH  = os.path.join(ROOT_DIR, "data.yaml")

# ── Folder untuk upload & output sementara ──
UPLOAD_DIR = os.path.join(ROOT_DIR, "backend", "uploads")
OUTPUT_DIR = os.path.join(ROOT_DIR, "backend", "outputs")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── In-memory job store ──
# Format: { job_id: { status, message, progress, result_zip, created_at, params, object_count } }
jobs: dict[str, dict] = {}
jobs_lock = threading.Lock()


# ════════════════════════════════════════════
#  HELPER
# ════════════════════════════════════════════

def _zip_shapefile(shp_path: str, zip_path: str) -> None:
    """Zip semua komponen shapefile (.shp .shx .dbf .prj .cpg) ke satu file zip."""
    base = os.path.splitext(shp_path)[0]
    extensions = [".shp", ".shx", ".dbf", ".prj", ".cpg", ".qpj", ".sbn", ".sbx"]
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for ext in extensions:
            candidate = base + ext
            if os.path.exists(candidate):
                zf.write(candidate, os.path.basename(candidate))


def _count_features(shp_path: str) -> int:
    """Hitung jumlah fitur di shapefile (tanpa mengubah script.py)."""
    try:
        import geopandas as gpd
        gdf = gpd.read_file(shp_path)
        return len(gdf)
    except Exception:
        return -1


def _run_pipeline(job_id: str, input_tif: str, params: dict) -> None:
    """Jalankan pipeline di thread terpisah."""
    job_output_dir = os.path.join(OUTPUT_DIR, job_id)
    os.makedirs(job_output_dir, exist_ok=True)
    output_shp = os.path.join(job_output_dir, "result.shp")

    def _update(status: str, message: str, progress: int = 0):
        with jobs_lock:
            jobs[job_id]["status"]   = status
            jobs[job_id]["message"]  = message
            jobs[job_id]["progress"] = progress

    try:
        _update("running", "Menyiapkan folder input sementara…", 5)

        # Buat folder input sementara yang berisi file TIF yang diupload
        temp_input = tempfile.mkdtemp(prefix="geo_input_")
        try:
            dest_tif = os.path.join(temp_input, os.path.basename(input_tif))
            shutil.copy2(input_tif, dest_tif)

            _update("running", "Menjalankan tiling & deteksi YOLO…", 20)

            process_tif_to_shapefile(
                input_folder   = temp_input,
                model_path     = MODEL_PATH,
                yaml_path      = YAML_PATH,
                output_shp_path= output_shp,
                tile_width     = params.get("tile_width",  640),
                tile_height    = params.get("tile_height", 640),
                min_distance   = params.get("min_distance", 3.0),
                gsd_x          = params.get("gsd_x") or None,
                gsd_y          = params.get("gsd_y") or None,
                conf_threshold = params.get("conf_threshold", 0.25),
                nms_threshold  = params.get("nms_threshold",  0.4),
            )
        finally:
            shutil.rmtree(temp_input, ignore_errors=True)

        # Zip hasil shapefile
        _update("running", "Mengemas shapefile…", 90)
        zip_path = os.path.join(job_output_dir, "result.zip")
        _zip_shapefile(output_shp, zip_path)

        obj_count = _count_features(output_shp)

        with jobs_lock:
            jobs[job_id]["status"]        = "done"
            jobs[job_id]["message"]       = "Proses selesai!"
            jobs[job_id]["progress"]      = 100
            jobs[job_id]["result_zip"]    = zip_path
            jobs[job_id]["object_count"]  = obj_count

    except Exception as exc:
        _update("error", f"Error: {exc}", 0)
    finally:
        # Hapus file TIF yang diupload setelah selesai
        if os.path.exists(input_tif):
            os.remove(input_tif)


# ════════════════════════════════════════════
#  ENDPOINTS
# ════════════════════════════════════════════

@app.route("/api/health", methods=["GET"])
def health():
    """Health check — juga verifikasi ketersediaan model & yaml."""
    model_ok = os.path.exists(MODEL_PATH)
    yaml_ok  = os.path.exists(YAML_PATH)
    return jsonify({
        "status": "ok",
        "model_found": model_ok,
        "yaml_found":  yaml_ok,
        "model_path":  MODEL_PATH,
        "yaml_path":   YAML_PATH,
    })


@app.route("/api/process", methods=["POST"])
def process():
    """
    Upload file TIF dan mulai pipeline deteksi.

    Form-data:
      - file          : file .tif (required)
      - tile_width    : int   (default 640)
      - tile_height   : int   (default 640)
      - min_distance  : float (default 3.0)
      - conf_threshold: float (default 0.25)
      - nms_threshold : float (default 0.4)
      - gsd_x         : float (optional)
      - gsd_y         : float (optional)
    """
    if "file" not in request.files:
        return jsonify({"error": "Tidak ada file yang diupload"}), 400

    f = request.files["file"]
    if f.filename == "":
        return jsonify({"error": "Nama file kosong"}), 400
    if not (f.filename.lower().endswith(".tif") or f.filename.lower().endswith(".tiff")):
        return jsonify({"error": "Hanya file .tif / .tiff yang didukung"}), 400

    # Simpan file upload
    job_id   = str(uuid.uuid4())
    tif_path = os.path.join(UPLOAD_DIR, f"{job_id}_{f.filename}")
    f.save(tif_path)

    # Parse parameter
    def _float(key, default):
        try:    return float(request.form.get(key, default))
        except: return default
    def _int(key, default):
        try:    return int(request.form.get(key, default))
        except: return default

    params = {
        "tile_width":     _int("tile_width",     640),
        "tile_height":    _int("tile_height",    640),
        "min_distance":   _float("min_distance",   3.0),
        "conf_threshold": _float("conf_threshold", 0.25),
        "nms_threshold":  _float("nms_threshold",  0.4),
        "gsd_x":          _float("gsd_x", 0) or None,
        "gsd_y":          _float("gsd_y", 0) or None,
    }

    with jobs_lock:
        jobs[job_id] = {
            "status":       "queued",
            "message":      "Job diantrekan",
            "progress":     0,
            "result_zip":   None,
            "object_count": None,
            "created_at":   datetime.utcnow().isoformat(),
            "params":       params,
            "filename":     f.filename,
        }

    # Jalankan di thread background
    t = threading.Thread(target=_run_pipeline, args=(job_id, tif_path, params), daemon=True)
    t.start()

    return jsonify({"job_id": job_id, "status": "queued"}), 202


@app.route("/api/status/<job_id>", methods=["GET"])
def status(job_id: str):
    """Polling status job."""
    with jobs_lock:
        job = jobs.get(job_id)
    if job is None:
        return jsonify({"error": "Job tidak ditemukan"}), 404

    return jsonify({
        "job_id":       job_id,
        "status":       job["status"],
        "message":      job["message"],
        "progress":     job["progress"],
        "object_count": job.get("object_count"),
        "filename":     job.get("filename"),
        "created_at":   job.get("created_at"),
    })


@app.route("/api/download/<job_id>", methods=["GET"])
def download(job_id: str):
    """Download shapefile .zip hasil deteksi."""
    with jobs_lock:
        job = jobs.get(job_id)
    if job is None:
        return jsonify({"error": "Job tidak ditemukan"}), 404
    if job["status"] != "done":
        return jsonify({"error": "Proses belum selesai"}), 400

    zip_path = job["result_zip"]
    if not zip_path or not os.path.exists(zip_path):
        return jsonify({"error": "File hasil tidak ditemukan"}), 404

    filename = os.path.splitext(job.get("filename", "result"))[0] + "_shapefile.zip"
    return send_file(
        zip_path,
        as_attachment=True,
        download_name=filename,
        mimetype="application/zip",
    )


@app.route("/api/jobs", methods=["GET"])
def list_jobs():
    """List semua job beserta statusnya."""
    with jobs_lock:
        result = [
            {
                "job_id":       jid,
                "status":       j["status"],
                "message":      j["message"],
                "progress":     j["progress"],
                "object_count": j.get("object_count"),
                "filename":     j.get("filename"),
                "created_at":   j.get("created_at"),
            }
            for jid, j in jobs.items()
        ]
    return jsonify(result)


@app.route("/api/jobs/<job_id>", methods=["DELETE"])
def delete_job(job_id: str):
    """Hapus job dan file outputnya."""
    with jobs_lock:
        job = jobs.pop(job_id, None)
    if job is None:
        return jsonify({"error": "Job tidak ditemukan"}), 404

    job_output_dir = os.path.join(OUTPUT_DIR, job_id)
    if os.path.exists(job_output_dir):
        shutil.rmtree(job_output_dir, ignore_errors=True)

    return jsonify({"message": f"Job {job_id} dihapus"})


# ════════════════════════════════════════════
#  MAIN
# ════════════════════════════════════════════
if __name__ == "__main__":
    print("=" * 60)
    print(" Geo AIT - Spatial Object Detection Backend")
    print("=" * 60)
    print(f"  Model : {MODEL_PATH}")
    print(f"  YAML  : {YAML_PATH}")
    print(f"  Model found : {os.path.exists(MODEL_PATH)}")
    print(f"  YAML found  : {os.path.exists(YAML_PATH)}")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=False)
