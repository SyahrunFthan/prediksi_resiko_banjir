import os
import re
import json
import zipfile
import xml.etree.ElementTree as ET
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix

BASE_DIR = os.path.dirname(__file__)
DATASET_CSV_PATH = os.path.join(BASE_DIR, "dataset_cuaca_sulawesi_tengah.csv")
DATASET_XLSX_PATH = os.path.join(BASE_DIR, "dataset_cuaca_new.xlsx")
DATASET_PATH = DATASET_CSV_PATH
MODEL_PATH = os.path.join(BASE_DIR, "model_banjir.joblib")
MODEL_NEW_PATH = os.path.join(BASE_DIR, "model_banjir_new.joblib")
MODEL_HIST_PATH = os.path.join(BASE_DIR, "model_banjir_historis.joblib")

DATASETS_META = {
    "dataset_cuaca_sulawesi_tengah.csv": {
        "key": "dataset_cuaca_sulawesi_tengah.csv",
        "label": "Dataset 1: Observasi Cuaca Desa BMKG (dataset_cuaca_sulawesi_tengah.csv)",
        "short_label": "Observasi Cuaca Desa BMKG (39.932 Data)",
        "badge": "BMKG • 1.994 Desa",
        "description": "Rekapitulasi pemantauan titik cuaca spasial pada 1.994 desa/kelurahan di seluruh 13 kabupaten dan kota Provinsi Sulawesi Tengah (Format BMKG).",
        "source": "BMKG Sulawesi Tengah",
        "type": "csv",
        "sheet": "BMKG_Desa",
        "path": DATASET_CSV_PATH,
        "model_path": MODEL_PATH,
    },
    "dataset_cuaca_new.xlsx": {
        "key": "dataset_cuaca_new.xlsx",
        "label": "Dataset 2: Deret Waktu Cuaca Harian & Banjir BNPB (dataset_cuaca_new.xlsx • 31.668 Data)",
        "short_label": "Cuaca Historis ECMWF & Banjir BNPB (31.668 Data)",
        "badge": "ECMWF IFS & BNPB • 31.668 Data",
        "description": "Integrasi 31.668 rekaman cuaca harian Open-Meteo ECMWF IFS (2019-2026) dengan 541 kejadian bencana banjir historis BNPB/BPBD di 13 Kabupaten/Kota Sulawesi Tengah lengkap dengan akumulasi hujan 3 dan 7 hari sebelumnya serta elevasi grid.",
        "source": "BNPB/BPBD & Open-Meteo Historical Weather API (ECMWF IFS)",
        "type": "xlsx_historis",
        "sheet": "Cuaca_Historis & Banjir_dan_Cuaca",
        "path": DATASET_XLSX_PATH,
        "model_path": MODEL_HIST_PATH,
    },
}

WMO_WEATHER_MAP = {
    "0": "Cerah",
    "1": "Cerah Berawan",
    "2": "Berawan",
    "3": "Berawan Tebal",
    "45": "Kabut",
    "51": "Gerimis Ringan",
    "53": "Gerimis Sedang",
    "55": "Gerimis Lebat",
    "60": "Hujan Ringan",
    "61": "Hujan Ringan",
    "62": "Hujan Sedang",
    "63": "Hujan Sedang",
    "65": "Hujan Lebat",
    "80": "Hujan Lokal Ringan",
    "81": "Hujan Lokal Sedang",
    "82": "Hujan Lokal Sangat Lebat",
    "95": "Hujan Petir",
    "97": "Hujan Petir Ekstrem",
}

CANONICAL_KABUPATEN = {
    "banggai": "Kabupaten Banggai",
    "banggaikepulauan": "Kabupaten Banggai Kepulauan",
    "banggailaut": "Kabupaten Banggai Laut",
    "buol": "Kabupaten Buol",
    "donggala": "Kabupaten Donggala",
    "morowali": "Kabupaten Morowali",
    "morowaliutara": "Kabupaten Morowali Utara",
    "palu": "Kota Palu",
    "parigimoutong": "Kabupaten Parigi Moutong",
    "poso": "Kabupaten Poso",
    "sigi": "Kabupaten Sigi",
    "tojounauna": "Kabupaten Tojo Una Una",
    "tolitoli": "Kabupaten Toli-Toli",
}


