import os
import json
import joblib
import pandas as pd
import numpy as np
from flask import Flask, render_template, jsonify, request, Response, send_file

from train_model import load_and_preprocess_data, MODEL_PATH
from geo_utils import get_sulteng_geojson_dict, convert_weather_df_to_gdf

app = Flask(__name__, static_folder='static', template_folder='templates')

# Cache loaded data and model in app scope
DATA = None
MODEL_ARTIFACT = None

def get_data_and_model():
    global DATA, MODEL_ARTIFACT
    if DATA is None:
        DATA = load_and_preprocess_data()
    if MODEL_ARTIFACT is None:
        if os.path.exists(MODEL_PATH):
            MODEL_ARTIFACT = joblib.load(MODEL_PATH)
        else:
            from train_model import train_and_save_model
            DATA, MODEL_ARTIFACT = train_and_save_model()
    return DATA, MODEL_ARTIFACT

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/summary')
def api_summary():
    df, _ = get_data_and_model()
    
    kabupaten_param = request.args.get('kabupaten', 'all')
    risk_param = request.args.get('risk', 'all')

    filtered_df = df.copy()
    if kabupaten_param != 'all':
        filtered_df = filtered_df[filtered_df['kabupaten_kota'] == kabupaten_param]
    if risk_param != 'all':
        filtered_df = filtered_df[filtered_df['kategori_risiko'] == risk_param]

    total_records = len(filtered_df)
    high_count = int((filtered_df['kategori_risiko'] == 'Tinggi').sum())
    med_count = int((filtered_df['kategori_risiko'] == 'Sedang').sum())
    low_count = int((filtered_df['kategori_risiko'] == 'Rendah').sum())

    kab_list = sorted(df['kabupaten_kota'].dropna().unique().tolist())

    return jsonify({
        'total_records': total_records,
        'high_count': high_count,
        'med_count': med_count,
        'low_count': low_count,
        'high_pct': round((high_count / max(1, total_records)) * 100, 1),
        'med_pct': round((med_count / max(1, total_records)) * 100, 1),
        'low_pct': round((low_count / max(1, total_records)) * 100, 1),
        'kabupaten_options': kab_list
    })

@app.route('/api/geojson/boundary')
def api_geojson_boundary():
    df, _ = get_data_and_model()
    geojson_dict = get_sulteng_geojson_dict(df)
    return jsonify(geojson_dict)

@app.route('/api/weather-points')
def api_weather_points():
    df, _ = get_data_and_model()

    kabupaten_param = request.args.get('kabupaten', 'all')
    risk_param = request.args.get('risk', 'all')
    limit = int(request.args.get('limit', 1200))

    filtered_df = df.dropna(subset=['latitude', 'longitude']).copy()
    if kabupaten_param != 'all':
        filtered_df = filtered_df[filtered_df['kabupaten_kota'] == kabupaten_param]
    if risk_param != 'all':
        filtered_df = filtered_df[filtered_df['kategori_risiko'] == risk_param]

    sample_df = filtered_df.head(limit)

    points = []
    for idx, row in sample_df.iterrows():
        points.append({
            'id': str(row.get('adm4', idx)),
            'kabupaten': str(row.get('kabupaten_kota', '')),
            'kecamatan': str(row.get('kecamatan', '')),
            'desa': str(row.get('desa_kelurahan', '')),
            'latitude': float(row.get('latitude', 0.0)),
            'longitude': float(row.get('longitude', 0.0)),
            'suhu': float(row.get('suhu', 0.0)),
            'kelembapan': float(row.get('kelembapan', 0.0)),
            'tutupan_awan': float(row.get('tutupan_awan', 0.0)),
            'kecepatan_angin': float(row.get('kecepatan_angin', 0.0)),
            'cuaca': str(row.get('deskripsi_cuaca', '')),
            'kategori_risiko': str(row.get('kategori_risiko', 'Rendah')),
            'risk_score': round(float(row.get('risk_score', 0.0)), 4)
        })

    return jsonify({'points': points, 'total_shown': len(points)})

