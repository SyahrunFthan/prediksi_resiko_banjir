import os
import json
import joblib
import pandas as pd
import numpy as np
from flask import Flask, render_template, jsonify, request, Response
from dotenv import load_dotenv

from train_model import (
    load_and_preprocess_data,
    train_and_save_model,
    resolve_dataset_key,
    DATASETS_META,
)
from geo_utils import get_sulteng_geojson_dict

app = Flask(__name__, static_folder="static", template_folder="templates")
load_dotenv()

DATA_CACHE = {}
MODEL_CACHE = {}


def get_data_and_model(dataset_key=None):
    resolved_key = resolve_dataset_key(dataset_key)
    meta = DATASETS_META[resolved_key]

    if resolved_key not in DATA_CACHE:
        DATA_CACHE[resolved_key] = load_and_preprocess_data(resolved_key)

    if resolved_key not in MODEL_CACHE:
        model_path = meta["model_path"]
        if os.path.exists(model_path):
            MODEL_CACHE[resolved_key] = joblib.load(model_path)
        else:
            df_trained, artifact = train_and_save_model(resolved_key)
            DATA_CACHE[resolved_key] = df_trained
            MODEL_CACHE[resolved_key] = artifact

    return DATA_CACHE[resolved_key], MODEL_CACHE[resolved_key], resolved_key, meta


def get_public_datasets_list():
    items = []
    for _, m in DATASETS_META.items():
        items.append({
            "key": m["key"],
            "label": m["label"],
            "short_label": m["short_label"],
            "badge": m["badge"],
            "description": m["description"],
            "source": m["source"],
            "type": m["type"],
            "sheet": m.get("sheet", ""),
        })
    return items


@app.route("/")
def index():
    map_api_key = os.getenv("MAP_API_KEY", "")
    return render_template("index.html", map_api_key=map_api_key)


@app.route("/api/datasets")
def api_datasets():
    return jsonify({"datasets": get_public_datasets_list()})


@app.route("/api/summary")
def api_summary():
    dataset_param = request.args.get("dataset", "dataset_cuaca_sulawesi_tengah.csv")
    df, artifact, resolved_key, meta = get_data_and_model(dataset_param)

    kabupaten_param = request.args.get("kabupaten", "all")
    risk_param = request.args.get("risk", "all")

    filtered_df = df.copy()
    if kabupaten_param != "all":
        filtered_df = filtered_df[filtered_df["kabupaten_kota"] == kabupaten_param]
    if risk_param != "all":
        filtered_df = filtered_df[filtered_df["kategori_risiko"] == risk_param]

    total_records = len(filtered_df)
    high_count = int((filtered_df["kategori_risiko"] == "Tinggi").sum())
    med_count = int((filtered_df["kategori_risiko"] == "Sedang").sum())
    low_count = int((filtered_df["kategori_risiko"] == "Rendah").sum())

    kab_list = sorted(df["kabupaten_kota"].dropna().unique().tolist())
    unique_locs = int(len(filtered_df[["latitude", "longitude"]].drop_duplicates()))

    total_terendam = int(filtered_df["rumah_terendam"].sum()) if "rumah_terendam" in filtered_df.columns else 0
    total_rusak = int(filtered_df["rumah_rusak"].sum()) if "rumah_rusak" in filtered_df.columns else 0
    total_fasum = int(filtered_df["fasum_rusak"].sum()) if "fasum_rusak" in filtered_df.columns else 0
    avg_hujan = round(float(filtered_df["curah_hujan"].mean() or 0.0), 1) if len(filtered_df) > 0 else 0.0
    avg_hujan_3h = (
        round(float(filtered_df["hujan_3hari"].mean() or 0.0), 1)
        if "hujan_3hari" in filtered_df.columns and len(filtered_df) > 0
        else 0.0
    )

    kab_elevations = (
        df.groupby("kabupaten_kota")["elevasi"].median().round(0).to_dict()
        if "elevasi" in df.columns
        else {}
    )

    return jsonify({
        "dataset_key": resolved_key,
        "dataset_meta": {
            "key": meta["key"],
            "label": meta["label"],
            "short_label": meta["short_label"],
            "badge": meta["badge"],
            "description": meta["description"],
            "source": meta["source"],
            "type": meta["type"],
            "sheet": meta.get("sheet", ""),
            "accuracy": round(artifact.get("accuracy", 0.0) * 100, 2),
        },
        "available_datasets": get_public_datasets_list(),
        "total_records": total_records,
        "total_data": total_records,
        "unique_locations": unique_locs,
        "high_count": high_count,
        "high_risk_count": high_count,
        "med_count": med_count,
        "med_risk_count": med_count,
        "low_count": low_count,
        "low_risk_count": low_count,
        "high_pct": round((high_count / max(1, total_records)) * 100, 1),
        "med_pct": round((med_count / max(1, total_records)) * 100, 1),
        "low_pct": round((low_count / max(1, total_records)) * 100, 1),
        "total_rumah_terendam": total_terendam,
        "total_rumah_rusak": total_rusak,
        "total_fasum_rusak": total_fasum,
        "avg_curah_hujan": avg_hujan,
        "avg_hujan_3hari": avg_hujan_3h,
        "kabupaten_elevations": kab_elevations,
        "kabupaten_options": kab_list,
        "kabupaten_list": kab_list,
    })