def resolve_dataset_key(dataset_key=None):
    if not dataset_key:
        return "dataset_cuaca_sulawesi_tengah.csv"
    key_clean = str(dataset_key).strip().lower()
    if key_clean in (
        "dataset_cuaca_new.xlsx",
        "dataset_cuaca_new",
        "dataset_cuaca_new_historis",
        "cuaca_historis",
        "historis_full",
        "sheet2",
        "new",
        "xlsx",
        "historis",
        "banjir_dan_cuaca",
        "sheet1",
    ):
        return "dataset_cuaca_new.xlsx"
    return "dataset_cuaca_sulawesi_tengah.csv"


def _col_to_idx(col_str):
    idx = 0
    for ch in col_str:
        idx = idx * 26 + (ord(ch) - ord("A") + 1)
    return idx - 1


def read_xlsx_sheet_fallback(xlsx_path, sheet_index=1):
    """
    Reads an Excel worksheet using pandas if openpyxl is installed,
    or falls back to standard library zipfile + ElementTree XML parsing
    supporting both sharedStrings.xml and inlineStr cell formats.
    """
    try:
        return pd.read_excel(xlsx_path, sheet_name=sheet_index - 1)
    except Exception:
        with zipfile.ZipFile(xlsx_path) as z:
            ns = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            strings = []
            if "xl/sharedStrings.xml" in z.namelist():
                sst = ET.fromstring(z.read("xl/sharedStrings.xml"))
                for si in sst.findall("main:si", ns):
                    strings.append(
                        "".join(t.text or "" for t in si.findall(".//main:t", ns))
                    )
            root = ET.fromstring(z.read(f"xl/worksheets/sheet{sheet_index}.xml"))
            rows = root.findall(".//main:row", ns)
            if not rows:
                return pd.DataFrame()
            parsed = []
            max_col = 0
            for r in rows:
                row_dict = {}
                for c in r.findall("main:c", ns):
                    ref = c.attrib.get("r", "")
                    m = re.match(r"([A-Z]+)", ref)
                    c_idx = _col_to_idx(m.group(1)) if m else len(row_dict)
                    max_col = max(max_col, c_idx + 1)
                    t = c.attrib.get("t")
                    v = c.find("main:v", ns)
                    is_elem = c.find("main:is", ns)
                    if v is not None and v.text is not None:
                        val = strings[int(v.text)] if t == "s" else v.text
                    elif is_elem is not None:
                        val = "".join(
                            x.text or "" for x in is_elem.findall(".//main:t", ns)
                        )
                    else:
                        val = None
                    row_dict[c_idx] = val
                parsed.append(row_dict)
            headers = [parsed[0].get(i, f"col_{i}") for i in range(max_col)]
            data = [
                {headers[i]: r.get(i, None) for i in range(max_col)}
                for r in parsed[1:]
            ]
            return pd.DataFrame(data)


def calculate_flood_risk_score(row):
    """
    Computes a hydrometeorological flood risk score (0.0 to 1.0)
    for BMKG village weather observations.
    """
    try:
        humidity = float(row.get("kelembapan", 0))
    except (ValueError, TypeError):
        humidity = 50.0

    try:
        cloud_cover = float(row.get("tutupan_awan", 0))
    except (ValueError, TypeError):
        cloud_cover = 50.0

    try:
        wind_speed = float(row.get("kecepatan_angin", 0))
    except (ValueError, TypeError):
        wind_speed = 10.0

    try:
        temp = float(row.get("suhu", 25))
    except (ValueError, TypeError):
        temp = 25.0

    weather_desc = str(row.get("deskripsi_cuaca", "")).lower()
    weather_code = str(row.get("kode_cuaca", ""))

    rain_score = 0.0
    if "hujan" in weather_desc or weather_code in [
        "60",
        "61",
        "62",
        "63",
        "65",
        "80",
        "81",
        "82",
        "95",
        "97",
    ]:
        rain_score = 0.45
    elif "gerimis" in weather_desc or weather_code in ["51", "53", "55"]:
        rain_score = 0.30
    elif "berawan" in weather_desc:
        rain_score = 0.20
    elif "kabut" in weather_desc or "asap" in weather_desc:
        rain_score = 0.15
    else:
        rain_score = 0.05

    humidity_score = max(0.0, (humidity - 50.0) / 50.0) * 0.30
    cloud_score = (cloud_cover / 100.0) * 0.15
    wind_temp_score = min(
        0.10,
        (wind_speed / 40.0) * 0.05 + (30.0 - temp if temp < 30 else 0) * 0.005,
    )

    total_score = min(
        1.0, rain_score + humidity_score + cloud_score + wind_temp_score
    )
    return total_score