@app.route('/api/predict', methods=['POST'])
def api_predict():
    _, artifact = get_data_and_model()
    clf = artifact['model']
    features = artifact['features']

    data = request.json or {}
    try:
        suhu = float(data.get('suhu', 27.0))
        kelembapan = float(data.get('kelembapan', 80.0))
        kode_cuaca = float(data.get('kode_cuaca', 1.0))
        kecepatan_angin = float(data.get('kecepatan_angin', 10.0))
        tutupan_awan = float(data.get('tutupan_awan', 50.0))
        latitude = float(data.get('latitude', -1.43))
        longitude = float(data.get('longitude', 121.44))
        jam = float(data.get('jam', 12.0))
        bulan = float(data.get('bulan', 8.0))
    except (ValueError, TypeError) as e:
        return jsonify({'error': f'Invalid parameter formats: {e}'}), 400

    input_df = pd.DataFrame([{
        'suhu': suhu,
        'kelembapan': kelembapan,
        'kode_cuaca': kode_cuaca,
        'kecepatan_angin': kecepatan_angin,
        'tutupan_awan': tutupan_awan,
        'latitude': latitude,
        'longitude': longitude,
        'jam': jam,
        'bulan': bulan
    }])[features]

    prediction = clf.predict(input_df)[0]
    probs = clf.predict_proba(input_df)[0]
    classes = clf.classes_
    prob_map = {cls: round(float(p) * 100, 1) for cls, p in zip(classes, probs)}

    return jsonify({
        'prediction': str(prediction),
        'probabilities': prob_map,
        'features_used': input_df.to_dict(orient='records')[0]
    })

@app.route('/api/analytics')
def api_analytics():
    df, artifact = get_data_and_model()

    # Kabupaten Risk Breakdown
    kab_grouped = df.groupby(['kabupaten_kota', 'kategori_risiko']).size().unstack(fill_value=0)
    kab_categories = kab_grouped.index.tolist()
    
    kab_data = {
        'categories': kab_categories,
        'tinggi': kab_grouped.get('Tinggi', pd.Series(0, index=kab_grouped.index)).tolist(),
        'sedang': kab_grouped.get('Sedang', pd.Series(0, index=kab_grouped.index)).tolist(),
        'rendah': kab_grouped.get('Rendah', pd.Series(0, index=kab_grouped.index)).tolist()
    }

    # Weather Description Distribution
    weather_counts = df['deskripsi_cuaca'].value_counts().to_dict()

    # Feature importances
    fi = artifact.get('feature_importances', {})

    return jsonify({
        'kabupaten_risk': kab_data,
        'weather_distribution': weather_counts,
        'feature_importances': fi,
        'accuracy': round(artifact.get('accuracy', 0.0) * 100, 2)
    })

@app.route('/api/table-data')
def api_table_data():
    df, _ = get_data_and_model()

    search = request.args.get('search', '').lower()
    kabupaten = request.args.get('kabupaten', 'all')
    risk = request.args.get('risk', 'all')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))

    filtered_df = df.copy()
    if kabupaten != 'all':
        filtered_df = filtered_df[filtered_df['kabupaten_kota'] == kabupaten]
    if risk != 'all':
        filtered_df = filtered_df[filtered_df['kategori_risiko'] == risk]

    if search:
        mask = (
            filtered_df['kabupaten_kota'].astype(str).str.lower().str.contains(search) |
            filtered_df['kecamatan'].astype(str).str.lower().str.contains(search) |
            filtered_df['desa_kelurahan'].astype(str).str.lower().str.contains(search) |
            filtered_df['deskripsi_cuaca'].astype(str).str.lower().str.contains(search)
        )
        filtered_df = filtered_df[mask]

    total_filtered = len(filtered_df)
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page

    paged_df = filtered_df.iloc[start_idx:end_idx]

    rows = paged_df[['kabupaten_kota', 'kecamatan', 'desa_kelurahan', 'suhu', 'kelembapan', 'tutupan_awan', 'kecepatan_angin', 'deskripsi_cuaca', 'kategori_risiko', 'risk_score', 'local_datetime']].to_dict(orient='records')

    return jsonify({
        'total': total_filtered,
        'page': page,
        'per_page': per_page,
        'total_pages': int(np.ceil(total_filtered / per_page)) if total_filtered > 0 else 1,
        'rows': rows
    })

@app.route('/api/export-csv')
def api_export_csv():
    df, _ = get_data_and_model()
    csv_str = df.to_csv(index=False)
    return Response(
        csv_str,
        mimetype="text/csv",
        headers={"Content-disposition": "attachment; filename=prediksi_banjir_sulawesi_tengah.csv"}
    )

if __name__ == '__main__':
    # Initialize data on startup
    get_data_and_model()
    print("Starting Flask web server on http://localhost:5050...")
    app.run(host='0.0.0.0', port=5050, debug=False)
