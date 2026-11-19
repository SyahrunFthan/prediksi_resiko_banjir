# Dokumentasi & Laporan Akhir Sistem Prediksi Risiko Banjir Sulawesi Tengah

Folder `docs/` ini berisi laporan akhir proyek lengkap dalam format PDF (`pdflatex`), Word (`.docx`), LaTeX (`.tex`), Markdown (`.md`), dan slide presentasi PowerPoint (`.pptx`), serta dokumentasi teknis mengenai alur kerja sistem dan tahapan *Data Mining* berbasis dataset **`dataset_cuaca_new.xlsx`**.

## Daftar Dokumen

1. **Laporan Akhir Proyek Lengkap (`BAB I` s.d. `BAB VII`)**:
   - **[LAPORAN_AKHIR_PROYEK.pdf](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_AKHIR_PROYEK.pdf)**: Laporan akhir 33 halaman yang dikompilasi menggunakan `pdflatex` (lengkap dengan Halaman Sampul resmi Universitas Tadulako, Daftar Isi, Daftar Tabel, Daftar Gambar, analisis RapidMiner Studio, dan grafik evaluasi model).
   - **[LAPORAN_AKHIR_PROYEK.tex](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_AKHIR_PROYEK.tex)**: Kode sumber LaTeX untuk kompilasi `pdflatex`.
   - **[LAPORAN_AKHIR_PROYEK.docx](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_AKHIR_PROYEK.docx)**: Laporan akhir dalam format Microsoft Word (`.docx`) yang telah diselaraskan dengan tata letak PDF.
   - **[LAPORAN_AKHIR_PROYEK.md](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_AKHIR_PROYEK.md)**: Laporan akhir dalam format Markdown.

2. **Slide Presentasi Proyek Lengkap (`.pptx`)**:
   - **[PRESENTASI_PROYEK_PENAMBANGAN_DATA.pptx](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/PRESENTASI_PROYEK_PENAMBANGAN_DATA.pptx)**: Slide presentasi 12 halaman (*widescreen* 16:9) bergaya *Blue Pitch Deck Template* yang merangkum identitas kelompok, latar belakang dan dampak banjir BNPB, metodologi CRISP-DM, struktur 3 sheet `dataset_cuaca_new.xlsx`, pra-pemrosesan dan rumus `risk_score`, desain dan hasil evaluasi RapidMiner Studio (`92,41% +/- 0,36%`), evaluasi model Python Scikit-Learn (`92,66%` dan `97,10%`), tingkat pengaruh 12 fitur (*Feature Importance*), serta implementasi sistem web GIS *end-to-end*.

3. **[FLOW_SISTEM.md](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/FLOW_SISTEM.md)**
   - Diagram arsitektur *end-to-end*, alur pra-pemrosesan multi-sheet, rumus perhitungan skor risiko hidrometeorologi (`risk_score`), *sequence diagram* REST API Flask, dan *state diagram* navigasi antarmuka pengguna.

4. **[ALUR_DATA_MINING.md](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/ALUR_DATA_MINING.md)**
   - Alur tahapan *Data Mining* (CRISP-DM), rincian struktur kolom, alur penggabungan lintas sheet (*left join* dampak bencana BNPB ke deret waktu cuaca harian ECMWF IFS), dan evaluasi *Random Forest*.