@app.route("/api/geojson/boundary")
def api_geojson_boundary():
    dataset_param = request.args.get("dataset", "dataset_cuaca_sulawesi_tengah.csv")
    df, _, _, _ = get_data_and_model(dataset_param)
    geojson_dict = get_sulteng_geojson_dict(df)
    return jsonify(geojson_dict)


@app.route("/api/weather-points")
def api_weather_points():
    dataset_param = request.args.get("dataset", "dataset_cuaca_sulawesi_tengah.csv")
    df, _, resolved_key, meta = get_data_and_model(dataset_param)

    kabupaten_param = request.args.get("kabupaten", "all")
    risk_param = request.args.get("risk", "all")
    limit = int(request.args.get("limit", 2000))

    filtered_df = df.dropna(subset=["latitude", "longitude"]).copy()
    if kabupaten_param != "all":
        filtered_df = filtered_df[filtered_df["kabupaten_kota"] == kabupaten_param]
    if risk_param != "all":
        filtered_df = filtered_df[filtered_df["kategori_risiko"] == risk_param]

    sorted_df = filtered_df.sort_values(by=["risk_score"], ascending=False)
    unique_points_df = sorted_df.drop_duplicates(subset=["latitude", "longitude"])

    if len(unique_points_df) > limit:
        chunks = []
        total_u = len(unique_points_df)
        for _, grp in unique_points_df.groupby("kabupaten_kota", sort=False):
            take_n = max(1, int(limit * len(grp) / total_u))
            chunks.append(grp.head(take_n))
        sample_df = pd.concat(chunks, ignore_index=False).head(limit)
    else:
        sample_df = unique_points_df

    points = []
    for idx, row in sample_df.iterrows():
        points.append({
            "id": str(row.get("adm4", idx)),
            "id_kabupaten": str(row.get("id_kabupaten", "")),
            "kabupaten": str(row.get("kabupaten_kota", "")),
            "kecamatan": str(row.get("kecamatan", "")),
            "desa": str(row.get("desa_kelurahan", "")),
            "latitude": float(row.get("latitude", 0.0)),
            "longitude": float(row.get("longitude", 0.0)),
            "elevasi": float(row.get("elevasi", 0.0)),
            "suhu": float(row.get("suhu", 0.0)),
            "suhu_maks": float(row.get("suhu_maks", 0.0)),
            "suhu_min": float(row.get("suhu_min", 0.0)),
            "kelembapan": float(row.get("kelembapan", 0.0)),
            "tutupan_awan": float(row.get("tutupan_awan", 0.0)),
            "kecepatan_angin": float(row.get("kecepatan_angin", 0.0)),
            "angin_maks": float(row.get("angin_maks", 0.0)),
            "cuaca": str(row.get("deskripsi_cuaca", "")),
            "curah_hujan": float(row.get("curah_hujan", 0.0)),
            "presipitasi": float(row.get("presipitasi", 0.0)),
            "durasi_hujan": float(row.get("durasi_hujan", 0.0)),
            "hujan_3hari": float(row.get("hujan_3hari", 0.0)),
            "hujan_7hari": float(row.get("hujan_7hari", 0.0)),
            "rumah_terendam": int(row.get("rumah_terendam", 0)),
            "rumah_rusak": int(row.get("rumah_rusak", 0)),
            "fasum_rusak": int(row.get("fasum_rusak", 0)),
            "meninggal": int(row.get("meninggal", 0)),
            "hilang": int(row.get("hilang", 0)),
            "terluka": int(row.get("terluka", 0)),
            "penyebab": str(row.get("penyebab", "")),
            "sumber_data": str(row.get("sumber_data", "")),
            "model_cuaca": str(row.get("model_cuaca", "")),
            "tanggal": str(row.get("local_datetime", "")),
            "kategori_risiko": str(row.get("kategori_risiko", "Rendah")),
            "risk_score": round(float(row.get("risk_score", 0.0)), 4),
            "dataset_type": meta["type"],
        })

    return jsonify({
        "dataset_key": resolved_key,
        "dataset_type": meta["type"],
        "points": points,
        "total_shown": len(points),
    })