def calculate_historical_flood_risk_score(row):
    """
    Computes flood severity and hydrometeorological risk score (0.0 to 1.0)
    using the Open-Meteo ECMWF IFS + BNPB parameters in dataset_cuaca_new.xlsx:
    curah_hujan_mm, presipitasi_total_mm, hujan_3hari_sebelumnya_mm,
    hujan_7hari_sebelumnya_mm, durasi_hujan_jam, kelembapan_rata2_pct,
    tutupan_awan_rata2_pct, and disaster impact (Rumah Terendam / Rumah Rusak).
    """
    rain = float(row.get("curah_hujan", 0.0) or 0.0)
    precip = float(row.get("presipitasi", rain) or rain)
    rain_eff = max(rain, precip)
    rain3 = float(row.get("hujan_3hari", 0.0) or 0.0)
    rain7 = float(row.get("hujan_7hari", 0.0) or 0.0)
    dur = float(row.get("durasi_hujan", 0.0) or 0.0)
    hum = float(row.get("kelembapan", 75.0) or 75.0)
    cloud = float(row.get("tutupan_awan", 50.0) or 50.0)
    rumah = (
        float(row.get("rumah_terendam", 0.0) or 0.0)
        + float(row.get("rumah_rusak", 0.0) or 0.0) * 2.0
        + float(row.get("fasum_rusak", 0.0) or 0.0) * 5.0
    )

    s_rain = min(0.32, (rain_eff / 28.0) * 0.32)
    s_rain_ant = min(0.22, (rain3 / 55.0) * 0.14 + (rain7 / 110.0) * 0.08)
    s_dur = min(0.14, (dur / 18.0) * 0.14)
    s_hum = max(0.0, (hum - 60.0) / 40.0) * 0.15
    s_cloud = (cloud / 100.0) * 0.05
    s_impact = min(0.12, (rumah / 180.0) * 0.12)

    return round(
        min(1.0, s_rain + s_rain_ant + s_dur + s_hum + s_cloud + s_impact), 4
    )


def categorize_risk(score):
    """
    Categorizes numerical score into 3 Risk Classes:
    - Rendah (< 0.40)
    - Sedang (0.40 - 0.65)
    - Tinggi (>= 0.65)
    """
    if score >= 0.65:
        return "Tinggi"
    elif score >= 0.40:
        return "Sedang"
    else:
        return "Rendah"


def _norm_alnum(val):
    return re.sub(r"[^a-z0-9]", "", str(val or "").lower())


def _normalize_kabupaten_name(raw_kab):
    cleaned = _norm_alnum(raw_kab).replace("kabupaten", "").replace("kota", "")
    return CANONICAL_KABUPATEN.get(
        cleaned, str(raw_kab or "Wilayah Sulawesi Tengah").strip()
    )


def _parse_lokasi_text(loc_str):
    if not loc_str:
        return "", ""
    s = str(loc_str).replace("\\n", " ").replace("\n", " ").replace("\r", " ")
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"^Kecamatan\s*:\s*", "", s, flags=re.I).strip()
    if not s:
        return "", ""

    m_kec = re.search(
        r"Kec\.?\s*([A-Za-z0-9\s\-]+?)(?=\s+(?:Ds\.|Desa\s|Kel\.|Kelurahan\s|Kec\.)|$)",
        s,
        re.I,
    )
    m_ds = re.search(
        r"(?:Ds\.|Desa\s|Kel\.|Kelurahan\s)\s*([A-Za-z0-9\s\-]+?)(?=\s+(?:Ds\.|Desa\s|Kel\.|Kelurahan\s|Kec\.)|$)",
        s,
        re.I,
    )
    kec = m_kec.group(1).strip(" -.,") if m_kec else ""
    desa = m_ds.group(1).strip(" -.,") if m_ds else ""
    return kec, desa


