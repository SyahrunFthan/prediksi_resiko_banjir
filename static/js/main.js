// MAIN CLIENT APPLICATION JAVASCRIPT
// Handles Leaflet Map, Charts, Prediction Form & API interactions

document.addEventListener("DOMContentLoaded", () => {
  // 1. TAB SWITCHING
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabPanes.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const tabId = btn.getAttribute("data-tab");
      const targetPane = document.getElementById(tabId);
      if (targetPane) {
        targetPane.classList.add("active");
      }

      // Re-invalidate Leaflet map size when map tab becomes active
      if (tabId === "tabMap" && map) {
        setTimeout(() => map.invalidateSize(), 200);
      }
    });
  });

  // 2. FETCH SUMMARY METRICS
  async function loadSummary(kabupaten = "all", risk = "all") {
    try {
      const res = await fetch(`/api/summary?kabupaten=${kabupaten}&risk=${risk}`);
      const data = await res.json();

      const total = data.total_data ?? data.total_records ?? 0;
      const high = data.high_risk_count ?? data.high_count ?? 0;
      const med = data.med_risk_count ?? data.med_count ?? 0;
      const low = data.low_risk_count ?? data.low_count ?? 0;
      const highPct = data.high_pct ?? 0;
      const medPct = data.med_pct ?? 0;
      const lowPct = data.low_pct ?? 0;

      const elTotal = document.getElementById("valTotalData");
      if (elTotal) elTotal.textContent = Number(total).toLocaleString();

      const elHigh = document.getElementById("valHighRisk");
      if (elHigh) elHigh.textContent = Number(high).toLocaleString();

      const elHighPct = document.getElementById("pctHighRisk");
      if (elHighPct) elHighPct.textContent = `${highPct}%`;

      const elMed = document.getElementById("valMedRisk");
      if (elMed) elMed.textContent = Number(med).toLocaleString();

      const elMedPct = document.getElementById("pctMedRisk");
      if (elMedPct) elMedPct.textContent = `${medPct}%`;

      const elLow = document.getElementById("valLowRisk");
      if (elLow) elLow.textContent = Number(low).toLocaleString();

      const elLowPct = document.getElementById("pctLowRisk");
      if (elLowPct) elLowPct.textContent = `${lowPct}%`;

      // Populate Kabupaten select dropdowns once
      const selectKab = document.getElementById("filterKabupaten");
      const selectPKab = document.getElementById("pKabupaten");
      const kabList = data.kabupaten_list ?? data.kabupaten_options ?? [];

      if (selectKab && selectKab.options.length <= 1 && Array.isArray(kabList)) {
        kabList.forEach((kab) => {
          const opt1 = document.createElement("option");
          opt1.value = kab;
          opt1.textContent = kab;
          selectKab.appendChild(opt1);

          if (selectPKab) {
            const opt2 = document.createElement("option");
            opt2.value = kab;
            opt2.textContent = kab;
            selectPKab.appendChild(opt2);
          }
        });
      }
    } catch (err) {
      console.error("Error loading summary stats:", err);
    }
  }

  // 3. LEAFLET MAP & GEOPANDAS BOUNDARY
  let map = null;
  let geoJsonLayer = null;
  let markerCluster = null;

  function initMap() {
    const mapContainer = document.getElementById("mapContainer");
    if (!mapContainer) return;

    map = L.map("mapContainer", {
      center: [-1.43, 121.4456],
      zoom: 8,
      zoomControl: true,
    });

    // Check if Mapbox token exists
    if (window.MAP_API_KEY) {
      L.tileLayer(
        `https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=${window.MAP_API_KEY}`,
        {
          attribution:
            '&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
          maxZoom: 18,
          id: "mapbox/dark-v11",
          tileSize: 512,
          zoomOffset: -1,
        },
      ).addTo(map);
    } else {
      // Fallback CartoDB dark tiles
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution: "&copy; OpenStreetMap &copy; CARTO",
          maxZoom: 18,
        },
      ).addTo(map);
    }

    markerCluster = L.markerClusterGroup({
      maxClusterRadius: 40,
    }).addTo(map);

    loadMapData();
  }

  async function loadMapData(kabupaten = "all", risk = "all") {
    if (!map) return;

    // Fetch GeoPandas GeoJSON Boundary
    if (!geoJsonLayer) {
      try {
        const resB = await fetch("/api/geojson/boundary");
        const geoJsonData = await resB.json();

        geoJsonLayer = L.geoJSON(geoJsonData, {
          style: {
            color: "#38bdf8",
            weight: 2,
            fillColor: "#0284c7",
            fillOpacity: 0.12,
          },
          onEachFeature: (feature, layer) => {
            const props = feature.properties || {};
            const name =
              props.kabupaten_kota ||
              props.NAME_1 ||
              "Wilayah Sulawesi Tengah";
            layer.bindTooltip(`<b>${name}</b>`);
          },
        }).addTo(map);
      } catch (e) {
        console.warn("GeoJSON boundary load warning:", e);
      }
    }

    // Fetch Weather Points
    try {
      const resP = await fetch(
        `/api/weather-points?kabupaten=${kabupaten}&risk=${risk}&limit=2000`,
      );
      const dataP = await resP.json();

      markerCluster.clearLayers();

      const colorMap = {
        Tinggi: "#f43f5e",
        Sedang: "#f59e0b",
        Rendah: "#10b981",
      };

      dataP.points.forEach((pt) => {
        const color = colorMap[pt.kategori_risiko] || "#38bdf8";

        const marker = L.circleMarker([pt.latitude, pt.longitude], {
          radius: 6,
          color: color,
          fillColor: color,
          fillOpacity: 0.85,
          weight: 1,
        });

        const popupHtml = `
          <div style="font-family: 'Inter', sans-serif; font-size: 13px; color: #f8fafc; min-width: 220px; line-height: 1.5;">
            <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 2px;">
              ${pt.kecamatan}
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">
              Desa ${pt.desa} • Kab. ${pt.kabupaten}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px; background: rgba(255,255,255,0.06); padding: 8px 10px; border-radius: 8px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.08);">
              <div><span style="color: #94a3b8;">Suhu:</span> <b>${pt.suhu} °C</b></div>
              <div><span style="color: #94a3b8;">Kelembapan:</span> <b>${pt.kelembapan}%</b></div>
              <div><span style="color: #94a3b8;">Tutupan Awan:</span> <b>${pt.tutupan_awan}%</b></div>
              <div><span style="color: #94a3b8;">Kondisi:</span> <b>${pt.cuaca}</b></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
              <span style="font-size: 11px; color: #94a3b8;">Klasifikasi Risiko:</span>
              <span style="font-weight: 700; color: ${color}; font-size: 12px; background: ${color}20; border: 1px solid ${color}60; padding: 2px 10px; border-radius: 9999px;">
                ${pt.kategori_risiko}
              </span>
            </div>
          </div>
        `;

        marker.bindPopup(popupHtml);
        marker.bindTooltip(`${pt.kecamatan}: ${pt.kategori_risiko}`);
        markerCluster.addLayer(marker);
      });

      // Adjust map view based on filter
      if (markerCluster.getLayers().length > 0) {
        if (kabupaten !== "all") {
          map.fitBounds(markerCluster.getBounds().pad(0.15));
        } else {
          map.setView([-1.43, 121.4456], 8);
        }
      }
    } catch (e) {
      console.error("Error loading weather points:", e);
    }
  }

  // 4. SLIDER BINDINGS & PREDICTION FORM
  const sliders = [
    { id: "pSuhu", lbl: "valSuhuLbl" },
    { id: "pKelembapan", lbl: "valKelembapanLbl" },
    { id: "pAwan", lbl: "valAwanLbl" },
    { id: "pAngin", lbl: "valAnginLbl" },
    { id: "pJam", lbl: "valJamLbl" },
    { id: "pBulan", lbl: "valBulanLbl" },
  ];

  sliders.forEach((item) => {
    const el = document.getElementById(item.id);
    const lbl = document.getElementById(item.lbl);
    if (el && lbl) {
      el.addEventListener("input", (e) => {
        lbl.textContent = e.target.value;
      });
    }
  });

  // Preset Scenario Buttons
  const predForm = document.getElementById("predictionForm");

  document.querySelectorAll(".btn-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = btn.getAttribute("data-preset");
      if (preset === "ekstrem") {
        document.getElementById("pSuhu").value = 23;
        document.getElementById("pKelembapan").value = 96;
        document.getElementById("pAwan").value = 95;
        document.getElementById("pAngin").value = 35;
        document.getElementById("pKodeCuaca").value = 95;
      } else if (preset === "sedang") {
        document.getElementById("pSuhu").value = 26;
        document.getElementById("pKelembapan").value = 82;
        document.getElementById("pAwan").value = 75;
        document.getElementById("pAngin").value = 16;
        document.getElementById("pKodeCuaca").value = 61;
      } else if (preset === "aman") {
        document.getElementById("pSuhu").value = 32;
        document.getElementById("pKelembapan").value = 60;
        document.getElementById("pAwan").value = 20;
        document.getElementById("pAngin").value = 10;
        document.getElementById("pKodeCuaca").value = 0;
      }

      // Update slider display badges
      sliders.forEach((item) => {
        const el = document.getElementById(item.id);
        const lbl = document.getElementById(item.lbl);
        if (el && lbl) lbl.textContent = el.value;
      });

      // Automatically execute prediction form
      if (predForm) {
        predForm.dispatchEvent(new Event("submit"));
      }
    });
  });

  if (predForm) {
    predForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const payload = {
        suhu: parseFloat(document.getElementById("pSuhu").value),
        kelembapan: parseFloat(document.getElementById("pKelembapan").value),
        tutupan_awan: parseFloat(document.getElementById("pAwan").value),
        kecepatan_angin: parseFloat(document.getElementById("pAngin").value),
        kode_cuaca: parseFloat(document.getElementById("pKodeCuaca").value),
        jam: parseFloat(document.getElementById("pJam").value),
        bulan: parseFloat(document.getElementById("pBulan").value),
      };

      try {
        const res = await fetch("/api/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await res.json();

        const resultBox = document.getElementById("resultBox");
        const badgeBox = document.getElementById("resBadgeBox");

        resultBox.classList.remove("hidden");

        const pred = result.prediction;
        const probs = result.probabilities;

        if (pred === "Tinggi") {
          badgeBox.innerHTML = `
            <div class="status-card tinggi">
              <h2>STATUS: SIAGA BANJIR TINGGI</h2>
              <p>
                <b>Indikasi Spasial:</b> Tingkat risiko genangan dan luapan air tinggi berdasarkan kelembapan jenuh dan intensitas hujan.
              </p>
              <p style="font-size: 12px; margin-top: 4px; opacity: 0.9;">
                Rekomendasi Operasional: Pantau debit aliran sungai, bersihkan saluran drainase utama, dan siapkan posko siaga di kawasan rawan longsor/genangan.
              </p>
            </div>
          `;
        } else if (pred === "Sedang") {
          badgeBox.innerHTML = `
            <div class="status-card sedang">
              <h2>STATUS: WASPADA BANJIR SEDANG</h2>
              <p>
                <b>Indikasi Spasial:</b> Potensi genangan air pada area tangkapan air rendah. Diperlukan pemantauan berkala.
              </p>
              <p style="font-size: 12px; margin-top: 4px; opacity: 0.9;">
                Rekomendasi Operasional: Lakukan pemeriksaan berkala pada saluran air sekunder dan pantau update citra cuaca radar.
              </p>
            </div>
          `;
        } else {
          badgeBox.innerHTML = `
            <div class="status-card rendah">
              <h2>STATUS: AMAN DARI RISIKO BANJIR</h2>
              <p>
                <b>Indikasi Spasial:</b> Kondisi atmosfer dan kelembapan stabil, potensi banjir minimal.
              </p>
              <p style="font-size: 12px; margin-top: 4px; opacity: 0.9;">
                Rekomendasi Operasional: Kondisi hidrometeorologis kondusif. Pemantauan rutin harian standar.
              </p>
            </div>
          `;
        }

        // Update Progress Bars
        const pT = probs.Tinggi || 0;
        const pS = probs.Sedang || 0;
        const pR = probs.Rendah || 0;

        document.getElementById("barTinggi").style.width = `${pT}%`;
        document.getElementById("valTinggi").textContent = `${pT}%`;

        document.getElementById("barSedang").style.width = `${pS}%`;
        document.getElementById("valSedang").textContent = `${pS}%`;

        document.getElementById("barRendah").style.width = `${pR}%`;
        document.getElementById("valRendah").textContent = `${pR}%`;
      } catch (err) {
        console.error("Error predicting flood risk:", err);
      }
    });
  }

  // 5. CHART.JS ANALYTICS DASHBOARD
  let chartKab = null;
  let chartWeather = null;
  let chartFI = null;

  async function loadAnalytics() {
    try {
      const res = await fetch("/api/analytics");
      const data = await res.json();

      Chart.defaults.color = "#94a3b8";
      Chart.defaults.font.family = "'Inter', sans-serif";

      // Chart 1: Kabupaten Risk Stacked Bar Chart
      const ctxKab = document.getElementById("chartKabupaten");
      if (ctxKab) {
        if (chartKab) chartKab.destroy();
        chartKab = new Chart(ctxKab, {
          type: "bar",
          data: {
            labels: data.kabupaten_risk.categories,
            datasets: [
              {
                label: "Tinggi",
                data: data.kabupaten_risk.tinggi,
                backgroundColor: "#f43f5e",
                borderRadius: 4,
              },
              {
                label: "Sedang",
                data: data.kabupaten_risk.sedang,
                backgroundColor: "#f59e0b",
                borderRadius: 4,
              },
              {
                label: "Rendah",
                data: data.kabupaten_risk.rendah,
                backgroundColor: "#10b981",
                borderRadius: 4,
              },
            ],
          },
          options: {
            responsive: true,
            scales: {
              x: {
                stacked: true,
                grid: { color: "rgba(255, 255, 255, 0.05)" },
              },
              y: {
                stacked: true,
                grid: { color: "rgba(255, 255, 255, 0.05)" },
              },
            },
            plugins: {
              legend: {
                position: "top",
                labels: { color: "#f8fafc", boxWidth: 12, padding: 14 },
              },
            },
          },
        });
      }

      // Chart 2: Weather Distribution Donut Chart
      const ctxW = document.getElementById("chartWeather");
      if (ctxW) {
        if (chartWeather) chartWeather.destroy();
        chartWeather = new Chart(ctxW, {
          type: "doughnut",
          data: {
            labels: Object.keys(data.weather_distribution),
            datasets: [
              {
                data: Object.values(data.weather_distribution),
                backgroundColor: [
                  "#38bdf8",
                  "#10b981",
                  "#f59e0b",
                  "#f43f5e",
                  "#818cf8",
                  "#ec4899",
                ],
                borderWidth: 2,
                borderColor: "#0f182c",
              },
            ],
          },
          options: {
            responsive: true,
            plugins: {
              legend: {
                position: "right",
                labels: { color: "#f8fafc", boxWidth: 12, padding: 12 },
              },
            },
          },
        });
      }

      // Chart 3: Machine Learning Feature Importance
      const ctxFI = document.getElementById("chartFeatureImportance");
      if (ctxFI) {
        if (chartFI) chartFI.destroy();
        const fiKeys = Object.keys(data.feature_importances);
        const fiVals = Object.values(data.feature_importances);

        chartFI = new Chart(ctxFI, {
          type: "bar",
          data: {
            labels: fiKeys,
            datasets: [
              {
                label: "Tingkat Kepentingan Fitur (Feature Importance)",
                data: fiVals,
                backgroundColor: "#0284c7",
                borderRadius: 6,
              },
            ],
          },
          options: {
            indexAxis: "y",
            responsive: true,
            scales: {
              x: { grid: { color: "rgba(255, 255, 255, 0.05)" } },
              y: { grid: { display: false } },
            },
            plugins: {
              legend: { labels: { color: "#f8fafc" } },
            },
          },
        });
      }
    } catch (err) {
      console.error("Error loading analytics:", err);
    }
  }

  // 6. DATA TABLE EXPLORER WITH PAGINATION
  let currentPage = 1;

  async function loadTableData(page = 1, search = "") {
    const kab = document.getElementById("filterKabupaten").value;
    const risk = document.getElementById("filterRisk").value;

    try {
      const res = await fetch(
        `/api/table-data?page=${page}&limit=12&kabupaten=${kab}&risk=${risk}&search=${encodeURIComponent(search)}`,
      );
      const data = await res.json();

      const tbody = document.getElementById("tableBody");
      tbody.innerHTML = "";

      if (data.rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: var(--text-secondary);">Tidak ada data yang cocok dengan kriteria pencarian.</td></tr>`;
        return;
      }

      data.rows.forEach((r) => {
        const tr = document.createElement("tr");

        const badgeClass =
          r.kategori_risiko === "Tinggi"
            ? "badge-red"
            : r.kategori_risiko === "Sedang"
              ? "badge-yellow"
              : "badge-green";

        tr.innerHTML = `
          <td><b>${r.kabupaten_kota}</b></td>
          <td>${r.kecamatan}</td>
          <td>${r.desa_kelurahan}</td>
          <td>${r.suhu} °C</td>
          <td>${r.kelembapan}%</td>
          <td>${r.tutupan_awan}%</td>
          <td>${r.deskripsi_cuaca}</td>
          <td><span class="badge ${badgeClass}">${r.kategori_risiko}</span></td>
          <td><code>${r.risk_score}</code></td>
        `;
        tbody.appendChild(tr);
      });

      currentPage = data.page;
      document.getElementById("pageInfo").textContent =
        `Halaman ${data.page} dari ${data.total_pages} (${data.total.toLocaleString()} data)`;
    } catch (err) {
      console.error("Error loading table data:", err);
    }
  }

  // Event Listeners for Filters & Table
  document.getElementById("btnApplyFilter").addEventListener("click", () => {
    const kab = document.getElementById("filterKabupaten").value;
    const risk = document.getElementById("filterRisk").value;
    loadSummary(kab, risk);
    loadMapData(kab, risk);
    loadTableData(1, document.getElementById("tableSearch").value);
  });

  document.getElementById("tableSearch").addEventListener("input", (e) => {
    loadTableData(1, e.target.value);
  });

  document.getElementById("btnPrevPage").addEventListener("click", () => {
    if (currentPage > 1) {
      loadTableData(
        currentPage - 1,
        document.getElementById("tableSearch").value,
      );
    }
  });

  document.getElementById("btnNextPage").addEventListener("click", () => {
    loadTableData(
      currentPage + 1,
      document.getElementById("tableSearch").value,
    );
  });

  // Initialize Everything
  loadSummary();
  initMap();
  loadAnalytics();
  loadTableData();
});
