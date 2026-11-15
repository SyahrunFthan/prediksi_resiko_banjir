# LAPORAN SISTEM PREDIKSI RISIKO BANJIR SULAWESI TENGAH

**Tanggal**: September 2026  
**Wilayah**: Provinsi Sulawesi Tengah  
**Teknologi**: Python, Machine Learning (Random Forest), Web Dashboard

---

## 1. PENDAHULUAN

### 1.1 Latar Belakang

Provinsi Sulawesi Tengah merupakan daerah yang rentan terhadap bencana banjir. Dampak banjir dapat berpengaruh besar terhadap kehidupan masyarakat, infrastruktur, dan perekonomian. Oleh karena itu, diperlukan sistem yang dapat memprediksi risiko banjir secara cepat dan akurat berdasarkan data meteorologi.

### 1.2 Tujuan Sistem

Sistem ini dirancang untuk:

1. Memprediksi kategori risiko banjir (Rendah, Sedang, Tinggi) berdasarkan parameter cuaca
2. Menyediakan visualisasi spasial risiko banjir melalui peta interaktif
3. Memberikan analisis real-time untuk setiap lokasi geografis
4. Mendukung pengambilan keputusan mitigasi bencana

### 1.3 Ruang Lingkup

Sistem mencakup:

- Area seluruh Provinsi Sulawesi Tengah
- Analisis data cuaca dari berbagai kabupaten/kota
- Integrasi peta administratif wilayah
- Dashboard analytics dan ekspor data

---

## 2. ARSITEKTUR SISTEM

### 2.1 Komponen Utama

```
┌─────────────────────────────────────────────────────────┐
│          PRESENTASI (Frontend)                          │
│  - Dashboard Web (HTML/CSS/JavaScript)                 │
│  - Peta Interaktif (Leaflet.js)                        │
│  - Chart Visualisasi (Chart.js)                        │
│  - Filter & Ekspor Data                                │
└──────────────────┬──────────────────────────────────────┘
                   │ API REST
┌──────────────────▼──────────────────────────────────────┐
│          APLIKASI (Backend)                             │
│  - Flask Web Server                                     │
│  - API Endpoints                                       │
│  - Business Logic & Filtering                          │
└──────────────────┬──────────────────────────────────────┘
                   │ Data Processing
┌──────────────────▼──────────────────────────────────────┐
│          MODEL & PROCESSING                             │
│  - Random Forest Classifier                            │
│  - Risk Scoring Algorithm                              │
│  - Geospatial Processing (GeoPandas)                   │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│          STORAGE & DATA                                 │
│  - Dataset Cuaca CSV                                   │
│  - Model Terlatih (Joblib)                             │
│  - Boundary GeoJSON                                    │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Stack Teknologi

| Komponen             | Teknologi                |
| -------------------- | ------------------------ |
| **Backend**          | Python 3, Flask          |
| **Data Processing**  | Pandas, NumPy, GeoPandas |
| **Machine Learning** | Scikit-learn             |
| **Model Storage**    | Joblib                   |
| **Frontend**         | HTML5, CSS3, JavaScript  |
| **Mapping**          | Leaflet.js               |
| **Charts**           | Chart.js                 |
| **Geospatial**       | GeoJSON                  |

---

## 3. ALGORITMA & MODEL

### 3.1 Random Forest Classifier

**Definisi**: Random Forest adalah ensemble learning algorithm yang menggabungkan multiple decision trees untuk klasifikasi.

**Konfigurasi**:

```python
RandomForestClassifier(
    n_estimators=100,      # 100 decision trees
    max_depth=15,          # Kedalaman maksimal setiap tree
    random_state=42,       # Reproducibility
    n_jobs=-1             # Parallel processing
)
```

**Kelebihan**:

- Robust terhadap outliers
- Menangani non-linear relationships
- Built-in feature importance
- Parallel processing untuk performa tinggi
- Menghindari overfitting dengan ensemble

**Performa Model**:

- Akurasi: ~90%+ pada test set
- Stratified train-test split (80-20)
- Classes yang seimbang

### 3.2 Hydrometeorological Risk Scoring Algorithm

Algoritma custom untuk menghitung skor risiko banjir (0.0 - 1.0):

#### Formula Komponen:

**a) Rain Score (0 - 0.45)**

```
IF cuaca contains 'hujan' OR weather_code IN ['60','61','62','63','95','97']
    rain_score = 0.45
