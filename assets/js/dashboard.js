/**
 * Jodhpur District Monitoring & Decision Support Dashboard
 * Interactive Analytics, Visualizations & Decision Support Engine
 */

(function () {
  'use strict';

  // District Configuration for target districts (1, 5, 6, 7, 8, 15, 16)
  const DISTRICT_CONFIG = {
    jodhpur: { id: 'jodhpur', num: 1, name: 'Jodhpur', center: [26.50, 72.85], zoom: 8, dist_code: '910811300000000000' },
    kota: { id: 'kota', num: 5, name: 'Kota', center: [25.18, 75.83], zoom: 9, dist_code: '910812700000000000' },
    bundi: { id: 'bundi', num: 6, name: 'Bundi', center: [25.44, 75.64], zoom: 9, dist_code: '910812100000000000' },
    jhalawar: { id: 'jhalawar', num: 7, name: 'Jhalawar', center: [24.59, 76.16], zoom: 9, dist_code: '910812900000000000' },
    baran: { id: 'baran', num: 8, name: 'Baran', center: [25.10, 76.51], zoom: 9, dist_code: '910812800000000000' },
    pali: { id: 'pali', num: 15, name: 'Pali', center: [25.77, 73.32], zoom: 9, dist_code: '910811800000000000' },
    ajmer: { id: 'ajmer', num: 16, name: 'Ajmer', center: [26.45, 74.64], zoom: 9, dist_code: '910811900000000000' }
  };

  // Global State
  const state = {
    data: null,
    activeDistrict: localStorage.getItem('rajasthan_active_district') || 'jodhpur',
    villages: [],
    filteredVillages: [],
    plots: [],
    map: null,
    mapMarkers: [],
    mapLayers: {},
    wmsLayer: null,
    wmsLayerVisible: true,
    _markerJustClicked: false,
    activeMapFilter: 'ALL',
    activeMapLayer: 'osm',
    activeBlock: 'ALL',
    activePanchayat: 'ALL',
    activeDecisionFilter: 'ALL',
    theme: localStorage.getItem('jodhpur_theme') || 'light',
    table: {
      search: '',
      page: 1,
      pageSize: 15,
      sortKey: 'com',
      sortDir: 'desc'
    },
    compare: {
      block1: '',
      block2: ''
    },
    charts: {}
  };

  // Theme palettes for ECharts
  const chartThemes = {
    dark: {
      textColor: '#94a3b8',
      titleColor: '#f8fafc',
      splitLine: 'rgba(255, 255, 255, 0.07)',
      axisLine: 'rgba(255, 255, 255, 0.12)',
      tooltipBg: 'rgba(15, 23, 42, 0.92)',
      tooltipBorder: 'rgba(255, 255, 255, 0.15)',
      tooltipText: '#f8fafc',
      colors: ['#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#f43f5e', '#14b8a6', '#6366f1']
    },
    light: {
      textColor: '#475569',
      titleColor: '#0f172a',
      splitLine: 'rgba(0, 0, 0, 0.08)',
      axisLine: 'rgba(0, 0, 0, 0.15)',
      tooltipBg: 'rgba(255, 255, 255, 0.96)',
      tooltipBorder: 'rgba(0, 0, 0, 0.12)',
      tooltipText: '#0f172a',
      colors: ['#059669', '#0284c7', '#2563eb', '#7c3aed', '#d97706', '#e11d48', '#0d9488', '#4f46e5']
    }
  };

  // Helper formatting functions
  const fmt = {
    num: (v) => (v === null || v === undefined ? '0' : Number(v).toLocaleString('en-IN')),
    float: (v, d = 1) => (v === null || v === undefined ? '0.0' : Number(v).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })),
    pct: (v) => `${Number(v || 0).toFixed(1)}%`,
    ha: (v) => `${fmt.num(Math.round(v || 0))} ha`,
    compact: (v) => {
      const n = Number(v || 0);
      if (n >= 10000000) return (n / 10000000).toFixed(2) + ' Cr';
      if (n >= 100000) return (n / 100000).toFixed(2) + ' Lakh';
      if (n >= 1000) return (n / 1000).toFixed(1) + ' k';
      return n.toLocaleString('en-IN');
    }
  };

  // Initialization
  async function init() {
    applyTheme(state.theme);
    setupEventListeners();
    setupMapListeners();
    await loadData(state.activeDistrict);
    updateDistrictHeaders();
    populateFilters();
    initMap();
    updateDashboard();
    initLucideIcons();
  }

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('jodhpur_theme', theme);
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
      themeIcon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
    }
    // Sync map tile layer with theme if dark layer was active
    if (state.map && state.mapLayers) {
      if (state.activeMapLayer === 'dark' && theme !== 'dark') {
        switchMapLayer('osm');
      }
    }
    // Re-render existing charts with new theme colors
    Object.values(state.charts).forEach(c => {
      if (c && typeof c.dispose === 'function') c.dispose();
    });
    state.charts = {};
    if (state.data) renderAllCharts();
  }

  function initLucideIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  async function loadData(districtId = state.activeDistrict) {
    try {
      showLoading(true);
      const basePath = `data/districts/${districtId}`;
      const [sumRes, vilRes, plotRes] = await Promise.all([
        fetch(`${basePath}/summary.json`).catch(() => fetch('data/summary.json')),
        fetch(`${basePath}/villages.json`).catch(() => fetch('data/villages.json')),
        fetch(`${basePath}/plots.json`).catch(() => fetch('data/plots.json'))
      ]);

      if (!sumRes.ok || !vilRes.ok) {
        throw new Error(`Failed to load JSON datasets for ${districtId}`);
      }

      state.data = await sumRes.json();
      state.villages = await vilRes.json();
      state.filteredVillages = [...state.villages];
      if (plotRes && plotRes.ok) {
        state.plots = await plotRes.json();
      } else {
        state.plots = [];
      }
      showLoading(false);
    } catch (err) {
      console.error('Data load error:', err);
      showLoading(false);
      showToast(`Error loading dataset for ${districtId}. Please refresh.`, 'error');
    }
  }

  async function switchDistrict(districtId) {
    if (!DISTRICT_CONFIG[districtId]) return;
    state.activeDistrict = districtId;
    localStorage.setItem('rajasthan_active_district', districtId);
    state.activeBlock = 'ALL';
    state.activePanchayat = 'ALL';
    state.activeDecisionFilter = 'ALL';
    state.table.page = 1;
    state.table.search = '';

    const searchInput = document.getElementById('village-search');
    if (searchInput) searchInput.value = '';

    const distSelect = document.getElementById('district-select');
    if (distSelect) distSelect.value = districtId;

    const loaderMsg = document.getElementById('loader-msg');
    if (loaderMsg) loaderMsg.textContent = `Loading ${DISTRICT_CONFIG[districtId].name} Analytics Data...`;

    await loadData(districtId);
    updateDistrictHeaders();
    populateFilters();

    // Reset compare blocks for comparison modal
    if (state.data && state.data.blocks && state.data.blocks.length > 0) {
      state.compare.block1 = state.data.blocks[0].name;
      state.compare.block2 = state.data.blocks.length > 1 ? state.data.blocks[1].name : state.data.blocks[0].name;
    }

    // Clear chart instances to rebuild cleanly
    Object.values(state.charts).forEach(c => {
      if (c && typeof c.dispose === 'function') c.dispose();
    });
    state.charts = {};

    // Update map view & WMS layer
    const distCfg = DISTRICT_CONFIG[districtId];
    if (state.map && distCfg) {
      state.map.setView(distCfg.center, distCfg.zoom);
      if (state.wmsLayer && distCfg.dist_code) {
        state.wmsLayer.setParams({ cql_filter: `dist_code = '${distCfg.dist_code}'` });
      }
    }

    updateDashboard();
    initLucideIcons();
  }

  function updateDistrictHeaders() {
    if (!state.data || !state.data.district) return;
    const dName = state.data.district.name || DISTRICT_CONFIG[state.activeDistrict]?.name || 'District';
    const headerName = document.getElementById('header-district-name');
    if (headerName) headerName.textContent = dName.toUpperCase();

    const tableName = document.getElementById('table-district-name');
    if (tableName) tableName.textContent = dName;

    document.title = `${dName} District Strategic Monitoring & Decision Support Dashboard | Natural Resources, Commons & Rural Governance`;
  }

  function showLoading(show) {
    const loader = document.getElementById('global-loader');
    if (loader) loader.style.display = show ? 'flex' : 'none';
  }

  function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Populate Block & Panchayat dropdowns
  function populateFilters() {
    const blockSelect = document.getElementById('block-select');
    if (!blockSelect || !state.data) return;

    const dName = state.data.district.name || DISTRICT_CONFIG[state.activeDistrict]?.name || 'District';
    blockSelect.innerHTML = `<option value="ALL">All Blocks (${dName} Overview)</option>`;
    state.data.blocks.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.name;
      opt.textContent = `${b.name} (${b.villages} vil, ${fmt.compact(b.population)} pop)`;
      blockSelect.appendChild(opt);
    });

    // Populate comparison dropdowns
    const c1 = document.getElementById('compare-block-1');
    const c2 = document.getElementById('compare-block-2');
    if (c1 && c2) {
      c1.innerHTML = '';
      c2.innerHTML = '';
      state.data.blocks.forEach((b, idx) => {
        const o1 = document.createElement('option');
        o1.value = b.name;
        o1.textContent = b.name;
        if (b.name === state.compare.block1 || (idx === 0 && !state.compare.block1)) o1.selected = true;
        c1.appendChild(o1);

        const o2 = document.createElement('option');
        o2.value = b.name;
        o2.textContent = b.name;
        if (b.name === state.compare.block2 || (idx === 1 && !state.compare.block2)) o2.selected = true;
        c2.appendChild(o2);
      });
    }

    updatePanchayatSelect();
  }

  function updatePanchayatSelect() {
    const panchayatSelect = document.getElementById('panchayat-select');
    if (!panchayatSelect) return;

    panchayatSelect.innerHTML = '<option value="ALL">All Gram Panchayats</option>';

    if (state.activeBlock === 'ALL') {
      panchayatSelect.disabled = true;
      return;
    }

    panchayatSelect.disabled = false;
    const currentBlock = state.data.blocks.find(b => b.name === state.activeBlock);
    if (currentBlock && currentBlock.panchayats) {
      currentBlock.panchayats.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = `${p.name} (${p.villages} vil)`;
        panchayatSelect.appendChild(opt);
      });
    }
  }

  // Event Listeners
  function setupEventListeners() {
    // Theme Switcher
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        applyTheme(state.theme === 'dark' ? 'light' : 'dark');
      });
    }

    // District Filter Change
    const districtSelect = document.getElementById('district-select');
    if (districtSelect) {
      districtSelect.value = state.activeDistrict;
      districtSelect.addEventListener('change', async (e) => {
        await switchDistrict(e.target.value);
      });
    }

    // Block Filter Change
    const blockSelect = document.getElementById('block-select');
    if (blockSelect) {
      blockSelect.addEventListener('change', (e) => {
        state.activeBlock = e.target.value;
        state.activePanchayat = 'ALL';
        updatePanchayatSelect();
        updateDashboard();
      });
    }

    // Panchayat Filter Change
    const panchayatSelect = document.getElementById('panchayat-select');
    if (panchayatSelect) {
      panchayatSelect.addEventListener('change', (e) => {
        state.activePanchayat = e.target.value;
        updateDashboard();
      });
    }

    // Decision Quick-Tags
    document.querySelectorAll('.decision-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        document.querySelectorAll('.decision-tag').forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        state.activeDecisionFilter = tag.dataset.filter || 'ALL';
        updateDashboard();
      });
    });

    // Reset Filters Button
    const resetBtn = document.getElementById('reset-filters-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        state.activeBlock = 'ALL';
        state.activePanchayat = 'ALL';
        state.activeDecisionFilter = 'ALL';
        if (blockSelect) blockSelect.value = 'ALL';
        updatePanchayatSelect();
        document.querySelectorAll('.decision-tag').forEach(t => t.classList.remove('active'));
        const defTag = document.querySelector('.decision-tag[data-filter="ALL"]');
        if (defTag) defTag.classList.add('active');
        updateDashboard();
      });
    }

    // Compare Modal Trigger
    const openCompareBtn = document.getElementById('open-compare-btn');
    const compareModal = document.getElementById('compare-modal');
    const closeCompareBtn = document.getElementById('close-compare-btn');

    if (openCompareBtn && compareModal) {
      openCompareBtn.addEventListener('click', () => {
        compareModal.classList.add('open');
        setTimeout(() => {
          renderComparisonCharts();
          initLucideIcons();
        }, 120);
      });
    }

    if (closeCompareBtn && compareModal) {
      closeCompareBtn.addEventListener('click', () => {
        compareModal.classList.remove('open');
      });
    }

    if (compareModal) {
      compareModal.addEventListener('click', (e) => {
        if (e.target === compareModal) compareModal.classList.remove('open');
      });
    }

    // Village Details Modal Trigger & Listeners
    const villageModal = document.getElementById('village-modal');
    const closeVillageModalBtn = document.getElementById('close-village-modal-btn');
    if (closeVillageModalBtn && villageModal) {
      closeVillageModalBtn.addEventListener('click', () => {
        villageModal.classList.remove('open');
      });
    }
    if (villageModal) {
      villageModal.addEventListener('click', (e) => {
        if (e.target === villageModal) villageModal.classList.remove('open');
      });
    }

    // Escape Key closes any open modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const vm = document.getElementById('village-modal');
        if (vm) vm.classList.remove('open');
        const cm = document.getElementById('compare-modal');
        if (cm) cm.classList.remove('open');
      }
    });

    // Compare Selectors Change
    const c1 = document.getElementById('compare-block-1');
    const c2 = document.getElementById('compare-block-2');
    if (c1 && c2) {
      c1.addEventListener('change', (e) => {
        state.compare.block1 = e.target.value;
        renderComparisonCharts();
      });
      c2.addEventListener('change', (e) => {
        state.compare.block2 = e.target.value;
        renderComparisonCharts();
      });
    }

    // Village Search
    const searchInput = document.getElementById('village-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.table.search = e.target.value.toLowerCase().trim();
        state.table.page = 1;
        filterAndRenderTable();
      });
    }

    // Excel Export
    const exportExcelBtn = document.getElementById('export-excel-btn');
    if (exportExcelBtn) {
      exportExcelBtn.addEventListener('click', exportToExcel);
    }

    // Print / PDF Button
    const printBtn = document.getElementById('print-report-btn');
    if (printBtn) {
      printBtn.addEventListener('click', () => window.print());
    }

    // Window Resize Handler for ECharts
    window.addEventListener('resize', () => {
      Object.values(state.charts).forEach(c => {
        if (c && typeof c.resize === 'function') c.resize();
      });
    });
  }

  // Update Core Dashboard Views
  function updateDashboard() {
    updateActionBanner();
    updateKPICards();
    updateNRMKPICards();
    updateMapMarkers();
    renderAllCharts();
    filterAndRenderTable();
    initLucideIcons();
  }

  // Update Action Banner based on selection
  function updateActionBanner() {
    const titleEl = document.getElementById('action-banner-title');
    const descEl = document.getElementById('action-banner-desc');
    const badgeEl = document.getElementById('action-banner-badge');
    if (!titleEl || !descEl || !state.data) return;

    const d = state.data.district;
    const dName = d.name || DISTRICT_CONFIG[state.activeDistrict]?.name || 'District';

    if (state.activeBlock === 'ALL') {
      if (state.activeDecisionFilter === 'CRITICAL_PASTURE_DEFICIT') {
        titleEl.textContent = `${dName} Action Alert: Low Pasture & Grazing Reserves`;
        const deficitBlocks = (state.data.blocks || [])
          .filter(b => (b.pasture / (b.geo_area || 1)) < 0.03 || b.pasture < 500)
          .slice(0, 3)
          .map(b => `${b.name} (${fmt.num(b.pasture)} ha)`)
          .join(', ');
        descEl.textContent = deficitBlocks
          ? `${deficitBlocks} have very low recorded pasture acreage. Recommend prioritized community fodder banks and pasture development under VBGRAMG.`
          : 'Low pasture reserves identified. Recommend prioritized fodder and pasture development.';
        if (badgeEl) { badgeEl.textContent = 'Deficit Alert'; badgeEl.className = 'decision-badge red'; }
      } else if (state.activeDecisionFilter === 'HIGH_RESTORATION_POTENTIAL') {
        titleEl.textContent = `${dName} Strategic Opportunity: Potential CFRR Area for Community Governance`;
        const highCfrrBlocks = (state.data.blocks || [])
          .slice()
          .sort((a, b) => (b.cfrr || 0) - (a.cfrr || 0))
          .slice(0, 3)
          .map(b => `${b.name} (${fmt.num(Math.round(b.cfrr || 0))} ha)`)
          .join(', ');
        descEl.textContent = highCfrrBlocks
          ? `${highCfrrBlocks} have extensive potential CFRR areas suitable for community pasture revival and CVS formation.`
          : 'Significant potential CFRR area available for community pasture revival and CVS formation.';
        if (badgeEl) { badgeEl.textContent = 'High Potential'; badgeEl.className = 'decision-badge green'; }
      } else if (state.activeDecisionFilter === 'HIGH_MARGINALIZED_POP') {
        const totalVulnerable = (d.sc_pop || 0) + (d.st_pop || 0);
        titleEl.textContent = `${dName} Social Equity Priority: ${fmt.num(totalVulnerable)} Marginalized Individuals (SC & ST)`;
        descEl.textContent = 'Panchayats with high SC/ST population require prioritized common land tenure governance and targeted asset creation under VBGRAMG.';
        if (badgeEl) { badgeEl.textContent = 'Equity Focus'; badgeEl.className = 'decision-badge purple'; }
      } else {
        titleEl.textContent = `${dName} District Strategic Overview — ${d.total_blocks} Blocks, ${d.total_panchayats || state.data.blocks.length * 20} Panchayats, ${fmt.num(d.total_villages)} Villages`;
        descEl.textContent = `Total Geographical Area: ${(d.geo_area / 1e6).toFixed(2)} Million Ha | Common Land: ${fmt.num(d.common_land)} Ha (${d.common_land_pct}%) | Pasture Land (Gauchar): ${fmt.num(d.pasture)} Ha.`;
        if (badgeEl) { badgeEl.textContent = 'District Active'; badgeEl.className = 'decision-badge green'; }
      }
    } else {
      const b = state.data.blocks.find(x => x.name === state.activeBlock);
      if (!b) return;

      const isDeficit = (b.pasture / (b.geo_area || 1)) < 0.03 || b.pasture < 500;
      titleEl.textContent = `Block Focus: ${b.name} (${b.villages} Villages | ${fmt.compact(b.population)} Population)`;
      descEl.textContent = `Common Land: ${fmt.num(b.common_land)} ha (${b.com_pct}%) | Pasture: ${fmt.num(b.pasture)} ha | Potential CFRR: ${fmt.num(b.cfrr)} ha | VBGRAMG Works: ${fmt.num(b.vbgramg_ha)} ha`;
      if (badgeEl) {
        badgeEl.textContent = isDeficit ? 'Pasture Deficit' : 'Active Scope';
        badgeEl.className = isDeficit ? 'decision-badge red' : 'decision-badge green';
      }
    }
  }

  // Setup Map Controls
  function setupMapListeners() {
    // Map plot filter buttons
    document.querySelectorAll('.map-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.map-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeMapFilter = btn.dataset.mapFilter || 'ALL';
        updateMapMarkers();
      });
    });

    // Map layer buttons (base maps)
    document.querySelectorAll('.map-layer-btn[data-layer]').forEach(btn => {
      btn.addEventListener('click', () => {
        const layerKey = btn.dataset.layer;
        switchMapLayer(layerKey);
      });
    });

    // GeoServer WMS Overlay toggle button
    const wmsToggleBtn = document.getElementById('toggle-wms-boundary-btn');
    if (wmsToggleBtn) {
      wmsToggleBtn.addEventListener('click', () => {
        toggleWmsLayer();
      });
    }
  }

  // Toggle GeoServer WMS Village Boundaries
  function toggleWmsLayer() {
    if (!state.map || !state.wmsLayer) return;
    state.wmsLayerVisible = !state.wmsLayerVisible;
    if (state.wmsLayerVisible) {
      state.wmsLayer.addTo(state.map);
    } else {
      state.map.removeLayer(state.wmsLayer);
    }
    const btn = document.getElementById('toggle-wms-boundary-btn');
    if (btn) btn.classList.toggle('active', state.wmsLayerVisible);
  }

  // Initialize Leaflet Interactive Base Map & GeoServer WMS Layer
  function initMap() {
    const mapDom = document.getElementById('nrm-map');
    if (!mapDom || typeof L === 'undefined' || state.map) return;

    const distCfg = DISTRICT_CONFIG[state.activeDistrict] || DISTRICT_CONFIG.jodhpur;

    state.map = L.map('nrm-map', {
      center: distCfg.center,
      zoom: distCfg.zoom,
      zoomControl: true,
      scrollWheelZoom: true
    });

    state.mapLayers = {
      osm: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
      }),
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: '&copy; Esri & Contributors'
      }),
      dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; CartoDB & OpenStreetMap'
      })
    };

    const initialLayer = 'osm';
    switchMapLayer(initialLayer);

    // Dedicated overlay pane for GeoServer WMS boundaries (between base map and markers)
    state.map.createPane('wmsPane');
    const wmsPane = state.map.getPane('wmsPane');
    if (wmsPane) {
      wmsPane.style.zIndex = '350';
    }

    // Styled Layer Descriptor (SLD) ensuring dark black crisp village polygon boundaries
    const blackPolygonSld = '<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld"><NamedLayer><Name>admin:vill_pca_2011</Name><UserStyle><FeatureTypeStyle><Rule><PolygonSymbolizer><Stroke><CssParameter name="stroke">#000000</CssParameter><CssParameter name="stroke-width">0.8</CssParameter><CssParameter name="stroke-opacity">1.0</CssParameter></Stroke></PolygonSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>';

    // GeoServer WMS Layer with CQL filter dist_code and Dark Black Polygon Style
    state.wmsLayer = L.tileLayer.wms('https://dpmap.observatory.org.in/geoserver/admin/wms', {
      layers: 'admin:vill_pca_2011',
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      cql_filter: `dist_code = '${distCfg.dist_code}'`,
      SLD_BODY: blackPolygonSld,
      maxZoom: 19,
      opacity: 1.0,
      pane: 'wmsPane',
      attribution: '&copy; <a href="https://observatory.org.in/" target="_blank" rel="noopener">Observatory</a> • Census 2011 Village Boundaries'
    });

    if (state.wmsLayerVisible) {
      state.wmsLayer.addTo(state.map);
    }

    // Interactive inspection of GeoServer village polygons on click
    state.map.on('click', async (e) => {
      if (state._markerJustClicked || !state.wmsLayerVisible || !state.map) return;
      try {
        const point = state.map.latLngToContainerPoint(e.latlng, state.map.getZoom());
        const size = state.map.getSize();
        const bounds = state.map.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();

        const params = new URLSearchParams({
          service: 'WMS',
          version: '1.1.1',
          request: 'GetFeatureInfo',
          layers: 'admin:vill_pca_2011',
          query_layers: 'admin:vill_pca_2011',
          srs: 'EPSG:4326',
          bbox: `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`,
          width: Math.round(size.x),
          height: Math.round(size.y),
          x: Math.round(point.x),
          y: Math.round(point.y),
          info_format: 'application/json',
          cql_filter: "dist_code = '910811300000000000'"
        });

        const resp = await fetch(`https://dpmap.observatory.org.in/geoserver/admin/wms?${params.toString()}`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (data && data.features && data.features.length > 0) {
          const props = data.features[0].properties;
          const villName = props.village || 'Village Boundary';
          const gpName = props.gp_name || '-';
          const subdist = props.subdist || '-';
          const pop = props.tot_p ? Number(props.tot_p).toLocaleString('en-IN') : '-';
          const hh = props.no_hh ? Number(props.no_hh).toLocaleString('en-IN') : '-';
          const lit = props.p_lit ? Number(props.p_lit).toLocaleString('en-IN') : '-';
          const fesId = props.fes_id || '-';

          L.popup()
            .setLatLng(e.latlng)
            .setContent(`
              <div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:220px;padding:2px 0;">
                <div style="font-size:0.68rem;text-transform:uppercase;color:#818cf8;font-weight:700;letter-spacing:0.04em;">
                  Census 2011 Village Boundary (GeoServer)
                </div>
                <div style="font-size:1.05rem;font-weight:700;color:#f8fafc;margin:2px 0 6px 0;">
                  ${villName}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 8px;font-size:0.75rem;color:#94a3b8;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;">
                  <div><strong style="color:#e2e8f0;">Gram Panchayat:</strong><br>${gpName}</div>
                  <div><strong style="color:#e2e8f0;">Tehsil/Block:</strong><br>${subdist}</div>
                  <div><strong style="color:#e2e8f0;">Population:</strong><br>${pop}</div>
                  <div><strong style="color:#e2e8f0;">Households:</strong><br>${hh}</div>
                  <div><strong style="color:#e2e8f0;">Literates:</strong><br>${lit}</div>
                  <div><strong style="color:#e2e8f0;">FES ID:</strong><br>${fesId}</div>
                </div>
                <div style="margin-top:6px;font-size:0.65rem;color:#64748b;font-style:italic;">
                  dist_code = '910811300000000000'
                </div>
              </div>
            `)
            .openOn(state.map);
        }
      } catch (err) {
        // Silently continue
      }
    });

    updateMapMarkers();

    // Map resize trigger after rendering
    setTimeout(() => {
      if (state.map) state.map.invalidateSize();
    }, 250);
  }

  function switchMapLayer(layerKey) {
    if (!state.map || !state.mapLayers || !state.mapLayers[layerKey]) return;
    state.activeMapLayer = layerKey;
    Object.values(state.mapLayers).forEach(layer => {
      if (state.map.hasLayer(layer)) state.map.removeLayer(layer);
    });
    state.mapLayers[layerKey].addTo(state.map);

    document.querySelectorAll('.map-layer-btn[data-layer]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layer === layerKey);
    });
  }

  // Update NRM KPI Metric Cards (100% Excel Sourced)
  function updateNRMKPICards() {
    if (!state.data) return;
    const isAll = state.activeBlock === 'ALL';
    let d = state.data.district;
    let availablePlots = state.plots || [];

    if (!isAll) {
      const b = state.data.blocks.find(x => x.name === state.activeBlock);
      if (b) {
        d = {
          plots_count: b.plots_count || 0,
          cvs_formed: b.cvs_villages || 0,
          demarcated_villages: b.demarcated_villages || 0,
          bylaws_villages: b.bylaws_villages || 0,
          pasture_recog_ha: b.pasture_recog_ha || 0,
          encroach_ha: b.encroach_ha || 0,
          vbgramg_ha: b.vbgramg_ha || 0,
          vbgramg_villages: b.vbgramg_villages || 0
        };
      }
      availablePlots = (state.plots || []).filter(p => p.block === state.activeBlock);
    }

    const totalPlots = availablePlots.length;
    const ongoingPlots = availablePlots.filter(p => p.status === 'ACTIVE' || p.status === 'ONGOING').length;
    const completedPlots = availablePlots.filter(p => p.status === 'COMPLETED').length;
    const mappedPlots = availablePlots.filter(p => p.is_exact).length;

    // 1. Intervention Plots
    const plotsValEl = document.getElementById('nrm-plots-val');
    const plotsSubEl = document.getElementById('nrm-plots-sub');
    if (plotsValEl) plotsValEl.innerHTML = `${fmt.num(totalPlots)} <span class="kpi-unit">Plots</span>`;
    if (plotsSubEl) {
      plotsSubEl.innerHTML = `
        <span class="status-pill green">${fmt.num(ongoingPlots)} Active</span>
        <span class="status-pill blue">${fmt.num(completedPlots)} Governed</span>
      `;
    }

    // 2. Demarcation & Bylaws (Excel Cols 21 & 22)
    const budgetValEl = document.getElementById('nrm-budget-val');
    const budgetSubEl = document.getElementById('nrm-budget-sub');
    if (budgetValEl) {
      budgetValEl.innerHTML = `${fmt.num(d.demarcated_villages || 0)} <span class="kpi-unit">Villages</span>`;
    }
    if (budgetSubEl) {
      budgetSubEl.innerHTML = `
        <span>${fmt.num(d.demarcated_villages || 0)} Demarcated</span>
        <span class="status-pill amber">${fmt.num(d.bylaws_villages || 0)} Bylaws</span>
      `;
    }

    // 3. CVS Formed & Tenure (Excel Cols 16 & 19)
    const cvsValEl = document.getElementById('nrm-cvs-val');
    const cvsSubEl = document.getElementById('nrm-cvs-sub');
    if (cvsValEl) cvsValEl.innerHTML = `${fmt.num(d.cvs_formed || 0)} <span class="kpi-unit">CVS Formed</span>`;
    if (cvsSubEl) {
      cvsSubEl.innerHTML = `
        <span>${fmt.num(d.pasture_recog_ha || 0)} Ha Recognized</span>
        <span class="status-pill cyan">Rule 170(1)</span>
      `;
    }

    // 4. VBGRAMG & Protection (Excel Cols 24 & 27)
    const waterValEl = document.getElementById('nrm-water-val');
    const waterSubEl = document.getElementById('nrm-water-sub');
    if (waterValEl) waterValEl.innerHTML = `${fmt.num(d.vbgramg_ha || 0)} <span class="kpi-unit">Ha</span>`;
    if (waterSubEl) {
      waterSubEl.innerHTML = `
        <span>${fmt.num(d.encroach_ha || 0)} Ha Encroach Removed</span>
        <span class="status-pill blue">${fmt.num(d.vbgramg_villages || 0)} Villages Works</span>
      `;
    }

    // Top badges
    const totalBadge = document.getElementById('nrm-total-plots-badge');
    if (totalBadge) totalBadge.textContent = `${fmt.num(totalPlots)} Plots Tracked`;
    const mappedBadge = document.getElementById('nrm-mapped-plots-badge');
    if (mappedBadge) mappedBadge.textContent = `${fmt.num(mappedPlots)} Geo-Located Plots`;
  }

  // Update Markers on Leaflet Map
  function updateMapMarkers() {
    if (!state.map || !state.plots || !state.plots.length) return;

    let available = state.plots.filter(p => p.lat && p.lng);

    // Filter by block & panchayat
    let blockPlots = available;
    if (state.activeBlock !== 'ALL') {
      blockPlots = available.filter(p => p.block === state.activeBlock);
    }
    if (state.activePanchayat !== 'ALL') {
      blockPlots = blockPlots.filter(p => p.panchayat === state.activePanchayat);
    }

    const cntAll = blockPlots.length;
    const cntOngoing = blockPlots.filter(p => p.status === 'ONGOING').length;
    const cntCompleted = blockPlots.filter(p => p.status === 'COMPLETED').length;
    const cntWater = blockPlots.filter(p => p.water_structure).length;
    const cntCvs = blockPlots.filter(p => p.cvs === 'Y').length;

    const setElText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setElText('map-cnt-all', cntAll);
    setElText('map-cnt-ongoing', cntOngoing);
    setElText('map-cnt-completed', cntCompleted);
    setElText('map-cnt-water', cntWater);
    setElText('map-cnt-cvs', cntCvs);
    setElText('nrm-mapped-plots-badge', `${cntAll} Geo-Located Plots`);

    // Filter by active map plot filter
    let displayPlots = blockPlots;
    if (state.activeMapFilter === 'ONGOING') {
      displayPlots = blockPlots.filter(p => p.status === 'ONGOING');
    } else if (state.activeMapFilter === 'COMPLETED') {
      displayPlots = blockPlots.filter(p => p.status === 'COMPLETED');
    } else if (state.activeMapFilter === 'WATER') {
      displayPlots = blockPlots.filter(p => p.water_structure);
    } else if (state.activeMapFilter === 'CVS') {
      displayPlots = blockPlots.filter(p => p.cvs === 'Y');
    }

    // Clear old markers
    state.mapMarkers.forEach(m => m.remove());
    state.mapMarkers = [];

    const bounds = [];

    displayPlots.forEach(p => {
      let color = '#10b981'; // Green ongoing
      if (p.water_structure) color = '#06b6d4'; // Cyan water
      else if (p.status === 'COMPLETED') color = '#3b82f6'; // Blue completed
      else if (p.status === 'NEW' || p.status === 'ADOPTED') color = '#f59e0b'; // Amber

      const marker = L.circleMarker([p.lat, p.lng], {
        radius: p.water_structure ? 7 : 6,
        fillColor: color,
        color: '#ffffff',
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.85
      });

      const popupHtml = `
        <div class="popup-title">
          <span>${p.name || 'Restoration Plot'}</span>
          <span class="status-pill ${p.status === 'COMPLETED' ? 'blue' : 'green'}">${p.status}</span>
        </div>
        <div class="popup-location">
          <b>${p.village}</b> • ${p.panchayat} GP • <b>${p.block} Block</b>
          ${p.code ? `<br>Census Code: ${p.code}` : ''}
        </div>
        <div class="popup-metric-row">
          <div class="popup-metric-box">
            <span class="popup-metric-label">Plot / Work Area</span>
            <span class="popup-metric-val">${p.area_ha || 0} Ha</span>
          </div>
          <div class="popup-metric-box">
            <span class="popup-metric-label">Scheme</span>
            <span class="popup-metric-val">${p.scheme || 'VBGRAMG'}</span>
          </div>
        </div>
        <div style="font-size:0.75rem;margin-top:0.4rem;display:flex;flex-wrap:wrap;gap:4px;">
          <span class="status-pill ${p.cvs === 'Y' ? 'cyan' : 'gray'}">CVS: ${p.cvs === 'Y' ? 'YES' : 'NO'}</span>
          <span class="status-pill ${p.demarcation === 'Y' ? 'blue' : 'gray'}">Demarcated: ${p.demarcation === 'Y' ? 'YES' : 'NO'}</span>
          <span class="status-pill ${p.bylaws === 'Y' ? 'amber' : 'gray'}">Bylaws: ${p.bylaws === 'Y' ? 'YES' : 'NO'}</span>
          ${p.tenure_recognized_ha > 0 ? `<span class="status-pill green">Tenure: ${p.tenure_recognized_ha} Ha</span>` : ''}
          ${p.encroachment_removed_ha > 0 ? `<span class="status-pill red">Encroach Removed: ${p.encroachment_removed_ha} Ha</span>` : ''}
        </div>
        ${p.cvs_date ? `<div style="font-size:0.68rem;color:#64748b;margin-top:0.3rem;">CVS Date: ${p.cvs_date}</div>` : ''}
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        state._markerJustClicked = true;
        setTimeout(() => { state._markerJustClicked = false; }, 300);
      });
      marker.addTo(state.map);
      state.mapMarkers.push(marker);
      bounds.push([p.lat, p.lng]);
    });

    if (bounds.length > 0) {
      if (state.activeBlock !== 'ALL') {
        state.map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      } else {
        state.map.fitBounds(bounds, { padding: [30, 30] });
      }
    } else if (state.activeBlock === 'ALL') {
      const distCfg = DISTRICT_CONFIG[state.activeDistrict] || DISTRICT_CONFIG.jodhpur;
      state.map.setView(distCfg.center, distCfg.zoom);
    }
  }

  // Update KPI metric cards
  function updateKPICards() {
    if (!state.data) return;
    const isAll = state.activeBlock === 'ALL';
    let d = state.data.district;

    if (!isAll) {
      const b = state.data.blocks.find(x => x.name === state.activeBlock);
      if (b) {
        d = {
          geo_area: b.geo_area,
          common_land: b.common_land,
          common_land_pct: b.com_pct,
          pasture: b.pasture,
          cfrr: b.cfrr,
          population: b.population,
          households: b.households,
          sc_pop: b.sc_pop,
          st_pop: b.st_pop,
          vbgramg_ha: b.vbgramg_ha,
          vbgramg_villages: b.vbgramg_villages,
          sc_pct: b.sc_pct,
          sex_ratio: b.sex_ratio,
          villages: b.villages
        };
      }
    }

    // 1. Total Land Area
    setCardValue('kpi-area-val', fmt.compact(d.geo_area), 'Hectares');
    setCardSub('kpi-area-sub', isAll ? `${state.data.district.total_blocks} Blocks • ${fmt.num(state.data.district.total_villages)} Villages` : `${d.villages || ''} Villages in Block`);

    // 2. Common Land (Pasture + Potential CFRR)
    setCardValue('kpi-commons-val', fmt.compact(d.common_land), 'Ha');
    setCardSub('kpi-commons-sub', `${d.common_land_pct}% of total land area`);

    // 3. Pasture Land (Gauchar)
    setCardValue('kpi-pasture-val', fmt.compact(d.pasture), 'Ha');
    const pastureShare = ((d.pasture / d.geo_area) * 100).toFixed(1);
    setCardSub('kpi-pasture-sub', `${pastureShare}% of geographical area`);

    // 4. Rural Population
    setCardValue('kpi-pop-val', fmt.compact(d.population), 'Persons');
    setCardSub('kpi-pop-sub', `${fmt.compact(d.households)} Households`);

    // 5. Marginalized SC & ST Population
    const vulPop = (d.sc_pop || 0) + (d.st_pop || 0);
    const vulPct = d.population > 0 ? ((vulPop / d.population) * 100).toFixed(1) : (d.sc_pct || 0);
    setCardValue('kpi-vulnerable-val', fmt.compact(vulPop), 'Persons');
    setCardSub('kpi-vulnerable-sub', `${vulPct}% of rural population (SC & ST)`);

    // 6. VBGRAMG Works Done (from Col 27)
    setCardValue('kpi-mgnrega-val', fmt.compact(d.vbgramg_ha || 0), 'Ha');
    setCardSub('kpi-mgnrega-sub', `${fmt.num(d.vbgramg_villages || 0)} Villages with Works Done`);
  }

  function setCardValue(id, val, unit) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `${val} <span class="kpi-unit">${unit}</span>`;
  }

  function setCardSub(id, sub) {
    const el = document.getElementById(id);
    if (el) el.textContent = sub;
  }

  // Render All Interactive Charts
  function renderAllCharts() {
    renderLandDistributionChart();
    renderCommonsStackedBarChart();
    renderSocialEquityChart();
    renderSexRatioChart();
    renderVBGRAMGChart();
    renderFallowWastelandChart();
  }

  // Chart Helper: get or create chart instance
  function getChart(id) {
    const dom = document.getElementById(id);
    if (!dom) return null;
    if (!state.charts[id]) {
      state.charts[id] = echarts.init(dom, null, { renderer: 'canvas' });
    }
    return state.charts[id];
  }


  // CHART 2: Land Resource Composition (Nested Donut / Sunburst)
  function renderLandDistributionChart() {
    const chart = getChart('chart-land-distribution');
    if (!chart || !state.data) return;

    const theme = chartThemes[state.theme];
    let src = state.data.district;
    if (state.activeBlock !== 'ALL') {
      src = state.data.blocks.find(b => b.name === state.activeBlock) || src;
    }

    const remainingLand = Math.max(0, src.geo_area - (src.pasture + (src.cfrr || 0)));
    const dataItems = [
      { name: 'Pasture (Gauchar)', value: src.pasture, itemStyle: { color: '#10b981' } },
      { name: 'Potential CFRR Commons', value: src.cfrr || 0, itemStyle: { color: '#06b6d4' } },
      { name: 'VBGRAMG Restored Land', value: src.vbgramg_ha || 0, itemStyle: { color: '#8b5cf6' } },
      { name: 'Other Village Land Area', value: remainingLand, itemStyle: { color: '#64748b' } }
    ];

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.tooltipText },
        formatter: (params) => {
          const pct = ((params.value / src.geo_area) * 100).toFixed(1);
          return `
            <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${params.name}</div>
            <div>Area: <b>${fmt.num(params.value)} Hectares</b></div>
            <div>Share of Total: <b>${pct}%</b></div>
          `;
        }
      },
      legend: {
        orient: 'horizontal',
        bottom: '0%',
        textStyle: { color: theme.textColor, fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10
      },
      series: [
        {
          name: 'Land Use',
          type: 'pie',
          radius: ['45%', '72%'],
          center: ['50%', '46%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: theme.tooltipBg,
            borderWidth: 2
          },
          label: {
            show: true,
            formatter: '{b}\n{d}%',
            fontSize: 10,
            color: theme.textColor
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 13,
              fontWeight: 'bold',
              color: theme.titleColor
            }
          },
          data: dataItems
        }
      ]
    };

    chart.setOption(option, true);
  }

  // CHART 3: Block-wise Commons & Pasture Breakdown (Stacked Bar)
  function renderCommonsStackedBarChart() {
    const chart = getChart('chart-commons-bar');
    if (!chart || !state.data) return;

    const theme = chartThemes[state.theme];
    const filteredBlocks = getFilteredBlocks();

    // Sort by Total Common Land desc
    const sorted = [...filteredBlocks].sort((a, b) => b.common_land - a.common_land);

    const blockNames = sorted.map(b => b.name);
    const pastureData = sorted.map(b => b.pasture);
    const cfrrData = sorted.map(b => b.cfrr || 0);

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.tooltipText },
        formatter: (params) => {
          const bname = params[0].name;
          const b = sorted.find(x => x.name === bname);
          let html = `<div style="font-weight:700;margin-bottom:6px;color:#38bdf8;">${bname} (${b.com_pct}% Commons)</div>`;
          params.forEach(p => {
            html += `<div>${p.marker} ${p.seriesName}: <b>${fmt.num(p.value)} ha</b></div>`;
          });
          html += `<div style="margin-top:4px;border-top:1px solid rgba(255,255,255,0.1);padding-top:4px;">Total Commons: <b>${fmt.num(b.common_land)} ha</b></div>`;
          return html;
        }
      },
      legend: {
        top: '0%',
        textStyle: { color: theme.textColor, fontSize: 11 },
        itemWidth: 12,
        itemHeight: 12
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '12%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: blockNames,
        axisLabel: {
          color: theme.textColor,
          interval: 0,
          rotate: 35,
          fontSize: 10,
          fontWeight: 600
        },
        axisLine: { lineStyle: { color: theme.axisLine } }
      },
      yAxis: {
        type: 'value',
        name: 'Hectares (ha)',
        nameTextStyle: { color: theme.textColor, fontSize: 11 },
        axisLabel: { color: theme.textColor },
        axisLine: { lineStyle: { color: theme.axisLine } },
        splitLine: { lineStyle: { color: theme.splitLine } }
      },
      series: [
        {
          name: 'Pasture (Gauchar)',
          type: 'bar',
          stack: 'commons',
          itemStyle: { color: '#10b981' },
          data: pastureData
        },
        {
          name: 'Potential CFRR Area',
          type: 'bar',
          stack: 'commons',
          itemStyle: { color: '#06b6d4' },
          data: cfrrData
        }
      ]
    };

    chart.setOption(option, true);

    chart.off('click');
    chart.on('click', (params) => {
      state.activeBlock = params.name;
      const bs = document.getElementById('block-select');
      if (bs) bs.value = state.activeBlock;
      updatePanchayatSelect();
      updateDashboard();
    });
  }


  // CHART 6: Social Inclusion & Vulnerability Breakdown (SC / ST / General)
  function renderSocialEquityChart() {
    const chart = getChart('chart-social-equity');
    if (!chart || !state.data) return;

    const theme = chartThemes[state.theme];
    const filteredBlocks = getFilteredBlocks();
    const sorted = [...filteredBlocks].sort((a, b) => b.vulnerable_pct - a.vulnerable_pct);

    const blockNames = sorted.map(b => b.name);
    const scPct = sorted.map(b => b.sc_pct);
    const stPct = sorted.map(b => b.st_pct);
    const genPct = sorted.map(b => Number((100 - (b.sc_pct + b.st_pct)).toFixed(1)));

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.tooltipText },
        formatter: (params) => {
          const bname = params[0].name;
          const b = sorted.find(x => x.name === bname);
          return `
            <div style="font-weight:700;margin-bottom:5px;color:#38bdf8;">${bname} (Vulnerable: ${b.vulnerable_pct}%)</div>
            <div>SC Population: <b>${fmt.num(b.sc_pop)} (${b.sc_pct}%)</b></div>
            <div>ST Population: <b>${fmt.num(b.st_pop)} (${b.st_pct}%)</b></div>
            <div>Total Population: <b>${fmt.num(b.population)}</b></div>
          `;
        }
      },
      legend: {
        top: '0%',
        textStyle: { color: theme.textColor, fontSize: 11 }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '12%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: blockNames,
        axisLabel: {
          color: theme.textColor,
          interval: 0,
          rotate: 35,
          fontSize: 10,
          fontWeight: 600
        },
        axisLine: { lineStyle: { color: theme.axisLine } }
      },
      yAxis: {
        type: 'value',
        name: 'Percentage of Population (%)',
        max: 100,
        axisLabel: { color: theme.textColor, formatter: '{value}%' },
        axisLine: { lineStyle: { color: theme.axisLine } },
        splitLine: { lineStyle: { color: theme.splitLine } }
      },
      series: [
        {
          name: 'Scheduled Caste (SC)',
          type: 'bar',
          stack: 'social',
          itemStyle: { color: '#8b5cf6' },
          data: scPct
        },
        {
          name: 'Scheduled Tribe (ST)',
          type: 'bar',
          stack: 'social',
          itemStyle: { color: '#06b6d4' },
          data: stPct
        },
        {
          name: 'General & OBC Communities',
          type: 'bar',
          stack: 'social',
          itemStyle: { color: 'rgba(100, 116, 139, 0.45)' },
          data: genPct
        }
      ]
    };

    chart.setOption(option, true);

    chart.off('click');
    chart.on('click', (params) => {
      state.activeBlock = params.name;
      const bs = document.getElementById('block-select');
      if (bs) bs.value = state.activeBlock;
      updatePanchayatSelect();
      updateDashboard();
    });
  }

  // CHART 7: Gender Ratio Disparity by Block with Benchmark Lines
  function renderSexRatioChart() {
    const chart = getChart('chart-sex-ratio');
    if (!chart || !state.data) return;

    const theme = chartThemes[state.theme];
    const filteredBlocks = getFilteredBlocks();
    const sorted = [...filteredBlocks].sort((a, b) => b.sex_ratio - a.sex_ratio);

    const blockNames = sorted.map(b => b.name);
    const ratios = sorted.map(b => {
      let col = '#10b981';
      if (b.sex_ratio < 905) col = '#ef4444';
      else if (b.sex_ratio < 925) col = '#f59e0b';
      return {
        value: b.sex_ratio,
        itemStyle: { color: col, borderRadius: [4, 4, 0, 0] }
      };
    });

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.tooltipText },
        formatter: (params) => {
          const bname = params[0].name;
          const b = sorted.find(x => x.name === bname);
          return `
            <div style="font-weight:700;margin-bottom:4px;color:#38bdf8;">${bname}</div>
            <div>Sex Ratio: <b>${b.sex_ratio}</b> females / 1000 males</div>
            <div>Female Pop: <b>${fmt.num(b.female)}</b></div>
            <div>Male Pop: <b>${fmt.num(b.male)}</b></div>
          `;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '14%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: blockNames,
        axisLabel: {
          color: theme.textColor,
          interval: 0,
          rotate: 35,
          fontSize: 10,
          fontWeight: 600
        },
        axisLine: { lineStyle: { color: theme.axisLine } }
      },
      yAxis: {
        type: 'value',
        name: 'Females per 1000 Males',
        min: 880,
        max: 950,
        axisLabel: { color: theme.textColor },
        axisLine: { lineStyle: { color: theme.axisLine } },
        splitLine: { lineStyle: { color: theme.splitLine } }
      },
      series: [
        {
          name: 'Sex Ratio',
          type: 'bar',
          data: ratios,
          markLine: {
            silent: true,
            lineStyle: { color: '#06b6d4', width: 2, type: 'dashed' },
            data: [
              { yAxis: 922, label: { formatter: 'District Avg: 922', position: 'end', color: '#06b6d4' } },
              { yAxis: 900, label: { formatter: 'Alert: 900', position: 'end', color: '#ef4444' } }
            ]
          }
        }
      ]
    };

    chart.setOption(option, true);
  }

  // CHART 8: VBGRAMG Restoration Works by Block
  function renderVBGRAMGChart() {
    const chart = getChart('chart-mgnrega');
    if (!chart || !state.data) return;

    const theme = chartThemes[state.theme];
    const filteredBlocks = getFilteredBlocks();
    const sorted = [...filteredBlocks].sort((a, b) => (b.vbgramg_ha || 0) - (a.vbgramg_ha || 0));

    const blockNames = sorted.map(b => b.name);
    const vbgramgHa = sorted.map(b => b.vbgramg_ha || 0);
    const vbgramgVillages = sorted.map(b => b.vbgramg_villages || 0);

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.tooltipText },
        formatter: (params) => {
          const bname = params[0].name;
          const b = sorted.find(x => x.name === bname);
          return `
            <div style="font-weight:700;margin-bottom:4px;color:#38bdf8;">${bname} (VBGRAMG)</div>
            <div>Work Done Area: <b>${fmt.num(b.vbgramg_ha || 0)} Ha</b></div>
            <div>Villages with Works: <b>${fmt.num(b.vbgramg_villages || 0)}</b></div>
            <div>Total Block Villages: <b>${fmt.num(b.villages)}</b></div>
          `;
        }
      },
      legend: {
        top: '0%',
        textStyle: { color: theme.textColor, fontSize: 11 }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '12%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: blockNames,
        axisLabel: {
          color: theme.textColor,
          interval: 0,
          rotate: 35,
          fontSize: 10,
          fontWeight: 600
        },
        axisLine: { lineStyle: { color: theme.axisLine } }
      },
      yAxis: [
        {
          type: 'value',
          name: 'Restored (Ha)',
          axisLabel: { color: theme.textColor, formatter: (v) => fmt.compact(v) },
          axisLine: { lineStyle: { color: theme.axisLine } },
          splitLine: { lineStyle: { color: theme.splitLine } }
        },
        {
          type: 'value',
          name: 'Villages',
          axisLabel: { color: theme.textColor, formatter: '{value}' },
          axisLine: { lineStyle: { color: theme.axisLine } },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: 'VBGRAMG Restored Land (Ha)',
          type: 'bar',
          itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
          data: vbgramgHa
        },
        {
          name: 'Villages with Works',
          type: 'line',
          yAxisIndex: 1,
          lineStyle: { color: '#10b981', width: 2.5 },
          itemStyle: { color: '#10b981', borderWidth: 2, borderColor: '#fff' },
          data: vbgramgVillages
        }
      ]
    };

    chart.setOption(option, true);
  }

  // CHART 9: CVS Formation & Pasture Governance by Block
  function renderFallowWastelandChart() {
    const chart = getChart('chart-fallow-wasteland');
    if (!chart || !state.data) return;

    const theme = chartThemes[state.theme];
    const filteredBlocks = getFilteredBlocks();
    const sorted = [...filteredBlocks].sort((a, b) => (b.cvs_villages || 0) - (a.cvs_villages || 0));

    const blockNames = sorted.map(b => b.name);
    const cvsData = sorted.map(b => b.cvs_villages || 0);
    const demarcData = sorted.map(b => b.demarcated_villages || 0);
    const bylawsData = sorted.map(b => b.bylaws_villages || 0);

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.tooltipText },
        formatter: (params) => {
          const bname = params[0].name;
          const b = sorted.find(x => x.name === bname);
          return `
            <div style="font-weight:700;margin-bottom:4px;color:#10b981;">${bname} (Pasture Governance)</div>
            <div>CVS Formed Villages: <b>${b.cvs_villages || 0}</b></div>
            <div>Pasture Demarcated: <b>${b.demarcated_villages || 0}</b></div>
            <div>Village Bylaws Passed: <b>${b.bylaws_villages || 0}</b></div>
            <div>Total Block Villages: <b>${b.villages}</b></div>
          `;
        }
      },
      legend: {
        top: '0%',
        textStyle: { color: theme.textColor, fontSize: 11 }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '12%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: blockNames,
        axisLabel: {
          color: theme.textColor,
          interval: 0,
          rotate: 35,
          fontSize: 10,
          fontWeight: 600
        },
        axisLine: { lineStyle: { color: theme.axisLine } }
      },
      yAxis: {
        type: 'value',
        name: 'Villages',
        axisLabel: { color: theme.textColor },
        axisLine: { lineStyle: { color: theme.axisLine } },
        splitLine: { lineStyle: { color: theme.splitLine } }
      },
      series: [
        {
          name: 'CVS Formed Villages',
          type: 'bar',
          itemStyle: { color: '#10b981', borderRadius: [3, 3, 0, 0] },
          data: cvsData
        },
        {
          name: 'Pasture Demarcated',
          type: 'bar',
          itemStyle: { color: '#06b6d4', borderRadius: [3, 3, 0, 0] },
          data: demarcData
        },
        {
          name: 'Bylaws Passed',
          type: 'bar',
          itemStyle: { color: '#f59e0b', borderRadius: [3, 3, 0, 0] },
          data: bylawsData
        }
      ]
    };

    chart.setOption(option, true);
  }

  // CHART 10: Multi-Dimensional Strategic Decision Radar Chart
  function renderStrategicRadarChart() {
    const chart = getChart('chart-strategic-radar');
    if (!chart || !state.data) return;

    const theme = chartThemes[state.theme];

    // District benchmark scores (normalized 0-100)
    const distBench = [60, 50, 45, 55, 65, 80];

    // Target block scores
    let targetName = state.activeBlock === 'ALL' ? 'District Baseline' : state.activeBlock;
    let targetScores = [60, 50, 45, 55, 65, 80];

    if (state.activeBlock !== 'ALL') {
      const b = state.data.blocks.find(x => x.name === state.activeBlock);
      if (b) {
        targetScores = [
          Math.min(100, Math.round(b.com_pct * 2.5)),
          Math.min(100, Math.round(b.pasture_pct * 10)),
          Math.min(100, Math.round((b.restoration_potential / 1000) * 8)),
          Math.min(100, Math.round(b.active_worker_pct)),
          Math.min(100, Math.round(b.vulnerable_pct * 2.5)),
          Math.min(100, Math.round((b.sex_ratio - 850) * 1.2))
        ];
      }
    }

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.tooltipText }
      },
      legend: {
        bottom: '0%',
        textStyle: { color: theme.textColor, fontSize: 11 }
      },
      radar: {
        indicator: [
          { name: 'Commons Share', max: 100 },
          { name: 'Pasture Security', max: 100 },
          { name: 'Restoration Potential', max: 100 },
          { name: 'Labor Readiness', max: 100 },
          { name: 'Social Vulnerability', max: 100 },
          { name: 'Gender Balance', max: 100 }
        ],
        shape: 'polygon',
        splitNumber: 4,
        axisName: {
          color: theme.textColor,
          fontSize: 11,
          fontWeight: 600
        },
        splitLine: { lineStyle: { color: theme.splitLine } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: theme.axisLine } }
      },
      series: [
        {
          name: 'Strategic Pillars',
          type: 'radar',
          data: [
            {
              value: distBench,
              name: 'District Benchmark',
              itemStyle: { color: '#64748b' },
              lineStyle: { width: 1.5, type: 'dashed' },
              areaStyle: { color: 'rgba(100, 116, 139, 0.15)' }
            },
            {
              value: targetScores,
              name: targetName,
              itemStyle: { color: '#10b981' },
              lineStyle: { width: 2.5 },
              areaStyle: { color: 'rgba(16, 185, 129, 0.3)' }
            }
          ]
        }
      ]
    };

    chart.setOption(option, true);
  }

  // CHART 11: Top 10 Panchayats by Common Land & Wasteland (Horizontal Bar)
  function renderTopPanchayatsChart() {
    const chart = getChart('chart-top-panchayats');
    if (!chart || !state.data) return;

    const theme = chartThemes[state.theme];

    // Gather panchayats based on active block or district
    let panchayatsList = [];
    if (state.activeBlock === 'ALL') {
      state.data.blocks.forEach(b => {
        b.panchayats.forEach(p => {
          panchayatsList.push({ ...p, block: b.name });
        });
      });
    } else {
      const b = state.data.blocks.find(x => x.name === state.activeBlock);
      if (b) {
        panchayatsList = b.panchayats.map(p => ({ ...p, block: b.name }));
      }
    }

    // Sort by common land desc, top 10
    const top10 = panchayatsList
      .sort((a, b) => b.commons - a.commons)
      .slice(0, 10)
      .reverse(); // reverse for horizontal bar

    const names = top10.map(p => `${p.name} (${p.block})`);
    const commonsVals = top10.map(p => p.commons);
    const pastureVals = top10.map(p => p.pasture);

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.tooltipText }
      },
      legend: {
        top: '0%',
        textStyle: { color: theme.textColor, fontSize: 11 }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '8%',
        top: '12%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: 'Hectares',
        axisLabel: { color: theme.textColor },
        axisLine: { lineStyle: { color: theme.axisLine } },
        splitLine: { lineStyle: { color: theme.splitLine } }
      },
      yAxis: {
        type: 'category',
        data: names,
        axisLabel: { color: theme.textColor, fontSize: 10, fontWeight: 600 },
        axisLine: { lineStyle: { color: theme.axisLine } }
      },
      series: [
        {
          name: 'Common Land',
          type: 'bar',
          itemStyle: { color: '#06b6d4', borderRadius: [0, 4, 4, 0] },
          data: commonsVals
        },
        {
          name: 'Pasture (Gauchar)',
          type: 'bar',
          itemStyle: { color: '#10b981', borderRadius: [0, 4, 4, 0] },
          data: pastureVals
        }
      ]
    };

    chart.setOption(option, true);
  }

  // RENDER COMPARISON CHARTS (SIDE-BY-SIDE MODAL)
  function renderComparisonCharts() {
    if (!state.data) return;
    const b1 = state.data.blocks.find(x => x.name === state.compare.block1);
    const b2 = state.data.blocks.find(x => x.name === state.compare.block2);
    if (!b1 || !b2) return;

    const theme = chartThemes[state.theme];

    // 1. Radar Comparison
    const dom1 = document.getElementById('compare-radar-chart');
    const dom2 = document.getElementById('compare-bar-chart');
    if (!dom1 || !dom2) return;

    let radarChart = echarts.getInstanceByDom(dom1);
    if (!radarChart) radarChart = echarts.init(dom1, null, { renderer: 'canvas' });
    radarChart.resize();

    const score1 = [
      Math.min(100, Math.round(b1.com_pct * 2.5)),
      Math.min(100, Math.round(b1.pasture_pct * 10)),
      Math.min(100, Math.round((b1.restoration_potential / 1000) * 8)),
      Math.min(100, Math.round(b1.active_worker_pct)),
      Math.min(100, Math.round(b1.vulnerable_pct * 2.5)),
      Math.min(100, Math.round((b1.sex_ratio - 850) * 1.2))
    ];
    const score2 = [
      Math.min(100, Math.round(b2.com_pct * 2.5)),
      Math.min(100, Math.round(b2.pasture_pct * 10)),
      Math.min(100, Math.round((b2.restoration_potential / 1000) * 8)),
      Math.min(100, Math.round(b2.active_worker_pct)),
      Math.min(100, Math.round(b2.vulnerable_pct * 2.5)),
      Math.min(100, Math.round((b2.sex_ratio - 850) * 1.2))
    ];

    radarChart.setOption({
      backgroundColor: 'transparent',
      tooltip: {},
      legend: { bottom: '0%', textStyle: { color: theme.textColor } },
      radar: {
        indicator: [
          { name: 'Commons Share', max: 100 },
          { name: 'Pasture Security', max: 100 },
          { name: 'Restoration Potential', max: 100 },
          { name: 'Labor Readiness', max: 100 },
          { name: 'Social Vulnerability', max: 100 },
          { name: 'Gender Balance', max: 100 }
        ],
        splitLine: { lineStyle: { color: theme.splitLine } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: theme.axisLine } },
        axisName: { color: theme.textColor }
      },
      series: [{
        type: 'radar',
        data: [
          { name: b1.name, value: score1, itemStyle: { color: '#06b6d4' }, areaStyle: { color: 'rgba(6,182,212,0.3)' } },
          { name: b2.name, value: score2, itemStyle: { color: '#f59e0b' }, areaStyle: { color: 'rgba(245,158,11,0.3)' } }
        ]
      }]
    }, true);

    // 2. Bar Comparison of Key Numbers
    let barChart = echarts.getInstanceByDom(dom2);
    if (!barChart) barChart = echarts.init(dom2, null, { renderer: 'canvas' });
    barChart.resize();
    barChart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: '0%', textStyle: { color: theme.textColor } },
      grid: { left: '3%', right: '4%', bottom: '8%', top: '14%', containLabel: true },
      xAxis: {
        type: 'category',
        data: ['Total Land (ha)', 'Common Land (ha)', 'Pasture (ha)', 'Wasteland (ha)', 'Population'],
        axisLabel: { color: theme.textColor, fontSize: 10, rotate: 20 },
        axisLine: { lineStyle: { color: theme.axisLine } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: theme.textColor, formatter: (v) => fmt.compact(v) },
        axisLine: { lineStyle: { color: theme.axisLine } },
        splitLine: { lineStyle: { color: theme.splitLine } }
      },
      series: [
        {
          name: b1.name,
          type: 'bar',
          itemStyle: { color: '#06b6d4', borderRadius: [4, 4, 0, 0] },
          data: [b1.geo_area, b1.common_land, b1.pasture, b1.restoration_potential, b1.population]
        },
        {
          name: b2.name,
          type: 'bar',
          itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] },
          data: [b2.geo_area, b2.common_land, b2.pasture, b2.restoration_potential, b2.population]
        }
      ]
    });
  }

  // Filter & Render Village Data Explorer Table
  function filterAndRenderTable() {
    if (!state.villages || !state.villages.length) return;

    let res = [...state.villages];

    // Filter by Block
    if (state.activeBlock !== 'ALL') {
      res = res.filter(v => v.b === state.activeBlock);
    }

    // Filter by Panchayat
    if (state.activePanchayat !== 'ALL') {
      res = res.filter(v => v.p === state.activePanchayat);
    }

    // Filter by Search Query
    if (state.table.search) {
      const q = state.table.search;
      res = res.filter(v =>
        v.v.toLowerCase().includes(q) ||
        v.p.toLowerCase().includes(q) ||
        v.b.toLowerCase().includes(q) ||
        v.c.includes(q)
      );
    }

    // Sort
    const k = state.table.sortKey;
    const dir = state.table.sortDir === 'asc' ? 1 : -1;
    res.sort((a, b) => {
      const vA = a[k] || 0;
      const vB = b[k] || 0;
      if (typeof vA === 'string') return dir * vA.localeCompare(vB);
      return dir * (vA - vB);
    });

    state.filteredVillages = res;

    // Pagination
    const totalRecords = res.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / state.table.pageSize));
    if (state.table.page > totalPages) state.table.page = totalPages;

    const startIdx = (state.table.page - 1) * state.table.pageSize;
    const pageRecords = res.slice(startIdx, startIdx + state.table.pageSize);

    renderTableRows(pageRecords);
    renderPagination(totalRecords, totalPages);
  }

  function renderTableRows(records) {
    const tbody = document.getElementById('village-table-body');
    if (!tbody) return;

    if (!records.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--text-muted);">No village records matching the selected filters.</td></tr>`;
      return;
    }

    let html = '';
    records.forEach(r => {
      const scPct = r.pop > 0 ? ((r.sc / r.pop) * 100).toFixed(1) : '0';
      const comPct = r.ga > 0 ? ((r.com / r.ga) * 100).toFixed(1) : '0';

      html += `
        <tr>
          <td><span style="font-weight:700;color:var(--text-primary);">${r.v}</span><br><span style="font-size:0.7rem;color:var(--text-muted);">${r.c}</span></td>
          <td>${r.p}</td>
          <td><span class="decision-badge" style="background:rgba(6,182,212,0.12);color:var(--accent-cyan);">${r.b}</span></td>
          <td>${fmt.num(r.ga)}</td>
          <td><b>${fmt.num(r.pop)}</b> (${fmt.num(r.hh)} hh)</td>
          <td>${fmt.num(r.sc)} <span style="font-size:0.7rem;color:var(--text-muted);">(${scPct}%)</span></td>
          <td style="color:var(--accent-emerald);font-weight:600;">${fmt.num(r.pas)}</td>
          <td>${fmt.num(r.cfrr || 0)}</td>
          <td style="font-weight:700;color:var(--accent-cyan);">${fmt.num(r.com)} <span style="font-size:0.7rem;color:var(--text-muted);">(${comPct}%)</span></td>
          <td>
            <button class="btn-pill" style="padding:0.2rem 0.5rem;font-size:0.7rem;" onclick="window.viewVillageDetails(${r.id})">
              Inspect
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function renderPagination(total, pages) {
    const info = document.getElementById('table-count-info');
    if (info) {
      const start = (state.table.page - 1) * state.table.pageSize + 1;
      const end = Math.min(total, state.table.page * state.table.pageSize);
      info.textContent = total > 0 ? `Showing ${start}-${end} of ${fmt.num(total)} villages` : '0 villages';
    }

    const container = document.getElementById('pagination-buttons');
    if (!container) return;

    let html = `
      <button class="page-btn" ${state.table.page === 1 ? 'disabled' : ''} onclick="window.gotoPage(${state.table.page - 1})">Prev</button>
    `;

    const maxP = Math.min(pages, 5);
    for (let p = 1; p <= maxP; p++) {
      html += `<button class="page-btn ${p === state.table.page ? 'active' : ''}" onclick="window.gotoPage(${p})">${p}</button>`;
    }
    if (pages > 5) {
      html += `<span style="padding:0 0.3rem;color:var(--text-muted);">...</span>`;
      html += `<button class="page-btn ${pages === state.table.page ? 'active' : ''}" onclick="window.gotoPage(${pages})">${pages}</button>`;
    }

    html += `
      <button class="page-btn" ${state.table.page === pages ? 'disabled' : ''} onclick="window.gotoPage(${state.table.page + 1})">Next</button>
    `;

    container.innerHTML = html;
  }

  // Global window helpers for inline HTML event triggers
  window.gotoPage = (p) => {
    state.table.page = p;
    filterAndRenderTable();
  };

  window.sortTable = (key) => {
    if (state.table.sortKey === key) {
      state.table.sortDir = state.table.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.table.sortKey = key;
      state.table.sortDir = 'desc';
    }
    filterAndRenderTable();
  };

  window.viewVillageDetails = (id) => {
    const v = state.villages.find(x => x.id === id);
    if (!v) return;

    const modal = document.getElementById('village-modal');
    const titleEl = document.getElementById('village-modal-title');
    const codeEl = document.getElementById('village-modal-code');
    const subtitleEl = document.getElementById('village-modal-subtitle');
    const bodyEl = document.getElementById('village-modal-body');

    if (!modal || !bodyEl) return;

    const distName = (state.data && state.data.district && state.data.district.name) || DISTRICT_CONFIG[state.activeDistrict]?.name || 'District';

    if (titleEl) titleEl.textContent = v.v;
    if (codeEl) codeEl.textContent = `CODE11: ${v.c}`;
    if (subtitleEl) subtitleEl.innerHTML = `<b>${v.p}</b> Gram Panchayat • <b>${v.b}</b> Block • <b>${distName}</b>`;

    const scPct = v.pop > 0 ? ((v.sc / v.pop) * 100).toFixed(1) : '0.0';
    const stPct = v.pop > 0 ? ((v.st / v.pop) * 100).toFixed(1) : '0.0';
    const comPct = v.ga > 0 ? ((v.com / v.ga) * 100).toFixed(1) : '0.0';
    const pasPct = v.ga > 0 ? ((v.pas / v.ga) * 100).toFixed(1) : '0.0';
    const sexRatio = v.m > 0 ? Math.round((v.f / v.m) * 1000) : 'N/A';

    let plotsHtml = '';
    if (v.plots && v.plots.length > 0) {
      plotsHtml = `
        <div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:1.25rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem;">
            <h4 style="font-size:0.95rem;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:0.4rem;margin:0;">
              <i data-lucide="shield-check" style="width:16px;height:16px;color:var(--accent-emerald);"></i>
              VBGRAMG Restoration & Intervention Works (${v.plots.length} Plot${v.plots.length > 1 ? 's' : ''})
            </h4>
            <span class="decision-badge green">VBGRAMG Active</span>
          </div>

          <div style="display:flex;flex-direction:column;gap:0.85rem;">
            ${v.plots.map((p, idx) => `
              <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:0.9rem;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;flex-wrap:wrap;gap:0.4rem;">
                  <div style="font-weight:700;font-size:0.9rem;color:var(--text-primary);">
                    #${idx + 1} ${p.name || 'Charagah Restoration Plot'}
                  </div>
                  <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span class="decision-badge ${p.status === 'COMPLETED' ? 'green' : 'blue'}">
                      ${p.status || 'ACTIVE'}
                    </span>
                    ${p.water_structure ? '<span class="decision-badge cyan">Water Harvesting</span>' : ''}
                  </div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:0.6rem;margin-bottom:0.6rem;">
                  <div class="popup-metric-box">
                    <span class="popup-metric-label">Restored Area</span>
                    <span class="popup-metric-val" style="color:var(--accent-cyan);">${p.area_ha || 0} Ha</span>
                  </div>
                  <div class="popup-metric-box">
                    <span class="popup-metric-label">CVS Status</span>
                    <span class="popup-metric-val" style="color:var(--accent-emerald);">${p.cvs === 'Y' ? 'Formed' : 'Pending'} ${p.cvs_date ? `(${p.cvs_date})` : ''}</span>
                  </div>
                  <div class="popup-metric-box">
                    <span class="popup-metric-label">Demarcation</span>
                    <span class="popup-metric-val">${p.demarcation === 'Y' ? 'Yes' : 'Pending'}</span>
                  </div>
                  <div class="popup-metric-box">
                    <span class="popup-metric-label">Village Bylaws</span>
                    <span class="popup-metric-val">${p.bylaws === 'Y' ? 'Yes' : 'Pending'}</span>
                  </div>
                </div>

                <div style="font-size:0.75rem;color:var(--text-muted);display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.4rem;">
                  <span>Scheme: <b>${p.scheme || 'VBGRAMG'}</b></span>
                  ${p.is_exact ? `<span>GPS (Field Verified): <b>${Number(p.lat).toFixed(4)}°N, ${Number(p.lng).toFixed(4)}°E</b></span>` : `<span style="color:var(--text-muted);">Coordinates: Block Reference</span>`}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      plotsHtml = `
        <div style="background:var(--bg-card);border:1px dashed var(--border-medium);border-radius:var(--radius-lg);padding:1.25rem;text-align:center;color:var(--text-muted);font-size:0.85rem;">
          <i data-lucide="info" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>
          No specific VBGRAMG intervention plots registered for this village in the Excel workbook.
        </div>
      `;
    }

    bodyEl.innerHTML = `
      <!-- 6-Stat Key Metric Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:0.75rem;">
        <div class="info-card" style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:1rem;">
          <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;letter-spacing:0.04em;">Total Area</div>
          <div style="font-size:1.35rem;font-weight:800;color:var(--accent-cyan);margin:0.2rem 0;">${fmt.num(v.ga)} <span style="font-size:0.8rem;font-weight:500;">Ha</span></div>
          <div style="font-size:0.72rem;color:var(--text-muted);">Village Geographical Area</div>
        </div>

        <div class="info-card" style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:1rem;">
          <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;letter-spacing:0.04em;">Common Land</div>
          <div style="font-size:1.35rem;font-weight:800;color:var(--accent-emerald);margin:0.2rem 0;">${fmt.num(v.com)} <span style="font-size:0.8rem;font-weight:500;">Ha</span></div>
          <div style="font-size:0.72rem;color:var(--accent-emerald);font-weight:600;">${comPct}% of Geographical Area</div>
        </div>

        <div class="info-card" style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:1rem;">
          <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;letter-spacing:0.04em;">Pasture (Gauchar)</div>
          <div style="font-size:1.35rem;font-weight:800;color:var(--accent-emerald);margin:0.2rem 0;">${fmt.num(v.pas)} <span style="font-size:0.8rem;font-weight:500;">Ha</span></div>
          <div style="font-size:0.72rem;color:var(--text-muted);">${pasPct}% of Total Land</div>
        </div>

        <div class="info-card" style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:1rem;">
          <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;letter-spacing:0.04em;">Population</div>
          <div style="font-size:1.35rem;font-weight:800;color:var(--text-primary);margin:0.2rem 0;">${fmt.num(v.pop)} <span style="font-size:0.8rem;font-weight:500;">Persons</span></div>
          <div style="font-size:0.72rem;color:var(--text-muted);">${fmt.num(v.hh)} Households (~${v.hh > 0 ? (v.pop / v.hh).toFixed(1) : 0}/hh)</div>
        </div>

        <div class="info-card" style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:1rem;">
          <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;letter-spacing:0.04em;">Demographics</div>
          <div style="font-size:1.15rem;font-weight:700;color:var(--text-primary);margin:0.2rem 0;">${fmt.num(v.m)} M • ${fmt.num(v.f)} F</div>
          <div style="font-size:0.72rem;color:var(--text-muted);">Sex Ratio: <b>${sexRatio}</b></div>
        </div>

        <div class="info-card" style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:1rem;">
          <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;letter-spacing:0.04em;">Social Equity</div>
          <div style="font-size:1.15rem;font-weight:700;color:var(--accent-purple);margin:0.2rem 0;">SC: ${scPct}% • ST: ${stPct}%</div>
          <div style="font-size:0.72rem;color:var(--text-muted);">${fmt.num(v.sc)} SC • ${fmt.num(v.st)} ST Persons</div>
        </div>
      </div>

      <!-- Land Breakdown & Governance Table -->
      <div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:1.25rem;">
        <h4 style="font-size:0.92rem;font-weight:700;color:var(--text-primary);margin-bottom:0.75rem;display:flex;align-items:center;gap:0.4rem;">
          <i data-lucide="layers" style="width:16px;height:16px;color:var(--accent-cyan);"></i>
          Revenue Land & Commons Governance (from Excel)
        </h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:0.6rem;">
          <div class="popup-metric-box">
            <span class="popup-metric-label">Pasture (Col 14)</span>
            <span class="popup-metric-val" style="color:var(--accent-emerald);">${fmt.num(v.pas)} Ha</span>
          </div>
          <div class="popup-metric-box">
            <span class="popup-metric-label">Potential CFRR (Col 15)</span>
            <span class="popup-metric-val" style="color:var(--accent-cyan);">${fmt.num(v.cfrr || 0)} Ha</span>
          </div>
          <div class="popup-metric-box">
            <span class="popup-metric-label">VBGRAMG Work (Col 27)</span>
            <span class="popup-metric-val" style="color:var(--accent-blue);">${fmt.num(v.vbg_ha || 0)} Ha</span>
          </div>
          <div class="popup-metric-box">
            <span class="popup-metric-label">Demarcation (Col 22)</span>
            <span class="popup-metric-val">${v.demarcation === 'Y' ? 'Yes' : 'Pending'}</span>
          </div>
          <div class="popup-metric-box">
            <span class="popup-metric-label">Bylaws (Col 21)</span>
            <span class="popup-metric-val">${v.bylaws === 'Y' ? 'Yes' : 'Pending'}</span>
          </div>
          <div class="popup-metric-box">
            <span class="popup-metric-label">Asset Register (Col 20)</span>
            <span class="popup-metric-val">${v.asset_register === 'Y' ? 'Yes' : 'Pending'}</span>
          </div>
        </div>
      </div>

      <!-- Restoration Plots -->
      ${plotsHtml}
    `;

    modal.classList.add('open');
    initLucideIcons();
  };

  // Export to Excel
  function exportToExcel() {
    if (!state.filteredVillages || !state.filteredVillages.length) {
      showToast('No data to export', 'error');
      return;
    }

    if (typeof XLSX === 'undefined') {
      showToast('Excel exporter loading...', 'info');
      return;
    }

    const exportRows = state.filteredVillages.map(v => ({
      'Village Name': v.v,
      'Census Code (CODE11)': v.c,
      'Gram Panchayat': v.p,
      'Block': v.b,
      'Geographical Area (Ha)': v.ga,
      'Total Households': v.hh,
      'Total Population': v.pop,
      'Male Population': v.m,
      'Female Population': v.f,
      'SC Population': v.sc,
      'ST Population': v.st,
      'Pasture Land (Ha)': v.pas,
      'Potential CFRR Area (Ha)': v.cfrr,
      'Total Common Land (Ha)': v.com,
      'CVS Formed': v.cvs,
      'CVS Resolution Date': v.cvs_date,
      'Pasture Demarcated': v.demarcation,
      'Bylaws Passed': v.bylaws,
      'Asset Register Maintained': v.asset_register,
      'Tenure Recognized under 170(1) (Ha)': v.pasture_recog_ha,
      'Encroachment Removed (Ha)': v.encroach_ha,
      'Work Done under VBGRAMG (Ha)': v.vbg_ha,
      'VBGRAMG Work Narration': v.vbg_work,
      'GPS Latitude': v.lat,
      'GPS Longitude': v.lng
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Villages');
    const dName = state.data?.district?.name || DISTRICT_CONFIG[state.activeDistrict]?.name || 'District';
    const filename = `${dName}_${state.activeBlock}_Villages_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast(`Exported ${exportRows.length} villages to Excel`, 'info');
  }

  // Filter blocks based on active decision filter (100% Real Excel Data)
  function getFilteredBlocks() {
    if (!state.data || !state.data.blocks) return [];
    if (state.activeDecisionFilter === 'ALL') return state.data.blocks;
    if (state.activeDecisionFilter === 'CRITICAL_PASTURE_DEFICIT') {
      return state.data.blocks.filter(b => (b.pasture / (b.geo_area || 1)) < 0.03 || b.pasture < 500);
    }
    if (state.activeDecisionFilter === 'HIGH_RESTORATION_POTENTIAL') {
      return state.data.blocks.filter(b => (b.cfrr || 0) > 1000);
    }
    if (state.activeDecisionFilter === 'HIGH_MARGINALIZED_POP') {
      return state.data.blocks.filter(b => (b.sc_pct || 0) > 20 || (b.st_pop / (b.population || 1)) > 0.15);
    }
    return state.data.blocks;
  }

  // Launch on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
