# Dokumentasi & Laporan Akhir Sistem Prediksi Risiko Banjir Sulawesi Tengah

Folder `docs/` ini berisi laporan akhir proyek lengkap dalam format PDF (`pdflatex`), Word (`.docx`), LaTeX (`.tex`), dan Markdown (`.md`), serta dokumentasi teknis mengenai alur kerja sistem dan tahapan *Data Mining* berbasis dataset **`dataset_cuaca_new.xlsx`**.

## Daftar Dokumen

1. **Laporan Akhir Proyek Lengkap (`BAB I` s.d. `BAB VII`)**:
   - **[LAPORAN_AKHIR_PROYEK.pdf](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_AKHIR_PROYEK.pdf)**: Laporan akhir 34 halaman yang dikompilasi menggunakan `pdflatex` (lengkap dengan Halaman Sampul, Daftar Isi, Daftar Tabel, Daftar Gambar, diagram TikZ, dan 5 grafik visualisasi beresolusi tinggi).
   - **[LAPORAN_AKHIR_PROYEK.tex](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_AKHIR_PROYEK.tex)**: Kode sumber LaTeX untuk kompilasi `pdflatex`.
   - **[LAPORAN_AKHIR_PROYEK.docx](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_AKHIR_PROYEK.docx)**: Laporan akhir dalam format Microsoft Word (`.docx`).
   - **[LAPORAN_AKHIR_PROYEK.md](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/LAPORAN_AKHIR_PROYEK.md)**: Laporan akhir dalam format Markdown.

2. **[FLOW_SISTEM.md](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/FLOW_SISTEM.md)**
   - Diagram arsitektur *end-to-end*, alur pra-pemrosesan multi-sheet, rumus perhitungan skor risiko hidrometeorologi (`risk_score`), *sequence diagram* REST API Flask, dan *state diagram* navigasi antarmuka pengguna.

3. **[ALUR_DATA_MINING.md](file:///Users/user/Documents/megister/Data%20Mining/tugas_besar/docs/ALUR_DATA_MINING.md)**
   - Alur tahapan *Data Mining* (CRISP-DM), rincian struktur kolom, alur penggabungan lintas sheet (*left join* dampak bencana BNPB ke deret waktu cuaca harian ECMWF IFS), dan evaluasi *Random Forest*.