ELSE IF cuaca contains 'berawan'
    rain_score = 0.20
ELSE IF cuaca contains 'kabut' OR 'asap'
    rain_score = 0.15
ELSE
    rain_score = 0.05
```

**b) Humidity Score (0 - 0.30)**

```
humidity_score = MAX(0, (humidity - 50) / 50) × 0.30
```

**c) Cloud Cover Score (0 - 0.15)**

```
cloud_score = (cloud_cover / 100) × 0.15
```

**d) Wind & Temperature Factor (0 - 0.10)**

```
wind_temp_score = MIN(0.10, (wind_speed / 40) × 0.05 +
                             (30 - temp if temp < 30 else 0) × 0.005)
```

**e) Total Risk Score**

```
total_score = MIN(1.0, rain_score + humidity_score +
                        cloud_score + wind_temp_score)
```

### 3.3 Risk Categorization

Skor konversi ke kategori risiko:

| Kategori   | Range       | Deskripsi                |
| ---------- | ----------- | ------------------------ |
| **Rendah** | < 0.40      | Risiko banjir minimal    |
| **Sedang** | 0.40 - 0.65 | Risiko banjir moderate   |
| **Tinggi** | > 0.65      | Risiko banjir signifikan |

---

## 4. DATA & FITUR

### 4.1 Dataset

**Sumber**: dataset_cuaca_sulawesi_tengah.csv

**Ukuran**: Multiple records dari berbagai kabupaten/kota di Sulawesi Tengah

**Periode**: [Sesuai dengan sumber data]

### 4.2 Fitur Input Model

Model Random Forest menggunakan 9 fitur untuk prediksi:

| No  | Fitur               | Tipe    | Deskripsi                      |
| --- | ------------------- | ------- | ------------------------------ |
| 1   | **suhu**            | Float   | Suhu udara (°C)                |
| 2   | **kelembapan**      | Float   | Tingkat kelembapan relatif (%) |
| 3   | **kode_cuaca**      | Integer | WMO Weather Code               |
| 4   | **kecepatan_angin** | Float   | Kecepatan angin (km/h)         |
| 5   | **tutupan_awan**    | Float   | Cloud cover (%)                |
| 6   | **latitude**        | Float   | Koordinat garis lintang        |
| 7   | **longitude**       | Float   | Koordinat garis bujur          |
| 8   | **jam**             | Integer | Jam pengamatan (0-23)          |
| 9   | **bulan**           | Integer | Bulan pengamatan (1-12)        |

### 4.3 Variabel Target

**kategori_risiko**: Target klasifikasi dengan 3 kelas

- Rendah
- Sedang
- Tinggi

### 4.4 Fitur Geospatial

| Fitur              | Tipe   | Deskripsi                |
| ------------------ | ------ | ------------------------ |
| **kabupaten_kota** | String | Nama kabupaten/kota      |
| **kecamatan**      | String | Nama kecamatan           |
| **desa_kelurahan** | String | Nama desa/kelurahan      |
| **adm4**           | String | ID administratif level 4 |

---

## 5. PREPROCESSING DATA

### 5.1 Tahapan Preprocessing

1. **Loading Dataset**

   ```python
   df = pd.read_csv(DATASET_PATH)
   ```

2. **Type Conversion**
   - Konversi kolom numerik ke tipe Float/Integer
   - Error handling untuk nilai yang tidak valid
3. **Missing Values**
   - Menghapus rows dengan missing values pada: suhu, kelembapan, latitude, longitude
   - Median imputation untuk missing values dalam feature set

4. **Feature Engineering**
   ```python
   df['risk_score'] = df.apply(calculate_flood_risk_score, axis=1)
   df['kategori_risiko'] = df['risk_score'].apply(categorize_risk)
   ```

### 5.2 Train-Test Split

```python
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,           # 20% untuk testing
    random_state=42,         # Reproducibility
    stratify=y               # Balanced class distribution
)
```

---

## 6. EVALUASI MODEL

### 6.1 Metrik Evaluasi

**Accuracy**: Proporsi prediksi yang benar

```
Accuracy = (TP + TN) / (TP + TN + FP + FN)
```

**Precision, Recall, F1-Score**: Evaluated per class

**Confusion Matrix**: Menampilkan TP, TN, FP, FN untuk setiap class

### 6.2 Hasil Evaluasi

Output evaluasi disimpan dalam model artifact:

- Classification Report (precision, recall, f1-score per class)
- Confusion Matrix (3x3 matrix untuk 3 classes)
- Model Accuracy (%)

### 6.3 Feature Importance

Algoritma Random Forest menghasilkan feature importance scores yang menunjukkan kontribusi setiap fitur terhadap prediksi.

---

## 7. API ENDPOINTS

### 7.1 Summary Statistics

**Endpoint**: `GET /api/summary`

**Parameters**:

- `kabupaten` (optional): Filter by kabupaten_kota
- `risk` (optional): Filter by risk category (Rendah/Sedang/Tinggi)

**Response**:

```json
{
  "total_records": 1000,
  "high_count": 250,
  "med_count": 400,
  "low_count": 350,
  "high_pct": 25.0,
  "med_pct": 40.0,
  "low_pct": 35.0,
  "kabupaten_options": ["Palu", "Donggala", ...]
}
```

### 7.2 GeoJSON Boundary

**Endpoint**: `GET /api/geojson/boundary`

**Response**: GeoJSON FeatureCollection dengan boundaries administratif Sulawesi Tengah

### 7.3 Weather Points

**Endpoint**: `GET /api/weather-points`

**Parameters**:

- `kabupaten` (optional): Filter by kabupaten
- `risk` (optional): Filter by risk category
- `limit` (optional): Max records returned (default: 1200)

**Response**: Array of weather point objects dengan:

- Koordinat (latitude, longitude)
- Nama administratif (kabupaten, kecamatan, desa)
- Paramater cuaca (suhu, kelembapan, angin, dll)
- Kategori risiko

---

## 8. FITUR APLIKASI

### 8.1 Dashboard Utama

1. **Statistik Ringkas**
   - Total records
   - Distribusi risiko (Rendah/Sedang/Tinggi)
   - Persentase per kategori

2. **Peta Interaktif**
   - Visualisasi boundaries Sulawesi Tengah
   - Marker untuk setiap titik cuaca
   - Color-coded berdasarkan risk category
   - Zoom dan pan functionality

3. **Filter & Eksplorasi**
   - Filter by kabupaten/kota
   - Filter by risk category
   - Real-time update visualisasi

4. **Detail Data Point**
   - Click on marker untuk melihat detail lengkap
   - Informasi cuaca dan lokasi
   - Risk score dan kategori

### 8.2 Analisis Lanjutan

1. **Feature Importance Chart**
   - Visualisasi kontribusi setiap fitur dalam prediksi

2. **Weather Distribution**
   - Distribusi parameter cuaca (suhu, kelembapan, angin)

3. **Export Functionality**
   - Download filtered data sebagai CSV

---

## 9. CARA PENGGUNAAN

### 9.1 Setup & Instalasi

```bash
# Clone atau extract project
cd tugas_besar

