# Dokumentasi Sistem Prediksi & Visualisasi Geospasial Risiko Banjir Sulawesi Tengah

Folder `docs/` ini berisi dokumentasi teknis mengenai alur kerja sistem, arsitektur aplikasi, serta tahapan *Data Mining* dan *Machine Learning* yang digunakan pada proyek.

## Daftar Dokumen

1. **[FLOW_SISTEM.md](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/FLOW_SISTEM.md)**
   - Diagram arsitektur *end-to-end* (Sumber Data, Preprocessing, Model Random Forest, Backend Flask, dan Frontend Geospasial).
   - Alur pemrosesan untuk 2 sumber dataset (`dataset_cuaca_sulawesi_tengah.csv` dan `dataset_cuaca_new.xlsx`).
   - Rumus perhitungan skor risiko hidrometeorologi (`risk_score`) dan ambang klasifikasi (`Rendah`, `Sedang`, `Tinggi`).
   - *Sequence diagram* komunikasi REST API antara antarmuka pengguna dan server Flask.
   - *State diagram* navigasi ke-4 tab aplikasi dan spesifikasi endpoint REST API.

2. **[ALUR_DATA_MINING.md](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/ALUR_DATA_MINING.md)**
   - Alur tahapan *Data Mining* (Data Collection, Data Cleaning & Integration, Feature Engineering, Modeling, Evaluation, dan Deployment).
   - Rincian struktur kolom pada `dataset_cuaca_sulawesi_tengah.csv` (39.932 baris) dan ketiga sheet pada `dataset_cuaca_new.xlsx` (`Banjir_dan_Cuaca` 541 baris, `Cuaca_Historis` 31.668 baris, `Koordinat_Kabupaten` 13 baris).
   - Alur penggabungan lintas sheet (*left join* dampak bencana BNPB ke deret waktu cuaca harian ECMWF IFS) serta evaluasi model *Random Forest* 9 fitur dan 12 fitur.