def _load_village_reference():
    if not os.path.exists(DATASET_CSV_PATH):
        return pd.DataFrame()
    df_ref = pd.read_csv(
        DATASET_CSV_PATH,
        usecols=[
            "kabupaten_kota",
            "kecamatan",
            "desa_kelurahan",
            "latitude",
            "longitude",
        ],
    ).drop_duplicates()
    df_ref["latitude"] = pd.to_numeric(df_ref["latitude"], errors="coerce")
    df_ref["longitude"] = pd.to_numeric(df_ref["longitude"], errors="coerce")
    df_ref = df_ref.dropna(subset=["latitude", "longitude"]).copy()
    df_ref["kab_norm"] = df_ref["kabupaten_kota"].apply(_normalize_kabupaten_name)
    df_ref["kec_norm"] = df_ref["kecamatan"].apply(_norm_alnum)
    df_ref["desa_norm"] = df_ref["desa_kelurahan"].apply(_norm_alnum)
    return df_ref


def _load_kabupaten_coords_sheet():
    if not os.path.exists(DATASET_XLSX_PATH):
        return {}
    try:
        df3 = read_xlsx_sheet_fallback(DATASET_XLSX_PATH, sheet_index=3)
        coords = {}
        for _, r in df3.iterrows():
            kn = _normalize_kabupaten_name(r.get("kab_key", ""))
            coords[kn] = {
                "latitude": _safe_float(r.get("latitude"), -1.43),
                "longitude": _safe_float(r.get("longitude"), 121.44),
                "jumlah_desa": int(_safe_float(r.get("jumlah_desa"), 0)),
            }
        return coords
    except Exception:
        return {}


def _safe_float(val, default=0.0):
    v = pd.to_numeric(val, errors="coerce")
    if pd.isna(v):
        return float(default)
    return float(v)


def _convert_excel_date(raw_val):
    excel_num = pd.to_numeric(raw_val, errors="coerce")
    if pd.notna(excel_num) and excel_num > 10000:
        dt_obj = pd.to_datetime(float(excel_num), unit="D", origin="1899-12-30")
        return dt_obj.strftime("%Y-%m-%d"), int(dt_obj.month), int(dt_obj.day)
    s = str(raw_val or "2024-01-01").strip()
    try:
        dt_obj = pd.to_datetime(s)
        return dt_obj.strftime("%Y-%m-%d"), int(dt_obj.month), int(dt_obj.day)
    except Exception:
        return s, 1, 1