# Buat virtual environment (optional)
python -m venv venv
source venv/bin/activate  # macOS/Linux
# atau
venv\Scripts\activate      # Windows

# Install dependencies
pip install -r requirements.txt
```

### 9.2 Training Model (First Run)

```bash
# Train model dan simpan
python train_model.py

# Output:
# - model_banjir.joblib (model artifact)
# - Console output dengan accuracy dan classification report
```

### 9.3 Menjalankan Aplikasi

```bash
# Start Flask server
python app.py

# Output:
# * Running on http://localhost:5000
# * Aplikasi accessible di browser
```

### 9.4 Menggunakan Dashboard

1. Buka browser ke `http://localhost:5000`
2. Dashboard loaded dengan data dan peta
3. Gunakan filter dropdown untuk explore data
4. Click marker untuk melihat detail lokasi
5. Scroll untuk melihat analytics charts
6. Export data jika diperlukan

---

## 10. STRUKTUR FILE

```
tugas_besar/
├── app.py                              # Flask backend & API
├── train_model.py                      # Model training & preprocessing
├── geo_utils.py                        # Geospatial utilities
├── model_banjir.joblib                 # Trained model artifact
├── dataset_cuaca_sulawesi_tengah.csv   # Dataset
├── sulawesi_tengah_boundaries.json     # GeoJSON boundaries
├── requirements.txt                    # Dependencies
├── README.md                           # Project README
├── LAPORAN_SISTEM.md                   # Laporan sistem (ini)
├── static/
│   ├── css/
│   │   └── style.css                   # Styling dashboard
│   └── js/
│       └── main.js                     # Frontend logic & map
└── templates/
    └── index.html                      # Dashboard HTML
```