@app.route("/api/predict", methods=["POST"])
def api_predict():
    data = request.json or {}
    dataset_param = data.get(
        "dataset", request.args.get("dataset", "dataset_cuaca_sulawesi_tengah.csv")
    )
    df, artifact, resolved_key, meta = get_data_and_model(dataset_param)
    clf = artifact["model"]
    features = artifact["features"]

    try:
        suhu = float(data.get("suhu", 26.5))
        kelembapan = float(data.get("kelembapan", 85.0))
        kode_cuaca = float(data.get("kode_cuaca", 61.0))
        kecepatan_angin = float(data.get("kecepatan_angin", 10.0))
        angin_maks = float(data.get("angin_maks", kecepatan_angin + 8.0))
        tutupan_awan = float(data.get("tutupan_awan", 75.0))
        jam = float(data.get("jam", 14.0))
        bulan = float(data.get("bulan", 8.0))
        curah_hujan = float(data.get("curah_hujan", 15.0))
        presipitasi = float(data.get("presipitasi", curah_hujan))
        durasi_hujan = float(data.get("durasi_hujan", 10.0))
        hujan_3hari = float(data.get("hujan_3hari", 25.0))
        hujan_7hari = float(data.get("hujan_7hari", 55.0))
        elevasi = float(data.get("elevasi", 44.0))

        kabupaten = data.get("kabupaten")
        if kabupaten and kabupaten != "all":
            sub_kab = df[df["kabupaten_kota"] == kabupaten]
            if not sub_kab.empty:
                latitude = float(sub_kab["latitude"].median())
                longitude = float(sub_kab["longitude"].median())
                if "elevasi" not in data:
                    elevasi = float(sub_kab["elevasi"].median())
            else:
                latitude = float(data.get("latitude", -1.43))
                longitude = float(data.get("longitude", 121.44))
        else:
            latitude = float(data.get("latitude", -1.43))
            longitude = float(data.get("longitude", 121.44))
    except (ValueError, TypeError) as e:
        return jsonify({"error": f"Invalid parameter formats: {e}"}), 400

    feature_values = {
        "suhu": suhu,
        "kelembapan": kelembapan,
        "kode_cuaca": kode_cuaca,
        "kecepatan_angin": kecepatan_angin,
        "angin_maks": angin_maks,
        "tutupan_awan": tutupan_awan,
        "latitude": latitude,
        "longitude": longitude,
        "jam": jam,
        "bulan": bulan,
        "curah_hujan": curah_hujan,
        "presipitasi": presipitasi,
        "durasi_hujan": durasi_hujan,
        "hujan_3hari": hujan_3hari,
        "hujan_7hari": hujan_7hari,
        "elevasi": elevasi,
    }

    input_df = pd.DataFrame([feature_values])[features]

    prediction = clf.predict(input_df)[0]
    probs = clf.predict_proba(input_df)[0]
    classes = clf.classes_
    prob_map = {cls: round(float(p) * 100, 1) for cls, p in zip(classes, probs)}

    return jsonify({
        "dataset_key": resolved_key,
        "dataset_label": meta["short_label"],
        "dataset_type": meta["type"],
        "model_accuracy": round(artifact.get("accuracy", 0.0) * 100, 2),
        "prediction": str(prediction),
        "probabilities": prob_map,
        "features_used": input_df.to_dict(orient="records")[0],
    })


