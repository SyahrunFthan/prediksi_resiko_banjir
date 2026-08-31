document.addEventListener('DOMContentLoaded', () => {
    // Global State
    let map = null;
    let geoJsonLayer = null;
    let markerCluster = null;
    let chartKab = null;
    let chartWeather = null;
    let chartFI = null;

    let currentPage = 1;
    const perPage = 25;

    // 1. TAB NAVIGATION
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');

            if (tabId === 'tabMap' && map) {
                setTimeout(() => map.invalidateSize(), 200);
            }
        });
    });

    // 2. INITIALIZE SUMMARY METRICS & DROPDOWNS
    async function loadSummary(kabupaten = 'all', risk = 'all') {
        try {
            const res = await fetch(`/api/summary?kabupaten=${kabupaten}&risk=${risk}`);
            const data = await res.json();

            document.getElementById('valTotalData').textContent = data.total_records.toLocaleString();
            document.getElementById('valHighRisk').textContent = data.high_count.toLocaleString();
            document.getElementById('pctHighRisk').textContent = `${data.high_pct}%`;

            document.getElementById('valMedRisk').textContent = data.med_count.toLocaleString();
            document.getElementById('pctMedRisk').textContent = `${data.med_pct}%`;

            document.getElementById('valLowRisk').textContent = data.low_count.toLocaleString();
            document.getElementById('pctLowRisk').textContent = `${data.low_pct}%`;

            // Populate Kabupaten dropdowns if not populated yet
            const selectKab = document.getElementById('filterKabupaten');
            const selectPKab = document.getElementById('pKabupaten');

            if (selectKab.options.length <= 1 && data.kabupaten_options) {
                data.kabupaten_options.forEach(kab => {
                    const opt1 = document.createElement('option');
                    opt1.value = kab;
                    opt1.textContent = kab;
                    selectKab.appendChild(opt1);

                    const opt2 = document.createElement('option');
                    opt2.value = kab;
                    opt2.textContent = kab;
                    selectPKab.appendChild(opt2);
                });
            }
        } catch (err) {
            console.error('Error loading summary stats:', err);
        }
    }

    // 3. LEAFLET MAP & GEOPANDAS BOUNDARY
    function initMap() {
        const mapContainer = document.getElementById('mapContainer');
        if (!mapContainer) return;

        map = L.map('mapContainer', {
            center: [-1.4300, 121.4456],
            zoom: 8,
            zoomControl: true
        });

        // Dark cartodb tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            maxZoom: 18
        }).addTo(map);

        markerCluster = L.markerClusterGroup({
            maxClusterRadius: 40
        }).addTo(map);

        loadMapData();
    }

    async function loadMapData(kabupaten = 'all', risk = 'all') {
        if (!map) return;

        // Fetch GeoPandas GeoJSON Boundary
        if (!geoJsonLayer) {
            try {
                const resB = await fetch('/api/geojson/boundary');
                const geoJsonData = await resB.json();
                
                geoJsonLayer = L.geoJSON(geoJsonData, {
                    style: {
                        color: '#60a5fa',
                        weight: 2,
                        fillColor: '#3b82f6',
                        fillOpacity: 0.12
                    },
                    onEachFeature: (feature, layer) => {
                        const props = feature.properties || {};
                        const name = props.kabupaten_kota || props.NAME_1 || 'Wilayah Sulawesi Tengah';
                        layer.bindTooltip(`<b>${name}</b>`);
                    }
                }).addTo(map);
            } catch (e) {
                console.warn('GeoJSON boundary load warning:', e);
            }
        }

        // Fetch Weather Points
        try {
            const resP = await fetch(`/api/weather-points?kabupaten=${kabupaten}&risk=${risk}&limit=1200`);
            const dataP = await resP.json();

            markerCluster.clearLayers();

            const colorMap = {
                'Tinggi': '#ef4444',
                'Sedang': '#f59e0b',
                'Rendah': '#10b981'
            };

            dataP.points.forEach(pt => {
                const color = colorMap[pt.kategori_risiko] || '#3b82f6';

                const marker = L.circleMarker([pt.latitude, pt.longitude], {
                    radius: 6,
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.85,
                    weight: 1
                });

                const popupHtml = `
                    <div style="font-family: sans-serif; font-size: 13px; color: #1e293b; width: 200px;">
                        <h4 style="margin:0 0 6px 0; font-size:14px; font-weight:700;">${pt.kecamatan} (${pt.desa})</h4>
                        <b>Kabupaten:</b> ${pt.kabupaten}<br/>
                        <b>Suhu:</b> ${pt.suhu} °C<br/>
                        <b>Kelembapan:</b> ${pt.kelembapan} %<br/>
                        <b>Tutupan Awan:</b> ${pt.tutupan_awan} %<br/>
                        <b>Cuaca:</b> ${pt.cuaca}<br/>
                        <hr style="margin:6px 0; border:0; border-top:1px solid #cbd5e1;"/>
                        <b>Prediksi Risiko:</b> <span style="color:${color}; font-weight:bold;">${pt.kategori_risiko}</span>
                    </div>
                `;

                marker.bindPopup(popupHtml);
                marker.bindTooltip(`${pt.kecamatan}: ${pt.kategori_risiko}`);
                markerCluster.addLayer(marker);
            });
        } catch (e) {
            console.error('Error loading weather points:', e);
        }
    }

    // 4. SLIDER BINDINGS & PREDICTION FORM
    const sliders = [
        { id: 'pSuhu', lbl: 'valSuhuLbl' },
        { id: 'pKelembapan', lbl: 'valKelembapanLbl' },
        { id: 'pAwan', lbl: 'valAwanLbl' },
        { id: 'pAngin', lbl: 'valAnginLbl' },
        { id: 'pJam', lbl: 'valJamLbl' },
        { id: 'pBulan', lbl: 'valBulanLbl' }
    ];

    sliders.forEach(item => {
        const el = document.getElementById(item.id);
        const lbl = document.getElementById(item.lbl);
        if (el && lbl) {
            el.addEventListener('input', (e) => {
                lbl.textContent = e.target.value;
            });
        }
    });

    const predForm = document.getElementById('predictionForm');
    if (predForm) {
        predForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const payload = {
                suhu: parseFloat(document.getElementById('pSuhu').value),
                kelembapan: parseFloat(document.getElementById('pKelembapan').value),
                tutupan_awan: parseFloat(document.getElementById('pAwan').value),
                kecepatan_angin: parseFloat(document.getElementById('pAngin').value),
                kode_cuaca: parseFloat(document.getElementById('pKodeCuaca').value),
                jam: parseFloat(document.getElementById('pJam').value),
                bulan: parseFloat(document.getElementById('pBulan').value)
            };

            try {
                const res = await fetch('/api/predict', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();

                const resultBox = document.getElementById('resultBox');
                const badgeBox = document.getElementById('resBadgeBox');

                resultBox.classList.remove('hidden');

                const pred = result.prediction;
                const probs = result.probabilities;

                if (pred === 'Tinggi') {
                    badgeBox.innerHTML = `
                        <div class="status-card tinggi">
                            <h2>🔴 RISIKO BANJIR TINGGI</h2>
                            <p><b>Status: SIAGA BANJIR</b><br/>Parameter cuaca menunjukkan tingkat risiko tinggi terhadap bencana genangan/banjir.</p>
                        </div>
                    `;
                } else if (pred === 'Sedang') {
                    badgeBox.innerHTML = `
                        <div class="status-card sedang">
                            <h2>🟡 RISIKO BANJIR SEDANG</h2>
                            <p><b>Status: WASPADA</b><br/>Perlu memantau perkembangan cuaca dan debit air secara berkala.</p>
                        </div>
                    `;
                } else {
                    badgeBox.innerHTML = `
                        <div class="status-card rendah">
                            <h2>🟢 RISIKO BANJIR RENDAH</h2>
                            <p><b>Status: AMAN</b><br/>Kondisi cuaca stabil dan berisiko kecil terhadap banjir.</p>
                        </div>
                    `;
                }

                // Update Progress Bars
                const pT = probs.Tinggi || 0;
                const pS = probs.Sedang || 0;
                const pR = probs.Rendah || 0;

                document.getElementById('barTinggi').style.width = `${pT}%`;
                document.getElementById('valTinggi').textContent = `${pT}%`;

                document.getElementById('barSedang').style.width = `${pS}%`;
                document.getElementById('valSedang').textContent = `${pS}%`;

                document.getElementById('barRendah').style.width = `${pR}%`;
                document.getElementById('valRendah').textContent = `${pR}%`;

            } catch (err) {
                console.error('Error predicting flood risk:', err);
            }
        });
    }

    // 5. CHART.JS ANALYTICS DASHBOARD
    async function loadAnalytics() {
        try {
            const res = await fetch('/api/analytics');
            const data = await res.json();

            // Chart 1: Kabupaten Risk Stacked Bar Chart
            const ctxKab = document.getElementById('chartKabupaten');
            if (ctxKab) {
                if (chartKab) chartKab.destroy();
                chartKab = new Chart(ctxKab, {
                    type: 'bar',
                    data: {
                        labels: data.kabupaten_risk.categories,
                        datasets: [
                            { label: 'Tinggi', data: data.kabupaten_risk.tinggi, backgroundColor: '#ef4444' },
                            { label: 'Sedang', data: data.kabupaten_risk.sedang, backgroundColor: '#f59e0b' },
                            { label: 'Rendah', data: data.kabupaten_risk.rendah, backgroundColor: '#10b981' }
                        ]
                    },
                    options: {
                        responsive: true,
                        scales: { x: { stacked: true }, y: { stacked: true } },
                        plugins: { legend: { labels: { color: '#f1f5f9' } } }
                    }
                });
            }

            // Chart 2: Weather Distribution Donut Chart
            const ctxW = document.getElementById('chartWeather');
            if (ctxW) {
                if (chartWeather) chartWeather.destroy();
                chartWeather = new Chart(ctxW, {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(data.weather_distribution),
                        datasets: [{
                            data: Object.values(data.weather_distribution),
                            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: { legend: { labels: { color: '#f1f5f9' } } }
                    }
                });
            }

            // Chart 3: Machine Learning Feature Importance
            const ctxFI = document.getElementById('chartFeatureImportance');
            if (ctxFI) {
                if (chartFI) chartFI.destroy();
                const fiKeys = Object.keys(data.feature_importances);
                const fiVals = Object.values(data.feature_importances);

                chartFI = new Chart(ctxFI, {
                    type: 'bar',
                    data: {
                        labels: fiKeys,
                        datasets: [{
                            label: 'Tingkat Kepentingan Fitur',
                            data: fiVals,
                            backgroundColor: '#3b82f6'
                        }]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        plugins: { legend: { labels: { color: '#f1f5f9' } } }
                    }
                });
            }

        } catch (err) {
            console.error('Error loading analytics charts:', err);
        }
    }

    // 6. DATA EXPLORER TABLE & PAGINATION
    async function loadTableData(page = 1, search = '') {
        try {
            const kab = document.getElementById('filterKabupaten').value;
            const risk = document.getElementById('filterRisk').value;

            const res = await fetch(`/api/table-data?page=${page}&per_page=${perPage}&search=${encodeURIComponent(search)}&kabupaten=${kab}&risk=${risk}`);
            const data = await res.json();

            const tbody = document.getElementById('tableBody');
            tbody.innerHTML = '';

            if (data.rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" class="text-center">Tidak ada data ditemukan.</td></tr>';
                return;
            }

            data.rows.forEach(r => {
                const tr = document.createElement('tr');
                const badgeClass = r.kategori_risiko === 'Tinggi' ? 'text-red' : (r.kategori_risiko === 'Sedang' ? 'text-yellow' : 'text-green');

                tr.innerHTML = `
                    <td>${r.kabupaten_kota}</td>
                    <td>${r.kecamatan}</td>
                    <td>${r.desa_kelurahan}</td>
                    <td>${r.suhu} °C</td>
                    <td>${r.kelembapan} %</td>
                    <td>${r.tutupan_awan} %</td>
                    <td>${r.deskripsi_cuaca}</td>
                    <td class="${badgeClass}"><b>${r.kategori_risiko}</b></td>
                    <td>${r.risk_score}</td>
                `;
                tbody.appendChild(tr);
            });

            currentPage = data.page;
            document.getElementById('pageInfo').textContent = `Halaman ${data.page} dari ${data.total_pages} (${data.total.toLocaleString()} total data)`;
        } catch (err) {
            console.error('Error loading table data:', err);
        }
    }

    // Event Listeners for Filters & Table
    document.getElementById('btnApplyFilter').addEventListener('click', () => {
        const kab = document.getElementById('filterKabupaten').value;
        const risk = document.getElementById('filterRisk').value;
        loadSummary(kab, risk);
        loadMapData(kab, risk);
        loadTableData(1, document.getElementById('tableSearch').value);
    });

    document.getElementById('tableSearch').addEventListener('input', (e) => {
        loadTableData(1, e.target.value);
    });

    document.getElementById('btnPrevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            loadTableData(currentPage - 1, document.getElementById('tableSearch').value);
        }
    });

    document.getElementById('btnNextPage').addEventListener('click', () => {
        loadTableData(currentPage + 1, document.getElementById('tableSearch').value);
    });

    // Initialize Everything
    loadSummary();
    initMap();
    loadAnalytics();
    loadTableData();
});