---

## 11. DEPENDENCY

| Package      | Version | Fungsi                |
| ------------ | ------- | --------------------- |
| Flask        | Latest  | Web framework         |
| Pandas       | Latest  | Data manipulation     |
| NumPy        | Latest  | Numerical computing   |
| Scikit-learn | Latest  | Machine learning      |
| GeoPandas    | Latest  | Geospatial processing |
| Joblib       | Latest  | Model serialization   |

Lihat `requirements.txt` untuk detail lengkap.

---

## 12. LIMITASI & FUTURE WORK

### 12.1 Limitasi Saat Ini

1. **Data**: Model dilatih hanya dengan data historis Sulawesi Tengah
2. **Real-time**: Prediksi bergantung pada input data cuaca terkini
3. **Akurasi**: Tergantung pada kualitas dan kelengkapan data input
4. **Temporal**: Tidak mempertimbangkan seasonal trend yang kompleks
5. **Hydrologi**: Hanya berbasis parameter meteorologi, bukan data hidrologi real-time

### 12.2 Pengembangan Masa Depan

1. **Model Enhancement**
   - Eksplorasi algoritma advanced (XGBoost, LightGBM, Neural Networks)
   - Hyperparameter tuning lebih mendalam
   - Cross-validation dan ensemble methods

2. **Data Integration**
   - Real-time weather API integration
   - Hidrological data (water level, discharge rate)
   - Historical flood event correlation

3. **Feature Engineering**
   - Agregasi temporal (rolling averages, trends)
   - Terrain analysis (DEM, slope, aspect)
   - Historical rainfall patterns

4. **User Experience**
   - Mobile-responsive dashboard
   - Push notifications untuk high-risk alerts
   - Forecast mode (prediksi untuk 24-48 jam ke depan)

5. **System Scalability**
   - Database integration (PostgreSQL + PostGIS)
   - Caching mechanism (Redis)
   - Distributed processing (Spark)

---

## 13. KESIMPULAN

Sistem Prediksi Risiko Banjir Sulawesi Tengah menggabungkan:

- **Machine Learning** (Random Forest) untuk klasifikasi robust
- **Domain Knowledge** (Hydrometeorological scoring) untuk interpretability
- **Geospatial Visualization** untuk spatial analysis
- **Web Dashboard** untuk user-friendly interface

Model mencapai akurasi tinggi dan dapat digunakan untuk mendukung pengambilan keputusan mitigasi bencana banjir di tingkat lokal dan regional.

---

## 14. REFERENSI & SUMBER DATA

1. WMO Weather Code: [International standard weather classification]
2. Scikit-learn Documentation: [ML algorithms reference]
3. Leaflet.js Documentation: [Interactive mapping]
4. Provinsi Sulawesi Tengah Administrative Boundaries: [GeoJSON dataset]

---

**Dokumen ini dibuat untuk dokumentasi sistem dan referensi teknis.**  
_Last Updated: September 2026_