@app.route("/api/analytics")
def api_analytics():
    dataset_param = request.args.get("dataset", "dataset_cuaca_sulawesi_tengah.csv")
    df, artifact, resolved_key, meta = get_data_and_model(dataset_param)

    kab_grouped = (
        df.groupby(["kabupaten_kota", "kategori_risiko"]).size().unstack(fill_value=0)
    )
    kab_categories = kab_grouped.index.tolist()

    kab_data = {
        "categories": kab_categories,
        "tinggi": kab_grouped.get(
            "Tinggi", pd.Series(0, index=kab_grouped.index)
        ).tolist(),
        "sedang": kab_grouped.get(
            "Sedang", pd.Series(0, index=kab_grouped.index)
        ).tolist(),
        "rendah": kab_grouped.get(
            "Rendah", pd.Series(0, index=kab_grouped.index)
        ).tolist(),
    }

    weather_counts = df["deskripsi_cuaca"].value_counts().to_dict()
    fi = artifact.get("feature_importances", {})

    return jsonify({
        "dataset_key": resolved_key,
        "dataset_label": meta["short_label"],
        "dataset_type": meta["type"],
        "kabupaten_risk": kab_data,
        "weather_distribution": weather_counts,
        "feature_importances": fi,
        "accuracy": round(artifact.get("accuracy", 0.0) * 100, 2),
    })


@app.route("/api/table-data")
def api_table_data():
    dataset_param = request.args.get("dataset", "dataset_cuaca_sulawesi_tengah.csv")
    df, _, resolved_key, meta = get_data_and_model(dataset_param)

    search = request.args.get("search", "").lower()
    kabupaten = request.args.get("kabupaten", "all")
    risk = request.args.get("risk", "all")
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", request.args.get("limit", 12)))

    filtered_df = df.copy()
    if kabupaten != "all":
        filtered_df = filtered_df[filtered_df["kabupaten_kota"] == kabupaten]
    if risk != "all":
        filtered_df = filtered_df[filtered_df["kategori_risiko"] == risk]

    if search:
        mask = (
            filtered_df["kabupaten_kota"].astype(str).str.lower().str.contains(search)
            | filtered_df["kecamatan"].astype(str).str.lower().str.contains(search)
            | filtered_df["desa_kelurahan"].astype(str).str.lower().str.contains(search)
            | filtered_df["deskripsi_cuaca"].astype(str).str.lower().str.contains(search)
            | filtered_df["local_datetime"].astype(str).str.lower().str.contains(search)
            | filtered_df["penyebab"].astype(str).str.lower().str.contains(search)
        )
        filtered_df = filtered_df[mask]

    total_filtered = len(filtered_df)
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page

    paged_df = filtered_df.iloc[start_idx:end_idx]

    cols = [
        "adm4",
        "id_kabupaten",
        "kabupaten_kota",
        "kecamatan",
        "desa_kelurahan",
        "elevasi",
        "suhu",
        "suhu_maks",
        "suhu_min",
        "kelembapan",
        "tutupan_awan",
        "kecepatan_angin",
        "angin_maks",
        "curah_hujan",
        "presipitasi",
        "durasi_hujan",
        "hujan_3hari",
        "hujan_7hari",
        "rumah_terendam",
        "rumah_rusak",
        "fasum_rusak",
        "meninggal",
        "hilang",
        "terluka",
        "penyebab",
        "sumber_data",
        "model_cuaca",
        "status_pencocokan",
        "deskripsi_cuaca",
        "kategori_risiko",
        "risk_score",
        "local_datetime",
    ]
    rows = paged_df[cols].to_dict(orient="records")

    return jsonify({
        "dataset_key": resolved_key,
        "dataset_type": meta["type"],
        "sheet": meta.get("sheet", ""),
        "total": total_filtered,
        "page": page,
        "per_page": per_page,
        "total_pages": int(np.ceil(total_filtered / per_page))
        if total_filtered > 0
        else 1,
        "rows": rows,
    })


@app.route("/api/export-csv")
def api_export_csv():
    dataset_param = request.args.get("dataset", "dataset_cuaca_sulawesi_tengah.csv")
    df, _, resolved_key, _ = get_data_and_model(dataset_param)
    csv_str = df.to_csv(index=False)
    if resolved_key == "dataset_cuaca_new.xlsx":
        filename = "prediksi_banjir_dan_cuaca_new.csv"
    elif resolved_key == "dataset_cuaca_new_historis":
        filename = "prediksi_cuaca_historis_new.csv"
    else:
        filename = "prediksi_banjir_sulawesi_tengah.csv"
    return Response(
        csv_str,
        mimetype="text/csv",
        headers={"Content-disposition": f"attachment; filename={filename}"},
    )


if __name__ == "__main__":
    get_data_and_model("dataset_cuaca_sulawesi_tengah.csv")
    get_data_and_model("dataset_cuaca_new.xlsx")
    print("Starting Flask web server on http://localhost:5050...")
    app.run(host="0.0.0.0", port=5050, debug=True)
