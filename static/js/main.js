// MAIN CLIENT APPLICATION JAVASCRIPT
// Editorial Botanical Theme ("Regal Crest" Reference Style)
// Handles Leaflet Map, Charts, Prediction Form & API interactions

document.addEventListener("DOMContentLoaded", () => {
  // 1. TAB SWITCHING (Syncs Floating Pill Nav & Workspace Tab Bar)
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      if (!tabId) return;

      tabButtons.forEach((b) => {
        if (b.getAttribute("data-tab") === tabId) {
          b.classList.add("active");
        } else {
          b.classList.remove("active");
        }
      });

      tabPanes.forEach((p) => p.classList.remove("active"));
      const targetPane = document.getElementById(tabId);
      if (targetPane) {
        targetPane.classList.add("active");
      }

      const scrollTarget = btn.getAttribute("data-scroll");
      if (scrollTarget) {
        const el = document.querySelector(scrollTarget);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      if (tabId === "tabMap" && map) {
        setTimeout(() => map.invalidateSize(), 220);
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

  // 3. LEAFLET MAP & GEOPANDAS BOUNDARY (Botanical / Terrain Aesthetic)
  let map = null;
  let geoJsonLayer = null;
  let markerCluster = null;

  function initMap() {
    const mapContainer = document.getElementById("mapContainer");
    if (!mapContainer) return;

    map = L.map("mapContainer", {
      center: [-1.43, 121.4456],
      zoom: 7,
      zoomControl: true,
    });

    if (window.MAP_API_KEY) {
      L.tileLayer(
        `https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=${window.MAP_API_KEY}`,
        {
          attribution:
            '&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
          maxZoom: 18,
          id: "mapbox/outdoors-v12",
          tileSize: 512,
          zoomOffset: -1,
        },
      ).addTo(map);
    } else {
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
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

    if (!geoJsonLayer) {
      try {
        const resB = await fetch("/api/geojson/boundary");
        const geoJsonData = await resB.json();

        geoJsonLayer = L.geoJSON(geoJsonData, {
          style: {
            color: "#344726",
            weight: 2,
            fillColor: "#344726",
            fillOpacity: 0.14,
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

    try {
      const resP = await fetch(
        `/api/weather-points?kabupaten=${kabupaten}&risk=${risk}&limit=2000`,
      );
      const dataP = await resP.json();

      markerCluster.clearLayers();

      const colorMap = {
        Tinggi: "#B83B2B",
        Sedang: "#C47A1B",
        Rendah: "#344726",
      };

      dataP.points.forEach((pt) => {
        const color = colorMap[pt.kategori_risiko] || "#344726";

        const marker = L.circleMarker([pt.latitude, pt.longitude], {
          radius: 6,
          color: "#FAF8F2",
          fillColor: color,
          fillOpacity: 0.9,
          weight: 1.5,
        });

        const popupHtml = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; color: #212E18; min-width: 220px; line-height: 1.5;">
            <div style="font-family: 'Cormorant Garamond', serif; font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: #212E18; margin-bottom: 2px;">
              ${pt.kecamatan}
            </div>
            <div style="font-size: 11.5px; color: #5A6451; margin-bottom: 10px;">
              Desa ${pt.desa} • ${pt.kabupaten}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px; background: #F3EFE4; padding: 9px 11px; border-radius: 12px; margin-bottom: 10px; border: 1px solid #DED9C8;">
              <div><span style="color: #5A6451;">Suhu:</span> <b>${pt.suhu} °C</b></div>
              <div><span style="color: #5A6451;">Lembap:</span> <b>${pt.kelembapan}%</b></div>
              <div><span style="color: #5A6451;">Awan:</span> <b>${pt.tutupan_awan}%</b></div>
              <div><span style="color: #5A6451;">Cuaca:</span> <b>${pt.cuaca}</b></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #DED9C8; padding-top: 8px;">
              <span style="font-size: 11px; color: #5A6451;">Status Risiko:</span>
              <span style="font-weight: 600; color: #FAF8F2; font-size: 11px; background: ${color}; padding: 3px 11px; border-radius: 9999px;">
                ${pt.kategori_risiko}
              </span>
            </div>
          </div>
        `;

        marker.bindPopup(popupHtml);
        marker.bindTooltip(`${pt.kecamatan}: ${pt.kategori_risiko}`);
        markerCluster.addLayer(marker);
      });

      if (markerCluster.getLayers().length > 0) {
        if (kabupaten !== "all") {
          map.fitBounds(markerCluster.getBounds().pad(0.15));
        } else {
          map.setView([-1.43, 121.4456], 7);
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

  const predForm = document.getElementById("predictionForm");

  document.querySelectorAll(".btn-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = btn.getAttribute("data-preset");
      if (!preset) return;

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

      sliders.forEach((item) => {
        const el = document.getElementById(item.id);
        const lbl = document.getElementById(item.lbl);
        if (el && lbl) lbl.textContent = el.value;
      });

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
                <b>Indikasi Spasial:</b> Tingkat kerawanan genangan dan luapan air tinggi berdasarkan kelembapan jenuh serta intensitas presipitasi.
              </p>
              <p style="font-size: 12px; margin-top: 4px; opacity: 0.9;">
                Rekomendasi Operasional: Pantau debit sungai utama, siagakan posko darurat, dan pastikan jalur evakuasi warga bebas hambatan.
              </p>
            </div>
          `;
        } else if (pred === "Sedang") {
          badgeBox.innerHTML = `
            <div class="status-card sedang">
              <h2>STATUS: WASPADA BANJIR SEDANG</h2>
              <p>
                <b>Indikasi Spasial:</b> Potensi genangan pada cekungan drainase rendah akibat kelembapan udara yang meningkat.
              </p>
              <p style="font-size: 12px; margin-top: 4px; opacity: 0.9;">
                Rekomendasi Operasional: Periksa kelancaran saluran drainase sekunder dan pantau pembaruan data satelit cuaca.
              </p>
            </div>
          `;
        } else {
          badgeBox.innerHTML = `
            <div class="status-card rendah">
              <h2>STATUS: AMAN DARI RISIKO BANJIR</h2>
              <p>
                <b>Indikasi Spasial:</b> Parameter atmosfer dan kelembapan berada pada rentang stabil dengan potensi genangan minimal.
              </p>
              <p style="font-size: 12px; margin-top: 4px; opacity: 0.9;">
                Rekomendasi Operasional: Kondisi hidrometeorologi kondusif, lanjutkan pemantauan rutin berkala.
              </p>
            </div>
          `;
        }

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

  // 5. CHART.JS ANALYTICS DASHBOARD (Editorial Botanical Palette)
  let chartKab = null;
  let chartWeather = null;
  let chartFI = null;

  async function loadAnalytics() {
    try {
      const res = await fetch("/api/analytics");
      const data = await res.json();

      Chart.defaults.color = "#5A6451";
      Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";

      const ctxKab = document.getElementById("chartKabupaten");
      if (ctxKab) {
        if (chartKab) chartKab.destroy();
        chartKab = new Chart(ctxKab, {
          type: "bar",
          data: {
            labels: data.kabupaten_risk.categories,
            datasets: [
              {
                label: "Tinggi (Siaga)",
                data: data.kabupaten_risk.tinggi,
                backgroundColor: "#B83B2B",
                borderRadius: 6,
              },
              {
                label: "Sedang (Waspada)",
                data: data.kabupaten_risk.sedang,
                backgroundColor: "#C47A1B",
                borderRadius: 6,
              },
              {
                label: "Rendah (Aman)",
                data: data.kabupaten_risk.rendah,
                backgroundColor: "#344726",
                borderRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            scales: {
              x: {
                stacked: true,
                grid: { color: "rgba(33, 46, 24, 0.08)" },
              },
              y: {
                stacked: true,
                grid: { color: "rgba(33, 46, 24, 0.08)" },
              },
            },
            plugins: {
              legend: {
                position: "top",
                labels: { color: "#212E18", boxWidth: 12, padding: 14 },
              },
            },
          },
        });
      }

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
                  "#344726",
                  "#5C7646",
                  "#C47A1B",
                  "#B83B2B",
                  "#8C9B7A",
                  "#223018",
                ],
                borderWidth: 2,
                borderColor: "#F3EFE4",
              },
            ],
          },
          options: {
            responsive: true,
            plugins: {
              legend: {
                position: "right",
                labels: { color: "#212E18", boxWidth: 12, padding: 12 },
              },
            },
          },
        });
      }

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
                label: "Tingkat Pengaruh Fitur (Feature Importance)",
                data: fiVals,
                backgroundColor: "#344726",
                borderRadius: 8,
              },
            ],
          },
          options: {
            indexAxis: "y",
            responsive: true,
            scales: {
              x: { grid: { color: "rgba(33, 46, 24, 0.08)" } },
              y: { grid: { display: false } },
            },
            plugins: {
              legend: { labels: { color: "#212E18" } },
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
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: #5A6451;">Tidak ada data yang cocok dengan kriteria pencarian.</td></tr>`;
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
