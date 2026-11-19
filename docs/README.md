# Dokumentasi & Laporan Akhir Sistem Prediksi Risiko Banjir Sulawesi Tengah

Folder `docs/` ini berisi laporan proyek terpisah untuk **RapidMiner Studio** dan **Python End-to-End** (masing-masing dalam format PDF `pdflatex`, Word `.docx`, LaTeX `.tex`, dan Markdown `.md`), laporan akhir gabungan lengkap, serta slide presentasi PowerPoint (`.pptx`) berbasis dataset **`dataset_cuaca_new.xlsx`**.

## Daftar Dokumen

1. **Laporan Khusus Proyek & Analisis Hasil RapidMiner Studio (`BAB I` s.d. `BAB VI`)**:
   - **[LAPORAN_RAPIDMINER.pdf](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_RAPIDMINER.pdf)**: Laporan khusus pemodelan RapidMiner Studio (`Altair AI Studio Educational 2026.1.1`) yang dikompilasi menggunakan `pdflatex` (Halaman Sampul resmi Universitas Tadulako, Daftar Isi, Daftar Tabel, Daftar Gambar, rancangan 6 operator utama dan subproses *10-Fold Cross Validation*, evaluasi `PerformanceVector` akurasi **`92,41% +/- 0,36%`**, serta analisis *Class Precision*, *Class Recall*, dan *Class Imbalance*).
   - **[LAPORAN_RAPIDMINER.docx](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_RAPIDMINER.docx)**: Laporan khusus RapidMiner Studio dalam format Microsoft Word (`.docx`) yang diselaraskan dengan tata letak PDF.
   - **[LAPORAN_RAPIDMINER.tex](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_RAPIDMINER.tex)** & **[LAPORAN_RAPIDMINER.md](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_RAPIDMINER.md)**: Kode sumber LaTeX dan Markdown laporan RapidMiner.
   - **[tugasProjectAkhir.rmp](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/tugasProjectAkhir.rmp)**: Berkas proses XML RapidMiner Studio (`Read Excel` -> `Replace Missing Values` -> `Generate Attributes` -> `Select Attributes` -> `Set Role` -> `Cross Validation`).

2. **Laporan Khusus Implementasi End-to-End Python (`BAB I` s.d. `BAB VI`)**:
   - **[LAPORAN_PYTHON.pdf](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_PYTHON.pdf)**: Laporan khusus implementasi kode program Python (`train_model.py`, `app.py`, `geo_utils.py`) yang dikompilasi menggunakan `pdflatex` (Halaman Sampul resmi Universitas Tadulako, Daftar Isi, Daftar Tabel, Daftar Gambar, ekstraksi XML multi-sheet `dataset_cuaca_new.xlsx`, *cross-sheet left join* `flood_lookup`, rumus 6 komponen `risk_score`, evaluasi model `RandomForestClassifier` 12 fitur pada Sheet 1 **`92,66%`** dan Sheet 2 **`97,10%`**, analisis *Feature Importance*, serta arsitektur web GIS Flask + GeoPandas + Leaflet.js).
   - **[LAPORAN_PYTHON.docx](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_PYTHON.docx)**: Laporan khusus implementasi Python dalam format Microsoft Word (`.docx`) yang diselaraskan dengan tata letak PDF.
   - **[LAPORAN_PYTHON.tex](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_PYTHON.tex)** & **[LAPORAN_PYTHON.md](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_PYTHON.md)**: Kode sumber LaTeX dan Markdown laporan Python.

3. **Laporan Akhir Proyek Gabungan Lengkap (`BAB I` s.d. `BAB VII`)**:
   - **[LAPORAN_AKHIR_PROYEK.pdf](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_AKHIR_PROYEK.pdf)**: Laporan akhir gabungan 33 halaman (`pdflatex`).
   - **[LAPORAN_AKHIR_PROYEK.docx](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_AKHIR_PROYEK.docx)**: Laporan akhir gabungan dalam format Microsoft Word (`.docx`).
   - **[LAPORAN_AKHIR_PROYEK.tex](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_AKHIR_PROYEK.tex)** & **[LAPORAN_AKHIR_PROYEK.md](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_AKHIR_PROYEK.md)**: Kode sumber LaTeX dan Markdown laporan gabungan.

4. **Slide Presentasi Proyek Lengkap (`.pptx`)**:
   - **[PRESENTASI_PROYEK_PENAMBANGAN_DATA.pptx](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/PRESENTASI_PROYEK_PENAMBANGAN_DATA.pptx)**: Slide presentasi 12 halaman (*widescreen* 16:9) bergaya *Blue Pitch Deck Template* (`https://pin.it/2acmoDm1Z`).

5. **[FLOW_SISTEM.md](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/FLOW_SISTEM.md)** & **[ALUR_DATA_MINING.md](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/ALUR_DATA_MINING.md)**
   - Dokumentasi diagram alur sistem, REST API Flask, dan tahapan CRISP-DM.