def _preprocess_xlsx_banjir_sheet():
    print("Loading Sheet 1 (Banjir_dan_Cuaca) from:", DATASET_XLSX_PATH)
    raw_df = read_xlsx_sheet_fallback(DATASET_XLSX_PATH, sheet_index=1)
    ref_villages = _load_village_reference()
    kab_coords_ref = _load_kabupaten_coords_sheet()

    records = []
    used_coords = set()

    for idx, row in raw_df.iterrows():
        kab_canonical = _normalize_kabupaten_name(row.get("Kabupaten", ""))
        kec_parsed, desa_parsed = _parse_lokasi_text(row.get("Lokasi", ""))

        lat = pd.to_numeric(row.get("latitude_grid"), errors="coerce")
        lon = pd.to_numeric(row.get("longitude_grid"), errors="coerce")
        matched_kec = kec_parsed
        matched_desa = desa_parsed

        if not ref_villages.empty:
            sub_kab = ref_villages[ref_villages["kab_norm"] == kab_canonical]
            chosen_row = None

            desa_n = _norm_alnum(desa_parsed)
            kec_n = _norm_alnum(kec_parsed)

            if desa_n and not sub_kab.empty:
                m_desa = sub_kab[sub_kab["desa_norm"] == desa_n]
                if not m_desa.empty:
                    chosen_row = m_desa.iloc[idx % len(m_desa)]

            if chosen_row is None and kec_n and not sub_kab.empty:
                m_kec = sub_kab[
                    (sub_kab["kec_norm"] == kec_n)
                    | sub_kab["kec_norm"].str.contains(kec_n, na=False)
                ]
                if not m_kec.empty:
                    chosen_row = m_kec.iloc[idx % len(m_kec)]

            if chosen_row is None and not sub_kab.empty:
                chosen_row = sub_kab.iloc[idx % len(sub_kab)]

            if chosen_row is not None:
                lat = float(chosen_row["latitude"])
                lon = float(chosen_row["longitude"])
                if not matched_kec:
                    matched_kec = str(chosen_row["kecamatan"])
                if not matched_desa:
                    matched_desa = str(chosen_row["desa_kelurahan"])

        if pd.isna(lat) or pd.isna(lon):
            kc = kab_coords_ref.get(kab_canonical, {})
            lat = kc.get("latitude", -1.43)
            lon = kc.get("longitude", 121.44)

        coord_key = (round(float(lat), 5), round(float(lon), 5))
        step = 1
        while coord_key in used_coords:
            angle = step * 1.15
            radius = 0.0018 * ((step // 6) + 1)
            lat_candidate = float(lat) + np.sin(angle) * radius
            lon_candidate = float(lon) + np.cos(angle) * radius
            coord_key = (round(lat_candidate, 5), round(lon_candidate, 5))
            step += 1
        lat, lon = coord_key
        used_coords.add(coord_key)

        date_str, bulan_val, hari_val = _convert_excel_date(
            row.get("Tanggal Kejadian") or row.get("tanggal")
        )

        kode_raw = str(row.get("kode_cuaca") or "61").split(".")[0].strip()
        kode_num = _safe_float(kode_raw, 61.0)
        deskripsi = WMO_WEATHER_MAP.get(kode_raw, "Hujan Sedang")

        suhu = round(_safe_float(row.get("suhu_rata2_c"), 26.5), 1)
        suhu_maks = round(_safe_float(row.get("suhu_maks_c"), suhu + 2.5), 1)
        suhu_min = round(_safe_float(row.get("suhu_min_c"), suhu - 2.0), 1)
        kelembapan = round(_safe_float(row.get("kelembapan_rata2_pct"), 85.0), 1)
        tutupan_awan = round(_safe_float(row.get("tutupan_awan_rata2_pct"), 80.0), 1)
        kecepatan_angin = round(
            _safe_float(row.get("kecepatan_angin_rata2_kmh"), 8.0), 1
        )
        angin_maks = round(
            _safe_float(row.get("kecepatan_angin_maks_kmh"), kecepatan_angin + 5.0), 1
        )
        curah_hujan = round(_safe_float(row.get("curah_hujan_mm"), 0.0), 1)
        presipitasi = round(
            _safe_float(row.get("presipitasi_total_mm"), curah_hujan), 1
        )
        durasi_hujan = round(_safe_float(row.get("durasi_hujan_jam"), 8.0), 1)
        hujan_3hari = round(
            _safe_float(row.get("hujan_3hari_sebelumnya_mm"), 0.0), 1
        )
        hujan_7hari = round(
            _safe_float(row.get("hujan_7hari_sebelumnya_mm"), 0.0), 1
        )
        elevasi = round(_safe_float(row.get("elevation_grid"), 0.0), 1)

        rumah_terendam = int(_safe_float(row.get("Rumah Terendam"), 0.0))
        rumah_rusak = int(_safe_float(row.get("Rumah Rusak"), 0.0))
        fasum_rusak = int(_safe_float(row.get("Fasum Rusak"), 0.0))
        meninggal = int(_safe_float(row.get("Meninggal"), 0.0))
        hilang = int(_safe_float(row.get("Hilang"), 0.0))
        terluka = int(_safe_float(row.get("Terluka"), 0.0))

        penyebab_raw = str(row.get("Penyebab") or "").strip()
        if not penyebab_raw or penyebab_raw.lower() == "none":
            penyebab_raw = "Curah hujan intensitas tinggi dan luapan drainase/sungai"

        id_kab = str(row.get("ID Kabupaten") or "7200").strip()
        kode_bencana = str(
            row.get("Kode Identitas Bencana") or f"BNPB-{id_kab}-{idx + 1}"
        ).strip()

        records.append({
            "adm4": kode_bencana,
            "id_kabupaten": id_kab,
            "kabupaten_kota": kab_canonical,
            "kecamatan": matched_kec or "Wilayah Kabupaten",
            "desa_kelurahan": matched_desa or "Lokasi Banjir Historis",
            "latitude": lat,
            "longitude": lon,
            "elevasi": elevasi,
            "suhu": suhu,
            "suhu_maks": suhu_maks,
            "suhu_min": suhu_min,
            "kelembapan": kelembapan,
            "tutupan_awan": tutupan_awan,
            "kecepatan_angin": kecepatan_angin,
            "angin_maks": angin_maks,
            "kode_cuaca": kode_num,
            "deskripsi_cuaca": deskripsi,
            "curah_hujan": curah_hujan,
            "presipitasi": presipitasi,
            "durasi_hujan": durasi_hujan,
            "hujan_3hari": hujan_3hari,
            "hujan_7hari": hujan_7hari,
            "rumah_terendam": rumah_terendam,
            "rumah_rusak": rumah_rusak,
            "fasum_rusak": fasum_rusak,
            "meninggal": meninggal,
            "hilang": hilang,
            "terluka": terluka,
            "penyebab": penyebab_raw,
            "sumber_data": str(
                row.get("sumber_data_cuaca") or "Open-Meteo Historical Weather API"
            ),
            "model_cuaca": str(row.get("model_data_cuaca") or "ECMWF IFS"),
            "status_pencocokan": str(row.get("status_pencocokan") or "Berhasil"),
            "local_datetime": date_str,
            "jam": min(23, max(0, int(durasi_hujan))),
            "bulan": bulan_val,
            "hari": hari_val,
        })

    df = pd.DataFrame(records)
    df["risk_score"] = df.apply(calculate_historical_flood_risk_score, axis=1)
    df["kategori_risiko"] = df["risk_score"].apply(categorize_risk)
    return df


def _preprocess_xlsx_historis_sheet():
    print("Loading Sheet 2 (Cuaca_Historis) from:", DATASET_XLSX_PATH)
    raw_df = read_xlsx_sheet_fallback(DATASET_XLSX_PATH, sheet_index=2)
    df_banjir = read_xlsx_sheet_fallback(DATASET_XLSX_PATH, sheet_index=1)
    ref_villages = _load_village_reference()

    # Build lookup of flood events by (kabupaten_kota, tanggal_serial)
    flood_lookup = {}
    for _, b_row in df_banjir.iterrows():
        kn = _normalize_kabupaten_name(b_row.get("Kabupaten", ""))
        t_str = str(b_row.get("tanggal") or b_row.get("Tanggal Kejadian") or "").strip()
        if kn and t_str:
            prev = flood_lookup.get((kn, t_str), {"terendam": 0, "rusak": 0, "fasum": 0, "lokasi": ""})
            flood_lookup[(kn, t_str)] = {
                "terendam": prev["terendam"] + int(_safe_float(b_row.get("Rumah Terendam"), 0)),
                "rusak": prev["rusak"] + int(_safe_float(b_row.get("Rumah Rusak"), 0)),
                "fasum": prev["fasum"] + int(_safe_float(b_row.get("Fasum Rusak"), 0)),
                "lokasi": b_row.get("Lokasi") or prev["lokasi"],
            }

    # Pre-group villages per Kabupaten for spatial distribution
    kab_villages = {}
    if not ref_villages.empty:
        for kn, grp in ref_villages.groupby("kab_norm"):
            kab_villages[kn] = grp.to_dict(orient="records")

    df = pd.DataFrame()
    df["kabupaten_kota"] = raw_df["kab_key"].apply(_normalize_kabupaten_name)

    excel_nums = pd.to_numeric(raw_df["tanggal"], errors="coerce").fillna(43825)
    dt_series = pd.to_datetime(excel_nums, unit="D", origin="1899-12-30")
    df["local_datetime"] = dt_series.dt.strftime("%Y-%m-%d")
    df["bulan"] = dt_series.dt.month.astype(int)
    df["hari"] = dt_series.dt.day.astype(int)

    df["suhu"] = pd.to_numeric(raw_df["suhu_rata2_c"], errors="coerce").fillna(26.5).round(1)
    df["suhu_maks"] = pd.to_numeric(raw_df["suhu_maks_c"], errors="coerce").fillna(df["suhu"] + 2.5).round(1)
    df["suhu_min"] = pd.to_numeric(raw_df["suhu_min_c"], errors="coerce").fillna(df["suhu"] - 2.0).round(1)
    df["kelembapan"] = pd.to_numeric(raw_df["kelembapan_rata2_pct"], errors="coerce").fillna(82.0).round(1)
    df["presipitasi"] = pd.to_numeric(raw_df["presipitasi_total_mm"], errors="coerce").fillna(0.0).round(1)
    df["curah_hujan"] = pd.to_numeric(raw_df["curah_hujan_mm"], errors="coerce").fillna(0.0).round(1)
    df["durasi_hujan"] = pd.to_numeric(raw_df["durasi_hujan_jam"], errors="coerce").fillna(0.0).round(1)
    df["kecepatan_angin"] = pd.to_numeric(raw_df["kecepatan_angin_rata2_kmh"], errors="coerce").fillna(6.0).round(1)
    df["angin_maks"] = pd.to_numeric(raw_df["kecepatan_angin_maks_kmh"], errors="coerce").fillna(12.0).round(1)
    df["tutupan_awan"] = pd.to_numeric(raw_df["tutupan_awan_rata2_pct"], errors="coerce").fillna(70.0).round(1)

    kode_str = raw_df["kode_cuaca"].astype(str).str.split(".").str[0].str.strip()
    df["kode_cuaca"] = pd.to_numeric(kode_str, errors="coerce").fillna(51.0)
    df["deskripsi_cuaca"] = kode_str.map(lambda x: WMO_WEATHER_MAP.get(x, "Berawan"))

    df["elevasi"] = pd.to_numeric(raw_df["elevation_grid"], errors="coerce").fillna(0.0).round(1)
    df["hujan_3hari"] = pd.to_numeric(raw_df["hujan_3hari_sebelumnya_mm"], errors="coerce").fillna(0.0).round(1)
    df["hujan_7hari"] = pd.to_numeric(raw_df["hujan_7hari_sebelumnya_mm"], errors="coerce").fillna(0.0).round(1)
    df["jam"] = df["durasi_hujan"].clip(0, 23).astype(int)

    # Assign village coordinates & flood impact where matched
    lats = pd.to_numeric(raw_df["latitude_grid"], errors="coerce").fillna(-1.43).tolist()
    lons = pd.to_numeric(raw_df["longitude_grid"], errors="coerce").fillna(121.44).tolist()
    kecs = []
    desas = []
    terendam_list = []
    rusak_list = []
    fasum_list = []
    penyebab_list = []

    raw_tanggal_str = raw_df["tanggal"].astype(str).str.strip().tolist()
    kabs_list = df["kabupaten_kota"].tolist()

    for i, (kn, t_s) in enumerate(zip(kabs_list, raw_tanggal_str)):
        v_list = kab_villages.get(kn, [])
        if v_list:
            v_item = v_list[i % len(v_list)]
            lats[i] = float(v_item["latitude"])
            lons[i] = float(v_item["longitude"])
            kecs.append(str(v_item["kecamatan"]))
            desas.append(str(v_item["desa_kelurahan"]))
        else:
            kecs.append("Grid Historis ECMWF")
            desas.append(kn)

        fl = flood_lookup.get((kn, t_s))
        if fl:
            terendam_list.append(fl["terendam"])
            rusak_list.append(fl["rusak"])
            fasum_list.append(fl["fasum"])
            penyebab_list.append("Kejadian Banjir Tercatat BNPB")
        else:
            terendam_list.append(0)
            rusak_list.append(0)
            fasum_list.append(0)
            penyebab_list.append("Observasi Harian ECMWF IFS")

    df["latitude"] = lats
    df["longitude"] = lons
    df["kecamatan"] = kecs
    df["desa_kelurahan"] = desas
    df["rumah_terendam"] = terendam_list
    df["rumah_rusak"] = rusak_list
    df["fasum_rusak"] = fasum_list
    df["meninggal"] = 0
    df["hilang"] = 0
    df["terluka"] = 0
    df["penyebab"] = penyebab_list
    df["id_kabupaten"] = raw_df["kab_key"].astype(str)
    df["adm4"] = [f"HIST-{i + 1}" for i in range(len(df))]
    df["sumber_data"] = "Open-Meteo Historical Weather API"
    df["model_cuaca"] = "ECMWF IFS"
    df["status_pencocokan"] = np.where(df["rumah_terendam"] > 0, "Banjir BNPB", "Historis Harian")

    # Vectorized risk score computation for 31,668 rows
    rain_eff = np.maximum(df["curah_hujan"], df["presipitasi"])
    s_rain = np.minimum(0.32, (rain_eff / 28.0) * 0.32)
    s_rain_ant = np.minimum(0.22, (df["hujan_3hari"] / 55.0) * 0.14 + (df["hujan_7hari"] / 110.0) * 0.08)
    s_dur = np.minimum(0.14, (df["durasi_hujan"] / 18.0) * 0.14)
    s_hum = np.maximum(0.0, (df["kelembapan"] - 60.0) / 40.0) * 0.15
    s_cloud = (df["tutupan_awan"] / 100.0) * 0.05
    rumah_weighted = df["rumah_terendam"] + df["rumah_rusak"] * 2.0 + df["fasum_rusak"] * 5.0
    s_impact = np.minimum(0.12, (rumah_weighted / 180.0) * 0.12)

    df["risk_score"] = np.minimum(1.0, s_rain + s_rain_ant + s_dur + s_hum + s_cloud + s_impact).round(4)
    df["kategori_risiko"] = df["risk_score"].apply(categorize_risk)
    return df


def load_and_preprocess_data(dataset_key="dataset_cuaca_sulawesi_tengah.csv"):
    resolved_key = resolve_dataset_key(dataset_key)
    if resolved_key == "dataset_cuaca_new.xlsx":
        return _preprocess_xlsx_historis_sheet()

    print("Loading CSV dataset from:", DATASET_CSV_PATH)
    df = pd.read_csv(DATASET_CSV_PATH)

    numeric_cols = [
        "suhu",
        "kelembapan",
        "kode_cuaca",
        "kecepatan_angin",
        "tutupan_awan",
        "latitude",
        "longitude",
        "jam",
        "bulan",
        "hari",
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["suhu", "kelembapan", "latitude", "longitude"]).copy()

    df["suhu_maks"] = (df["suhu"] + 2.0).round(1)
    df["suhu_min"] = (df["suhu"] - 2.0).round(1)
    df["angin_maks"] = (df["kecepatan_angin"] * 1.35).round(1)
    df["elevasi"] = 0.0
    df["curah_hujan"] = 0.0
    df["presipitasi"] = 0.0
    df["durasi_hujan"] = 0.0
    df["hujan_3hari"] = 0.0
    df["hujan_7hari"] = 0.0
    df["rumah_terendam"] = 0
    df["rumah_rusak"] = 0
    df["fasum_rusak"] = 0
    df["meninggal"] = 0
    df["hilang"] = 0
    df["terluka"] = 0
    df["id_kabupaten"] = df["adm4"].astype(str).str[:5]
    df["penyebab"] = "Observasi Prakiraan Cuaca Desa BMKG"
    df["sumber_data"] = "BMKG Sulawesi Tengah"
    df["model_cuaca"] = "BMKG Digital Forecast"
    df["status_pencocokan"] = "Aktif"

    print("Calculating Flood Risk Scores & Categories...")
    df["risk_score"] = df.apply(calculate_flood_risk_score, axis=1)
    df["kategori_risiko"] = df["risk_score"].apply(categorize_risk)

    return df


def train_and_save_model(dataset_key="dataset_cuaca_sulawesi_tengah.csv"):
    resolved_key = resolve_dataset_key(dataset_key)
    meta = DATASETS_META[resolved_key]
    df = load_and_preprocess_data(resolved_key)

    if resolved_key in ("dataset_cuaca_new.xlsx", "dataset_cuaca_new_historis"):
        features = [
            "curah_hujan",
            "presipitasi",
            "durasi_hujan",
            "hujan_3hari",
            "hujan_7hari",
            "suhu",
            "kelembapan",
            "tutupan_awan",
            "kecepatan_angin",
            "angin_maks",
            "elevasi",
            "kode_cuaca",
        ]
    else:
        features = [
            "suhu",
            "kelembapan",
            "kode_cuaca",
            "kecepatan_angin",
            "tutupan_awan",
            "latitude",
            "longitude",
            "jam",
            "bulan",
        ]

    X = df[features].fillna(df[features].median())
    y = df["kategori_risiko"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(
        f"Training Random Forest Classifier ({resolved_key}) on {len(X_train)} samples..."
    )
    clf = RandomForestClassifier(
        n_estimators=120, max_depth=15, random_state=42, n_jobs=-1
    )
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred)
    cm = confusion_matrix(
        y_test, y_pred, labels=["Rendah", "Sedang", "Tinggi"]
    ).tolist()

    print(f"Model Accuracy ({resolved_key}): {acc * 100:.2f}%")

    importances = dict(zip(features, clf.feature_importances_.round(4)))

    model_artifact = {
        "dataset_key": resolved_key,
        "model": clf,
        "features": features,
        "accuracy": float(acc),
        "classification_report": report,
        "confusion_matrix": cm,
        "feature_importances": importances,
        "classes": ["Rendah", "Sedang", "Tinggi"],
    }

    joblib.dump(model_artifact, meta["model_path"])
    print("Saved trained model artifact to:", meta["model_path"])
    return df, model_artifact


if __name__ == "__main__":
    train_and_save_model("dataset_cuaca_sulawesi_tengah.csv")
    train_and_save_model("dataset_cuaca_new.xlsx")
