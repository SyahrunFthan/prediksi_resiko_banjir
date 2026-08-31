# Prediksi Risiko Banjir Sulawesi Tengah

Aplikasi web berbasis Python untuk memprediksi dan memvisualisasikan risiko banjir di Provinsi Sulawesi Tengah menggunakan data cuaca dan model Machine Learning Random Forest.

## Deskripsi proyek

Proyek ini menampilkan:

- Dashboard analitik risiko banjir wilayah Sulawesi Tengah
- Peta interaktif berbasis Leaflet dan GeoPandas
- Simulasi prediksi real-time berdasarkan parameter cuaca
- Eksplorasi data dan ekspor CSV
- Model klasifikasi risiko dengan kategori: Rendah, Sedang, dan Tinggi

## Fitur utama

- Visualisasi peta wilayah administratif Sulawesi Tengah
- Marker titik cuaca dengan level risiko banjir
- Filter berdasarkan kabupaten/kota dan kategori risiko
- Prediksi otomatis dari fitur seperti suhu, kelembapan, tutupan awan, kecepatan angin, koordinat, jam, dan bulan
- Analisis feature importance dan distribusi cuaca
- API endpoint untuk data dan prediksi

## Teknologi yang digunakan

- Python 3
- Flask
- Pandas
- GeoPandas
- Scikit-learn
- Joblib
- Leaflet.js
- Chart.js

## Struktur proyek

```text
.
├── app.py                     # Backend Flask dan API
├── train_model.py            # Proses preprocessing data dan training model
├── geo_utils.py              # Utility geospasial untuk peta wilayah
├── dataset_cuaca_sulawesi_tengah.csv
├── model_banjir.joblib       # Model hasil training
├── requirements.txt          # Daftar dependency
├── static/                   # CSS, JS, dan aset frontend
├── templates/                # File HTML dashboard
├── sulawesi_tengah_boundaries.json
├── README.md                 # Dokumentasi proyek
└── venv/                     # Lingkungan virtual (opsional)
```

## Persyaratan sistem

- Python 3.10+
- pip
- Browser modern (Chrome, Edge, Firefox)

## Cara download / clone repository

### Opsi 1: Download ZIP dari GitHub

1. Buka halaman repository di GitHub.
2. Klik tombol Code.
3. Pilih Download ZIP.
4. Ekstrak file hasil unduhan ke folder kerja Anda.

### Opsi 2: Clone via Git

```bash
git clone https://github.com/SyahrunFthan/prediksi_resiko_banjir.git
cd prediksi_resiko_banjir
```

Jika repositori sudah Anda miliki secara lokal, cukup masuk ke folder proyek.

## Cara install dependency

### Linux / macOS

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Windows (PowerShell)

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Cara menjalankan aplikasi

### 1. Jalankan server Flask

```bash
python app.py
```

Atau jika menggunakan Flask CLI:

```bash
flask --app app.py run
```

### 2. Buka browser

Setelah server aktif, buka alamat berikut:

```text
http://127.0.0.1:5050
```

## Penjelasan penggunaan aplikasi

### A. Dashboard utama

Pada halaman utama, Anda akan melihat:

- Ringkasan total data cuaca
- Jumlah risiko tinggi, sedang, dan rendah
- Peta interaktif wilayah Sulawesi Tengah
- Grafik analitik berdasarkan kabupaten dan cuaca

### B. Filter data

Gunakan panel filter pada sisi kiri untuk:

- Memilih kabupaten/kota tertentu
- Menyaring berdasarkan kategori risiko: Rendah / Sedang / Tinggi
- Menerapkan perubahan ke peta dan ringkasan data

### C. Simulasi prediksi

Pilih tab "Simulasi Prediksi Real-Time" dan masukkan parameter cuaca seperti:

- Suhu udara
- Kelembapan
- Tutupan awan
- Kecepatan angin
- Latitude dan longitude
- Jam dan bulan

Sistem akan memproses input dan menampilkan:

- Kategori prediksi (Rendah, Sedang, Tinggi)
- Probabilitas setiap kelas
- Fitur yang dipakai model

### D. Explorer data

Pada tab data, Anda dapat:

- Melihat tabel data cuaca
- Mencari berdasarkan wilayah atau cuaca
- Mengubah halaman data
- Mengekspor data ke format CSV

## Model dan dataset

### Dataset

File dataset yang digunakan adalah:

```text
dataset_cuaca_sulawesi_tengah.csv
```

Dataset berisi data cuaca dan koordinat geografis yang digunakan untuk menilai kondisi banjir di wilayah Sulawesi Tengah.

### Model

Model dilatih oleh script:

```bash
python train_model.py
```

Jika file `model_banjir.joblib` belum ada, aplikasi akan otomatis melatih ulang model saat pertama kali dijalankan.

## Endpoint API utama

Aplikasi menyediakan beberapa endpoint API untuk pengembangan lanjutan, di antaranya:

```text
GET /api/summary
GET /api/geojson/boundary
GET /api/weather-points
POST /api/predict
GET /api/analytics
GET /api/table-data
GET /api/export-csv
```

## Troubleshooting

### Error modul tidak ditemukan

```bash
pip install -r requirements.txt
```

### Model belum tersedia

Jalankan:

```bash
python train_model.py
```

### Port sudah dipakai

Gunakan port alternatif:

```bash
flask --app app.py run --port 5001
```

## Catatan

Proyek ini dibuat untuk kebutuhan analisis data mining dan pemodelan prediksi risiko banjir berbasis data cuaca wilayah Sulawesi Tengah. Hasil model dan visualisasi dapat dikembangkan lebih lanjut untuk kebutuhan produksi, monitoring bencana, atau integrasi dengan sistem informasi geografis.

## Lisensi

Proyek ini dibuat untuk keperluan akademik / pembelajaran. Silakan sesuaikan lisensi jika akan digunakan untuk keperluan komersial atau publikasi.
