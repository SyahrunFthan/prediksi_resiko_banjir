document.addEventListener("DOMContentLoaded", () => {
  let currentDataset = "dataset_cuaca_sulawesi_tengah.csv";
  let currentPage = 1;
  let map = null;
  let geoJsonLayer = null;
  let markerCluster = null;
  let chartKab = null;
  let chartWeather = null;
  let chartFI = null;
  let kabupatenElevations = {};

  const FEATURE_LABELS = {
    curah_hujan: "Curah Hujan Harian (mm)",
    presipitasi: "Presipitasi Total (mm)",
    durasi_hujan: "Durasi Hujan (Jam)",
    hujan_3hari: "Akumulasi Hujan 3 Hari (mm)",
    hujan_7hari: "Akumulasi Hujan 7 Hari (mm)",
    kelembapan: "Kelembapan Udara (%)",
    tutupan_awan: "Tutupan Awan (%)",
    kode_cuaca: "Kode Kondisi Cuaca",
    suhu: "Suhu Udara (°C)",
    kecepatan_angin: "Kecepatan Angin Rata-rata (km/h)",
    angin_maks: "Kecepatan Angin Maksimum (km/h)",
    elevasi: "Elevasi Grid (mdpl)",
    latitude: "Garis Lintang (Lat)",
    longitude: "Garis Bujur (Lon)",
    bulan: "Bulan Kalender",
    jam: "Jam Pemantauan",
  };

  function getSelectedDataset() {
    const sel = document.getElementById("filterDataset");
    return sel ? sel.value : currentDataset;
  }

  function syncDatasetSelectors(newDataset) {
    currentDataset = newDataset;
    const filterSel = document.getElementById("filterDataset");
    const topSel = document.getElementById("topDatasetSelect");
    if (filterSel && filterSel.value !== newDataset) {
      filterSel.value = newDataset;
    }
    if (topSel && topSel.value !== newDataset) {
      topSel.value = newDataset;
    }
    const exportBtn = document.getElementById("btnExportCsv");
    if (exportBtn) {
      exportBtn.href = `/api/export-csv?dataset=${encodeURIComponent(newDataset)}`;
    }
  }

  // Sync top pill navbar and workspace tab bar
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

  function updateElevasiFromKabupaten(kabName) {
    const elevInput = document.getElementById("pElevasi");
    const elevLbl = document.getElementById("valElevasiLbl");
    if (!elevInput || !kabName) return;
    if (Object.prototype.hasOwnProperty.call(kabupatenElevations, kabName)) {
      const elevVal = Math.round(Number(kabupatenElevations[kabName]) || 45);
      elevInput.value = elevVal;
      if (elevLbl) elevLbl.textContent = elevVal;
    }
  }

  async function loadSummary(
    kabupaten = "all",
    risk = "all",
    forceKabRefresh = false,
  ) {
    const ds = getSelectedDataset();
    try {
      const res = await fetch(
        `/api/summary?dataset=${encodeURIComponent(ds)}&kabupaten=${encodeURIComponent(kabupaten)}&risk=${encodeURIComponent(risk)}`,
      );
      const data = await res.json();

      const total = data.total_data ?? data.total_records ?? 0;
      const high = data.high_risk_count ?? data.high_count ?? 0;
      const med = data.med_risk_count ?? data.med_count ?? 0;
      const low = data.low_risk_count ?? data.low_count ?? 0;
      const highPct = data.high_pct ?? 0;
      const medPct = data.med_pct ?? 0;
      const lowPct = data.low_pct ?? 0;
      const meta = data.dataset_meta || {};
      const dsType = meta.type || "csv";
      const isXlsx = dsType === "xlsx_banjir" || dsType === "xlsx_historis";

      if (data.kabupaten_elevations) {
        kabupatenElevations = data.kabupaten_elevations;
      }

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

      const descEl = document.getElementById("summaryDatasetDesc");
      if (descEl && meta.description) {
        descEl.textContent = meta.description;
      }

      const activeBadge = document.getElementById("activeDatasetBadge");
      if (activeBadge && meta.source) {
        activeBadge.textContent = `${meta.source} • Akurasi RF: ${meta.accuracy ?? 95}%`;
      }

      const predBadge = document.getElementById("predictModelBadge");
      if (predBadge) {
        predBadge.textContent = `Model Aktif: ${meta.short_label || data.dataset_key || ds} (Akurasi: ${meta.accuracy ?? 95}%)`;
      }

      const kpiCaption = document.getElementById("kpiTotalCaption");
      const kpiSubcaption = document.getElementById("kpiTotalSubcaption");
      if (dsType === "xlsx_banjir") {
        if (kpiCaption) kpiCaption.textContent = "Kejadian Banjir Historis";
        if (kpiSubcaption)
          kpiSubcaption.textContent = "Sheet 1: Banjir_dan_Cuaca (37 Kolom)";
      } else if (dsType === "xlsx_historis") {
        if (kpiCaption) kpiCaption.textContent = "Rekaman Harian ECMWF IFS";
        if (kpiSubcaption)
          kpiSubcaption.textContent = "Sheet 2: Cuaca_Historis (2019-2026)";
      } else {
        if (kpiCaption) kpiCaption.textContent = "Titik Pantau Cuaca";
        if (kpiSubcaption)
          kpiSubcaption.textContent = "Cakupan Desa Sulawesi Tengah";
      }

      const impactBanner = document.getElementById("xlsxImpactBanner");
      if (impactBanner) {
        if (isXlsx) {
          impactBanner.classList.remove("hidden");
          const sheetTag = document.getElementById("xlsxSheetTag");
          if (sheetTag) {
            sheetTag.textContent =
              dsType === "xlsx_banjir"
                ? "Sheet 1: Banjir_dan_Cuaca (37 Kolom)"
                : "Sheet 2: Cuaca_Historis (18 Kolom)";
          }
          const elTerendam = document.getElementById("valRumahTerendam");
          if (elTerendam) {
            elTerendam.textContent = Number(
              data.total_rumah_terendam ?? 0,
            ).toLocaleString();
          }
          const elRusak = document.getElementById("valRumahRusak");
          if (elRusak) {
            elRusak.textContent = Number(
              data.total_rumah_rusak ?? 0,
            ).toLocaleString();
          }
          const elFasum = document.getElementById("valFasumRusak");
          if (elFasum) {
            elFasum.textContent = Number(
              data.total_fasum_rusak ?? 0,
            ).toLocaleString();
          }
          const elAvgHujan = document.getElementById("valAvgHujan");
          if (elAvgHujan) {
            elAvgHujan.textContent = `${data.avg_curah_hujan ?? 0} mm (${data.avg_hujan_3hari ?? 0} mm / 3H)`;
          }
        } else {
          impactBanner.classList.add("hidden");
        }
      }

      const xlsxSimFields = document.getElementById("xlsxSimFields");
      if (xlsxSimFields) {
        if (isXlsx) {
          xlsxSimFields.classList.remove("hidden");
        } else {
          xlsxSimFields.classList.add("hidden");
        }
      }

      const selectKab = document.getElementById("filterKabupaten");
      const selectPKab = document.getElementById("pKabupaten");
      const kabList = data.kabupaten_list ?? data.kabupaten_options ?? [];

      if (
        selectKab &&
        (forceKabRefresh || selectKab.options.length <= 1) &&
        Array.isArray(kabList)
      ) {
        const prevKab = selectKab.value;
        selectKab.innerHTML = `<option value="all">Semua Kabupaten/Kota (${kabList.length} Wilayah)</option>`;
        if (selectPKab) {
          selectPKab.innerHTML = "";
        }

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

        if (prevKab !== "all" && kabList.includes(prevKab)) {
          selectKab.value = prevKab;
        }
        if (selectPKab && selectPKab.value) {
          updateElevasiFromKabupaten(selectPKab.value);
        }
      }
    } catch (err) {
      console.error("Error loading summary stats:", err);
    }
  }

  const pKabSelect = document.getElementById("pKabupaten");
  if (pKabSelect) {
    pKabSelect.addEventListener("change", (e) => {
      updateElevasiFromKabupaten(e.target.value);
    });
  }

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
    const ds = getSelectedDataset();

    if (!geoJsonLayer) {
      try {
        const resB = await fetch(
          `/api/geojson/boundary?dataset=${encodeURIComponent(ds)}`,
        );
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
        `/api/weather-points?dataset=${encodeURIComponent(ds)}&kabupaten=${encodeURIComponent(kabupaten)}&risk=${encodeURIComponent(risk)}&limit=2000`,
      );
      const dataP = await resP.json();

      markerCluster.clearLayers();

      const colorMap = {
        Tinggi: "#B83B2B",
        Sedang: "#C47A1B",
        Rendah: "#344726",
      };

      const dsType = dataP.dataset_type || "csv";
      const isXlsx = dsType === "xlsx_banjir" || dsType === "xlsx_historis";

      dataP.points.forEach((pt) => {
        const color = colorMap[pt.kategori_risiko] || "#344726";

        const marker = L.circleMarker([pt.latitude, pt.longitude], {
          radius: 6,
          color: "#FAF8F2",
          fillColor: color,
          fillOpacity: 0.9,
          weight: 1.5,
        });

        const extraRowsHtml = isXlsx
          ? `
            <div><span style="color: #5A6451;">Curah Hujan:</span> <b>${pt.curah_hujan} mm</b></div>
            <div><span style="color: #5A6451;">Presipitasi:</span> <b>${pt.presipitasi} mm</b></div>
            <div><span style="color: #5A6451;">Durasi:</span> <b>${pt.durasi_hujan} jam</b></div>
            <div><span style="color: #5A6451;">Hujan 3H/7H:</span> <b>${pt.hujan_3hari}/${pt.hujan_7hari} mm</b></div>
            <div><span style="color: #5A6451;">Angin Maks:</span> <b>${pt.angin_maks} km/h</b></div>
            <div><span style="color: #5A6451;">Elevasi:</span> <b>${pt.elevasi} mdpl</b></div>
            <div><span style="color: #5A6451;">Terendam:</span> <b>${Number(pt.rumah_terendam || 0).toLocaleString()} unit</b></div>
            <div><span style="color: #5A6451;">Tanggal:</span> <b>${pt.tanggal}</b></div>
          `
          : `
            <div><span style="color: #5A6451;">Awan:</span> <b>${pt.tutupan_awan}%</b></div>
            <div><span style="color: #5A6451;">Angin:</span> <b>${pt.kecepatan_angin} km/h</b></div>
          `;

        const penyebabLine =
          isXlsx && pt.penyebab && pt.penyebab !== "-"
            ? `<div style="font-size: 11px; color: #5A6451; margin-bottom: 8px;"><b>Penyebab:</b> ${pt.penyebab}</div>`
            : "";

        const popupHtml = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; color: #212E18; min-width: 255px; line-height: 1.5;">
            <div style="font-family: 'Cormorant Garamond', serif; font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: #212E18; margin-bottom: 2px;">
              ${pt.kecamatan}
            </div>
            <div style="font-size: 11.5px; color: #5A6451; margin-bottom: 6px;">
              ${pt.desa} • ${pt.kabupaten}
            </div>
            ${penyebabLine}
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11.5px; background: #F3EFE4; padding: 9px 11px; border-radius: 12px; margin-bottom: 10px; border: 1px solid #DED9C8;">
              <div><span style="color: #5A6451;">Suhu:</span> <b>${pt.suhu} °C</b></div>
              <div><span style="color: #5A6451;">Lembap:</span> <b>${pt.kelembapan}%</b></div>
              <div><span style="color: #5A6451;">Cuaca:</span> <b>${pt.cuaca}</b></div>
              <div><span style="color: #5A6451;">Skor:</span> <b>${pt.risk_score}</b></div>
              ${extraRowsHtml}
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
        marker.bindTooltip(`${pt.kabupaten} (${pt.desa}): ${pt.kategori_risiko}`);
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

  const sliders = [
    { id: "pSuhu", lbl: "valSuhuLbl" },
    { id: "pKelembapan", lbl: "valKelembapanLbl" },
    { id: "pAwan", lbl: "valAwanLbl" },
    { id: "pAngin", lbl: "valAnginLbl" },
    { id: "pCurahHujan", lbl: "valCurahHujanLbl" },
    { id: "pJam", lbl: "valJamLbl" },
    { id: "pBulan", lbl: "valBulanLbl" },
    { id: "pDurasiHujan", lbl: "valDurasiHujanLbl" },
    { id: "pPresipitasi", lbl: "valPresipitasiLbl" },
    { id: "pHujan3H", lbl: "valHujan3HLbl" },
    { id: "pHujan7H", lbl: "valHujan7HLbl" },
    { id: "pAnginMaks", lbl: "valAnginMaksLbl" },
    { id: "pElevasi", lbl: "valElevasiLbl" },
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
        document.getElementById("pSuhu").value = 24;
        document.getElementById("pKelembapan").value = 95;
        document.getElementById("pAwan").value = 96;
        document.getElementById("pAngin").value = 28;
        document.getElementById("pKodeCuaca").value = 65;
        if (document.getElementById("pCurahHujan"))
          document.getElementById("pCurahHujan").value = 68;
        if (document.getElementById("pDurasiHujan"))
          document.getElementById("pDurasiHujan").value = 20;
        if (document.getElementById("pPresipitasi"))
          document.getElementById("pPresipitasi").value = 72;
        if (document.getElementById("pHujan3H"))
          document.getElementById("pHujan3H").value = 115;
        if (document.getElementById("pHujan7H"))
          document.getElementById("pHujan7H").value = 195;
        if (document.getElementById("pAnginMaks"))
          document.getElementById("pAnginMaks").value = 38;
      } else if (preset === "sedang") {
        document.getElementById("pSuhu").value = 26;
        document.getElementById("pKelembapan").value = 84;
        document.getElementById("pAwan").value = 80;
        document.getElementById("pAngin").value = 15;
        document.getElementById("pKodeCuaca").value = 61;
        if (document.getElementById("pCurahHujan"))
          document.getElementById("pCurahHujan").value = 18;
        if (document.getElementById("pDurasiHujan"))
          document.getElementById("pDurasiHujan").value = 11;
        if (document.getElementById("pPresipitasi"))
          document.getElementById("pPresipitasi").value = 19;
        if (document.getElementById("pHujan3H"))
          document.getElementById("pHujan3H").value = 42;
        if (document.getElementById("pHujan7H"))
          document.getElementById("pHujan7H").value = 88;
        if (document.getElementById("pAnginMaks"))
          document.getElementById("pAnginMaks").value = 21;
      } else if (preset === "aman") {
        document.getElementById("pSuhu").value = 31;
        document.getElementById("pKelembapan").value = 62;
        document.getElementById("pAwan").value = 25;
        document.getElementById("pAngin").value = 8;
        document.getElementById("pKodeCuaca").value = 1;
        if (document.getElementById("pCurahHujan"))
          document.getElementById("pCurahHujan").value = 1;
        if (document.getElementById("pDurasiHujan"))
          document.getElementById("pDurasiHujan").value = 1;
        if (document.getElementById("pPresipitasi"))
          document.getElementById("pPresipitasi").value = 1;
        if (document.getElementById("pHujan3H"))
          document.getElementById("pHujan3H").value = 5;
        if (document.getElementById("pHujan7H"))
          document.getElementById("pHujan7H").value = 14;
        if (document.getElementById("pAnginMaks"))
          document.getElementById("pAnginMaks").value = 12;
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

      const curahVal = parseFloat(
        document.getElementById("pCurahHujan")?.value || 15,
      );
      const presipVal = parseFloat(
        document.getElementById("pPresipitasi")?.value || curahVal,
      );

      const payload = {
        dataset: getSelectedDataset(),
        kabupaten: document.getElementById("pKabupaten")?.value || "all",
        suhu: parseFloat(document.getElementById("pSuhu").value),
        kelembapan: parseFloat(document.getElementById("pKelembapan").value),
        tutupan_awan: parseFloat(document.getElementById("pAwan").value),
        kecepatan_angin: parseFloat(document.getElementById("pAngin").value),
        angin_maks: parseFloat(
          document.getElementById("pAnginMaks")?.value || 18,
        ),
        kode_cuaca: parseFloat(document.getElementById("pKodeCuaca").value),
        jam: parseFloat(document.getElementById("pJam").value),
        bulan: parseFloat(document.getElementById("pBulan").value),
        curah_hujan: curahVal,
        presipitasi: presipVal,
        durasi_hujan: parseFloat(
          document.getElementById("pDurasiHujan")?.value || 8,
        ),
        hujan_3hari: parseFloat(
          document.getElementById("pHujan3H")?.value || 35,
        ),
        hujan_7hari: parseFloat(
          document.getElementById("pHujan7H")?.value || 75,
        ),
        elevasi: parseFloat(document.getElementById("pElevasi")?.value || 45),
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
        const probs = result.probabilities || {};
        const featCount = Array.isArray(result.features_used)
          ? result.features_used.length
          : 7;

        if (pred === "Tinggi") {
          badgeBox.innerHTML = `
            <div class="status-card tinggi">
              <h2>STATUS: SIAGA BANJIR TINGGI</h2>
              <p>
                <b>Indikasi Spasial (${result.dataset_key} • ${featCount} Fitur):</b> Tingkat kerawanan genangan dan luapan sungai tinggi berdasarkan akumulasi presipitasi dan kelembapan jenuh.
              </p>
              <p style="font-size: 12px; margin-top: 4px; opacity: 0.9;">
                Rekomendasi Operasional: Pantau debit sungai utama, siagakan posko darurat BPBD, dan pastikan jalur evakuasi warga bebas hambatan.
              </p>
            </div>
          `;
        } else if (pred === "Sedang") {
          badgeBox.innerHTML = `
            <div class="status-card sedang">
              <h2>STATUS: WASPADA BANJIR SEDANG</h2>
              <p>
                <b>Indikasi Spasial (${result.dataset_key} • ${featCount} Fitur):</b> Potensi genangan pada cekungan drainase rendah akibat kelembapan udara dan durasi hujan moderat.
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
                <b>Indikasi Spasial (${result.dataset_key} • ${featCount} Fitur):</b> Parameter atmosfer dan akumulasi hujan berada pada rentang stabil dengan potensi genangan minimal.
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

  async function loadAnalytics() {
    const ds = getSelectedDataset();
    try {
      const res = await fetch(
        `/api/analytics?dataset=${encodeURIComponent(ds)}`,
      );
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
                  "#A36327",
                  "#6E8458",
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
        const rawEntries = Object.entries(data.feature_importances || {}).sort(
          (a, b) => b[1] - a[1],
        );
        const fiKeys = rawEntries.map(([k]) => FEATURE_LABELS[k] || k);
        const fiVals = rawEntries.map(([, v]) => v);

        chartFI = new Chart(ctxFI, {
          type: "bar",
          data: {
            labels: fiKeys,
            datasets: [
              {
                label: `Tingkat Pengaruh Fitur (${data.dataset_key})`,
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

  async function loadTableData(page = 1, search = "") {
    const ds = getSelectedDataset();
    const kab = document.getElementById("filterKabupaten")?.value || "all";
    const risk = document.getElementById("filterRisk")?.value || "all";
    const thead = document.getElementById("tableHead");
    const tbody = document.getElementById("tableBody");

    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: #5A6451;">Memuat data observasi dari ${ds}...</td></tr>`;
    }

    try {
      const res = await fetch(
        `/api/table-data?dataset=${encodeURIComponent(ds)}&page=${page}&limit=12&kabupaten=${encodeURIComponent(kab)}&risk=${encodeURIComponent(risk)}&search=${encodeURIComponent(search)}`,
      );
      const data = await res.json();

      if (!tbody) return;
      tbody.innerHTML = "";

      const dsType = data.dataset_type || "csv";

      if (thead) {
        if (dsType === "xlsx_banjir") {
          thead.innerHTML = `
            <tr>
              <th>Tanggal &amp; Kode</th>
              <th>Kabupaten/Kota</th>
              <th>Lokasi &amp; Elevasi</th>
              <th>Suhu (Rata2 / Min-Maks)</th>
              <th>Lembap &amp; Awan</th>
              <th>Hujan &amp; Presipitasi</th>
              <th>Akumulasi 3H &amp; 7H</th>
              <th>Dampak Bencana (BNPB)</th>
              <th>Risiko &amp; Skor</th>
            </tr>
          `;
        } else if (dsType === "xlsx_historis") {
          thead.innerHTML = `
            <tr>
              <th>Tanggal Harian</th>
              <th>Kabupaten/Kota</th>
              <th>Grid &amp; Elevasi</th>
              <th>Suhu (Rata2 / Min-Maks)</th>
              <th>Lembap &amp; Awan</th>
              <th>Hujan &amp; Presipitasi</th>
              <th>Akumulasi 3H &amp; 7H</th>
              <th>Angin &amp; Cuaca ECMWF</th>
              <th>Risiko &amp; Skor</th>
            </tr>
          `;
        } else {
          thead.innerHTML = `
            <tr>
              <th>Kabupaten/Kota</th>
              <th>Kecamatan</th>
              <th>Desa/Kelurahan</th>
              <th>Suhu (°C)</th>
              <th>Kelembapan (%)</th>
              <th>Awan &amp; Angin</th>
              <th>Deskripsi Cuaca</th>
              <th>Risiko Banjir</th>
              <th>Skor Risiko</th>
            </tr>
          `;
        }
      }

      if (!data.rows || data.rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: #5A6451;">Tidak ada baris yang cocok pada dataset ${ds}. Ubah filter wilayah atau kata kunci pencarian untuk menampilkan data kembali.</td></tr>`;
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

        if (dsType === "xlsx_banjir") {
          const penyebabShort =
            r.penyebab && r.penyebab !== "-"
              ? `<div style="font-size:11px; color:#5A6451; max-width:210px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${r.penyebab}">${r.penyebab}</div>`
              : "";
          tr.innerHTML = `
            <td>
              <b>${r.local_datetime}</b>
              <div style="font-size:11px; color:#5A6451;">ID Kab: ${r.id_kabupaten || "-"}</div>
            </td>
            <td>
              <b>${r.kabupaten_kota}</b>
              <div style="font-size:11px; color:#5A6451;">${r.kecamatan}</div>
            </td>
            <td>
              <div>${r.desa_kelurahan}</div>
              <div style="font-size:11px; color:#5A6451;">Elevasi: ${r.elevasi} mdpl</div>
            </td>
            <td>
              <b>${r.suhu} °C</b>
              <div style="font-size:11px; color:#5A6451;">${r.suhu_min} - ${r.suhu_maks} °C</div>
            </td>
            <td>
              <b>${r.kelembapan}%</b>
              <div style="font-size:11px; color:#5A6451;">Awan: ${r.tutupan_awan}%</div>
            </td>
            <td>
              <b>${r.curah_hujan} mm</b>
              <div style="font-size:11px; color:#5A6451;">Presip: ${r.presipitasi} mm (${r.durasi_hujan} jam)</div>
            </td>
            <td>
              <b>3H: ${r.hujan_3hari} mm</b>
              <div style="font-size:11px; color:#5A6451;">7H: ${r.hujan_7hari} mm • Angin: ${r.angin_maks} km/h</div>
            </td>
            <td>
              <b>${Number(r.rumah_terendam || 0).toLocaleString()} terendam</b>
              <div style="font-size:11px; color:#5A6451;">${r.rumah_rusak || 0} rusak • ${r.fasum_rusak || 0} fasum</div>
              ${penyebabShort}
            </td>
            <td>
              <span class="badge ${badgeClass}">${r.kategori_risiko}</span>
              <div style="margin-top:4px;"><code>Skor: ${r.risk_score}</code></div>
            </td>
          `;
        } else if (dsType === "xlsx_historis") {
          const floodNote =
            r.rumah_terendam > 0 || (r.penyebab && !r.penyebab.includes("Tidak ada"))
              ? `<div style="font-size:11px; color:#B83B2B; font-weight:600;">Banjir BNPB (${Number(r.rumah_terendam || 0).toLocaleString()} rumah)</div>`
              : `<div style="font-size:11px; color:#5A6451;">${r.deskripsi_cuaca}</div>`;
          tr.innerHTML = `
            <td><b>${r.local_datetime}</b></td>
            <td><b>${r.kabupaten_kota}</b></td>
            <td>
              <div>${r.desa_kelurahan}</div>
              <div style="font-size:11px; color:#5A6451;">Elevasi: ${r.elevasi} mdpl</div>
            </td>
            <td>
              <b>${r.suhu} °C</b>
              <div style="font-size:11px; color:#5A6451;">${r.suhu_min} - ${r.suhu_maks} °C</div>
            </td>
            <td>
              <b>${r.kelembapan}%</b>
              <div style="font-size:11px; color:#5A6451;">Awan: ${r.tutupan_awan}%</div>
            </td>
            <td>
              <b>${r.curah_hujan} mm</b>
              <div style="font-size:11px; color:#5A6451;">Presip: ${r.presipitasi} mm (${r.durasi_hujan} jam)</div>
            </td>
            <td>
              <b>3H: ${r.hujan_3hari} mm</b>
              <div style="font-size:11px; color:#5A6451;">7H: ${r.hujan_7hari} mm</div>
            </td>
            <td>
              <b>${r.kecepatan_angin} / ${r.angin_maks} km/h</b>
              ${floodNote}
            </td>
            <td>
              <span class="badge ${badgeClass}">${r.kategori_risiko}</span>
              <div style="margin-top:4px;"><code>Skor: ${r.risk_score}</code></div>
            </td>
          `;
        } else {
          tr.innerHTML = `
            <td><b>${r.kabupaten_kota}</b></td>
            <td>${r.kecamatan}</td>
            <td>${r.desa_kelurahan}</td>
            <td>${r.suhu} °C</td>
            <td>${r.kelembapan}%</td>
            <td>${r.tutupan_awan}% • ${r.kecepatan_angin} km/h</td>
            <td>${r.deskripsi_cuaca}</td>
            <td><span class="badge ${badgeClass}">${r.kategori_risiko}</span></td>
            <td><code>${r.risk_score}</code></td>
          `;
        }
        tbody.appendChild(tr);
      });

      currentPage = data.page;
      document.getElementById("pageInfo").textContent =
        `Halaman ${data.page} dari ${data.total_pages} (${data.total.toLocaleString()} data • ${ds})`;
    } catch (err) {
      console.error("Error loading table data:", err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: #B83B2B;">Gagal memuat data tabel dari server. Klik Terapkan Filter Spasial untuk mencoba kembali.</td></tr>`;
      }
    }
  }

  async function handleDatasetSwitch(newDataset) {
    syncDatasetSelectors(newDataset);
    const kab = document.getElementById("filterKabupaten")?.value || "all";
    const risk = document.getElementById("filterRisk")?.value || "all";
    const searchVal = document.getElementById("tableSearch")?.value || "";

    await loadSummary(kab, risk, true);
    loadMapData(kab, risk);
    loadAnalytics();
    loadTableData(1, searchVal);

    const resultBox = document.getElementById("resultBox");
    if (resultBox && !resultBox.classList.contains("hidden") && predForm) {
      predForm.dispatchEvent(new Event("submit"));
    }
  }

  const filterDatasetEl = document.getElementById("filterDataset");
  if (filterDatasetEl) {
    filterDatasetEl.addEventListener("change", (e) => {
      handleDatasetSwitch(e.target.value);
    });
  }

  const topDatasetEl = document.getElementById("topDatasetSelect");
  if (topDatasetEl) {
    topDatasetEl.addEventListener("change", (e) => {
      handleDatasetSwitch(e.target.value);
    });
  }

  document.getElementById("btnApplyFilter").addEventListener("click", () => {
    const ds = getSelectedDataset();
    syncDatasetSelectors(ds);
    const kab = document.getElementById("filterKabupaten").value;
    const risk = document.getElementById("filterRisk").value;
    loadSummary(kab, risk);
    loadMapData(kab, risk);
    loadTableData(1, document.getElementById("tableSearch").value);
  });

  document.querySelectorAll("[data-risk-card]").forEach((card) => {
    const activateCardFilter = () => {
      const targetRisk = card.getAttribute("data-risk-card") || "all";
      const riskSelect = document.getElementById("filterRisk");
      if (riskSelect) {
        riskSelect.value = targetRisk;
      }
      const kab = document.getElementById("filterKabupaten")?.value || "all";
      loadSummary(kab, targetRisk);
      loadMapData(kab, targetRisk);
      loadTableData(1, document.getElementById("tableSearch")?.value || "");
      const ws = document.getElementById("secWorkspace");
      if (ws) ws.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    card.addEventListener("click", activateCardFilter);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activateCardFilter();
      }
    });
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

  syncDatasetSelectors(currentDataset);
  loadSummary("all", "all", true);
  initMap();
  loadAnalytics();
  loadTableData();
});
