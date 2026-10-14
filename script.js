const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

const $ = (id) => document.getElementById(id);

const els = {
  search: $("search-input"),
  suggestions: $("suggestions"),
  currentCard: $("current-card"),
  weatherIcon: $("weather-icon"),
  currentTemp: $("current-temp"),
  currentPlace: $("current-place"),
  currentCondition: $("current-condition"),
  currentHumidity: $("current-humidity"),
  currentWind: $("current-wind"),
  currentTime: $("current-time"),
  chartHint: $("chart-hint"),
  jsonHint: $("json-hint"),
  jsonOutput: $("json-output"),
  status: $("status"),
};

const state = {
  chart: null,
  map: null,
  marker: null,
  searchAbort: null,
  weatherAbort: null,
  snowLayer: null,
};

const WMO = {
  0: ["Céu limpo", "ri-sun-line"],
  1: ["Predominantemente limpo", "ri-sun-cloudy-line"],
  2: ["Parcialmente nublado", "ri-cloudy-2-line"],
  3: ["Encoberto", "ri-cloudy-line"],
  45: ["Nevoeiro", "ri-foggy-line"],
  48: ["Nevoeiro com geada", "ri-foggy-line"],
  51: ["Garoa fraca", "ri-drizzle-line"],
  53: ["Garoa", "ri-drizzle-line"],
  55: ["Garoa intensa", "ri-rainy-line"],
  56: ["Garoa congelante", "ri-rainy-line"],
  57: ["Garoa congelante intensa", "ri-rainy-line"],
  61: ["Chuva fraca", "ri-drizzle-line"],
  63: ["Chuva", "ri-rainy-line"],
  65: ["Chuva forte", "ri-rainy-line"],
  66: ["Chuva congelante", "ri-rainy-line"],
  67: ["Chuva congelante forte", "ri-rainy-line"],
  71: ["Neve fraca", "ri-snowy-line"],
  73: ["Neve", "ri-snowy-line"],
  75: ["Neve forte", "ri-snowflake-line"],
  77: ["Grãos de neve", "ri-snowy-line"],
  80: ["Pancadas isoladas", "ri-drizzle-line"],
  81: ["Pancadas de chuva", "ri-rainy-line"],
  82: ["Pancadas fortes", "ri-rainy-line"],
  85: ["Pancadas de neve", "ri-snowy-line"],
  86: ["Pancadas de neve fortes", "ri-snowy-line"],
  95: ["Trovoada", "ri-thunderstorms-line"],
  96: ["Trovoada com granizo", "ri-thunderstorms-line"],
  99: ["Trovoada forte com granizo", "ri-thunderstorms-line"],
};

function wmoInfo(code) {
  return WMO[code] || ["Dados indisponíveis", "ri-question-line"];
}

function setStatus(message, isError = false) {
  if (!message) {
    els.status.classList.add("hidden");
    return;
  }
  const icon = isError ? "ri-error-warning-line" : "ri-loader-4-line";
  els.status.innerHTML = `<i class="${icon}"></i> ${message}`;
  els.status.classList.toggle("error", isError);
  els.status.classList.remove("hidden");
}

function formatLabel(iso) {
  const [date, time] = iso.split("T");
  const [, m, d] = date.split("-");
  return `${d}/${m} ${time.slice(0, 5)}`;
}

function formatCurrentTime(iso) {
  const [date, time] = iso.split("T");
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y} ${time.slice(0, 5)}`;
}

// ---------- Sidebar / Navegação ----------

document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.tab).classList.add("active");
    closeSidebar();
    if (btn.dataset.tab === "map" && state.map) {
      setTimeout(() => state.map.invalidateSize(), 100);
    }
    if (btn.dataset.tab === "chart" && state.chart) {
      setTimeout(() => state.chart.resize(), 100);
    }
  });
});

// ---------- Busca de local ----------

let debounceTimer = null;

els.search.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  const query = els.search.value.trim();
  if (query.length < 2) {
    hideSuggestions();
    return;
  }
  debounceTimer = setTimeout(() => searchLocations(query), 300);
});

els.search.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    clearTimeout(debounceTimer);
    const first = els.suggestions.querySelector("li");
    if (first) first.click();
  }
  if (e.key === "Escape") hideSuggestions();
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-box")) hideSuggestions();
});

function hideSuggestions() {
  els.suggestions.classList.add("hidden");
}

async function searchLocations(query) {
  if (state.searchAbort) state.searchAbort.abort();
  state.searchAbort = new AbortController();

  try {
    const url = `${GEO_URL}?name=${encodeURIComponent(query)}&count=8&language=pt&format=json`;
    const res = await fetch(url, { signal: state.searchAbort.signal });
    if (!res.ok) throw new Error(`Erro ${res.status} na API de geocoding`);
    const data = await res.json();
    renderSuggestions(data.results || []);
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error(err);
      setStatus("Não foi possível buscar locais. Verifique sua conexão.", true);
    }
  }
}

function renderSuggestions(results) {
  els.suggestions.innerHTML = "";

  if (!results.length) {
    const li = document.createElement("li");
    li.textContent = "Nenhum local encontrado";
    li.style.color = "var(--muted)";
    li.style.cursor = "default";
    els.suggestions.appendChild(li);
    els.suggestions.classList.remove("hidden");
    return;
  }

  results.forEach((r) => {
    const li = document.createElement("li");

    const name = document.createElement("span");
    const extras = [r.admin1, r.country].filter(Boolean).join(", ");
    name.textContent = r.name + (extras ? ` — ${extras}` : "");

    const coords = document.createElement("span");
    coords.className = "place-country";
    coords.textContent = `${r.latitude.toFixed(2)}, ${r.longitude.toFixed(2)}`;

    li.append(name, coords);
    li.addEventListener("click", () => {
      hideSuggestions();
      els.search.value = r.name;
      const label = [r.name, r.country].filter(Boolean).join(", ");
      loadWeather(r.latitude, r.longitude, label, { pan: true, placeOnMap: true });
    });
    els.suggestions.appendChild(li);
  });

  els.suggestions.classList.remove("hidden");
}

// ---------- Clima ----------

async function loadWeather(lat, lon, label, opts = {}) {
  if (state.weatherAbort) state.weatherAbort.abort();
  state.weatherAbort = new AbortController();

  setStatus("Buscando dados do clima...");
  els.currentCard.classList.add("hidden");

  try {
    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
      hourly: "temperature_2m",
      past_days: "2",
      forecast_days: "5",
      timezone: "auto",
    });

    const res = await fetch(`${FORECAST_URL}?${params}`, {
      signal: state.weatherAbort.signal,
    });
    if (!res.ok) throw new Error(`Erro ${res.status} na API de clima`);
    const data = await res.json();

    setStatus("");
    renderCurrent(data, label);
    renderChart(data);
    renderJson(data);

    if (opts.pan && state.map) {
      state.map.setView([lat, lon], 10);
    }
    if (opts.placeOnMap) {
      placeMarker(lat, lon, data, label);
    }
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error(err);
    setStatus("Falha ao obter dados do clima. Tente novamente.", true);
  }
}

function renderCurrent(data, label) {
  const cur = data.current;
  const [condition, icon] = wmoInfo(cur.weather_code);

  els.weatherIcon.innerHTML = `<i class="${icon}"></i>`;
  els.currentTemp.textContent = `${Math.round(cur.temperature_2m)}°C`;
  els.currentPlace.textContent = label;
  els.currentCondition.textContent = condition;
  els.currentHumidity.textContent = `${cur.relative_humidity_2m}%`;
  els.currentWind.textContent = `${cur.wind_speed_10m} km/h`;
  els.currentTime.textContent = formatCurrentTime(cur.time);
  els.currentCard.classList.remove("hidden");
}

function renderJson(data) {
  els.jsonOutput.textContent = JSON.stringify(data, null, 2);
  els.jsonOutput.classList.remove("hidden");
  els.jsonHint.classList.add("hidden");
}

// ---------- Gráfico ----------

// Encontra a hora cheia mais próxima anterior ou igual ao momento atual.
// data.current.time pode ter minutos (ex: 21:30), enquanto hourly.time é cheio (21:00),
// por isso indexOf() falharia e o histórico sumiria do gráfico.
function findNowIndex(times, now) {
  const nowKey = String(now).slice(0, 16);
  for (let i = times.length - 1; i >= 0; i--) {
    if (String(times[i]).slice(0, 16) <= nowKey) return i;
  }
  return 0;
}

function renderChart(data) {
  const times = data.hourly.time;
  const temps = data.hourly.temperature_2m;
  const nowIndex = findNowIndex(times, data.current.time);

  const past = temps.map((t, i) => (i <= nowIndex ? t : null));
  const future = temps.map((t, i) => (i >= nowIndex ? t : null));
  const nowPoint = temps.map((_, i) => (i === nowIndex ? temps[i] : null));

  const labels = times.map(formatLabel);

  els.chartHint.classList.add("hidden");

  const config = {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Histórico",
          data: past,
          borderColor: "#9ca3af",
          backgroundColor: "rgba(156,163,175,0.15)",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          spanGaps: false,
        },
        {
          label: "Previsão",
          data: future,
          borderColor: "#f5c518",
          backgroundColor: "rgba(245,197,24,0.15)",
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          tension: 0.3,
          spanGaps: false,
        },
        {
          label: "Agora",
          data: nowPoint,
          borderColor: "#facc15",
          backgroundColor: "#facc15",
          pointRadius: 7,
          pointHoverRadius: 9,
          pointStyle: "circle",
          showLine: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              ctx.parsed.y === null
                ? null
                : `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} °C`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#94a3b8",
            maxTicksLimit: 14,
            maxRotation: 0,
            autoSkip: true,
          },
          grid: { color: "rgba(255,255,255,0.07)" },
        },
        y: {
          title: {
            display: true,
            text: "Temperatura (°C)",
            color: "#94a3b8",
          },
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(255,255,255,0.07)" },
        },
      },
    },
  };

  if (state.chart) {
    state.chart.data = config.data;
    state.chart.options = config.options;
    state.chart.update();
  } else {
    state.chart = new Chart($("temp-chart"), config);
  }
}

// ---------- Mapa ----------

function initMap() {
  state.map = L.map("map-canvas").setView([20, 0], 2);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(state.map);

  state.map.on("click", async (e) => {
    const { lat, lng } = e.latlng;
    setStatus("Buscando local e clima...");
    const label = await reverseGeocode(lat, lng);
    loadWeather(lat, lng, label, { placeOnMap: true });
  });
}

// ---------- Neve (onde está nevando) ----------

const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

const CITIES = [
  { n: "Anchorage", lat: 61.22, lon: -149.90 },
  { n: "Fairbanks", lat: 64.84, lon: -147.72 },
  { n: "Iqaluit", lat: 63.75, lon: -68.52 },
  { n: "Yellowknife", lat: 62.45, lon: -114.37 },
  { n: "Whitehorse", lat: 60.72, lon: -135.05 },
  { n: "Nuuk", lat: 64.18, lon: -51.72 },
  { n: "Vancouver", lat: 49.28, lon: -123.12 },
  { n: "Calgary", lat: 51.05, lon: -114.07 },
  { n: "Edmonton", lat: 53.55, lon: -113.49 },
  { n: "Winnipeg", lat: 49.90, lon: -97.14 },
  { n: "Toronto", lat: 43.65, lon: -79.38 },
  { n: "Montreal", lat: 45.50, lon: -73.57 },
  { n: "Quebec", lat: 46.81, lon: -71.21 },
  { n: "New York", lat: 40.71, lon: -74.01 },
  { n: "Chicago", lat: 41.88, lon: -87.63 },
  { n: "Denver", lat: 39.74, lon: -104.99 },
  { n: "Minneapolis", lat: 44.98, lon: -93.27 },
  { n: "Salt Lake City", lat: 40.76, lon: -111.89 },
  { n: "Seattle", lat: 47.61, lon: -122.33 },
  { n: "Boston", lat: 42.36, lon: -71.06 },
  { n: "Washington", lat: 38.91, lon: -77.04 },
  { n: "Mexico City", lat: 19.43, lon: -99.13 },
  { n: "Bogotá", lat: 4.71, lon: -74.07 },
  { n: "Quito", lat: -0.18, lon: -78.47 },
  { n: "La Paz", lat: -16.50, lon: -68.15 },
  { n: "Santiago", lat: -33.45, lon: -70.67 },
  { n: "Ushuaia", lat: -54.80, lon: -68.30 },
  { n: "Reykjavik", lat: 64.15, lon: -21.94 },
  { n: "Longyearbyen", lat: 78.22, lon: 15.64 },
  { n: "Tromsø", lat: 69.65, lon: 18.96 },
  { n: "Rovaniemi", lat: 66.50, lon: 25.73 },
  { n: "Murmansk", lat: 68.97, lon: 33.08 },
  { n: "Norilsk", lat: 69.35, lon: 88.20 },
  { n: "Oslo", lat: 59.91, lon: 10.75 },
  { n: "Stockholm", lat: 59.33, lon: 18.07 },
  { n: "Helsinki", lat: 60.17, lon: 24.94 },
  { n: "Copenhagen", lat: 55.68, lon: 12.57 },
  { n: "Tallinn", lat: 59.44, lon: 24.75 },
  { n: "Riga", lat: 56.95, lon: 24.11 },
  { n: "Vilnius", lat: 54.69, lon: 25.28 },
  { n: "Moscow", lat: 55.75, lon: 37.62 },
  { n: "Saint Petersburg", lat: 59.93, lon: 30.34 },
  { n: "Kyiv", lat: 50.45, lon: 30.52 },
  { n: "Minsk", lat: 53.90, lon: 27.57 },
  { n: "Warsaw", lat: 52.23, lon: 21.01 },
  { n: "Berlin", lat: 52.52, lon: 13.41 },
  { n: "Prague", lat: 50.08, lon: 14.44 },
  { n: "Vienna", lat: 48.21, lon: 16.37 },
  { n: "Zurich", lat: 47.38, lon: 8.54 },
  { n: "Bern", lat: 46.95, lon: 7.45 },
  { n: "Munich", lat: 48.14, lon: 11.58 },
  { n: "Paris", lat: 48.86, lon: 2.35 },
  { n: "London", lat: 51.51, lon: -0.13 },
  { n: "Dublin", lat: 53.35, lon: -6.26 },
  { n: "Amsterdam", lat: 52.37, lon: 4.90 },
  { n: "Brussels", lat: 50.85, lon: 4.35 },
  { n: "Madrid", lat: 40.42, lon: -3.70 },
  { n: "Rome", lat: 41.90, lon: 12.50 },
  { n: "Belgrade", lat: 44.79, lon: 20.45 },
  { n: "Bucharest", lat: 44.43, lon: 26.10 },
  { n: "Sofia", lat: 42.70, lon: 23.32 },
  { n: "Athens", lat: 37.98, lon: 23.73 },
  { n: "Istanbul", lat: 41.01, lon: 28.98 },
  { n: "Ankara", lat: 39.93, lon: 32.86 },
  { n: "Tbilisi", lat: 41.72, lon: 44.79 },
  { n: "Yerevan", lat: 40.18, lon: 44.51 },
  { n: "Baku", lat: 40.41, lon: 49.87 },
  { n: "Tehran", lat: 35.69, lon: 51.39 },
  { n: "Kabul", lat: 34.53, lon: 69.17 },
  { n: "Islamabad", lat: 33.68, lon: 73.05 },
  { n: "Almaty", lat: 43.24, lon: 76.89 },
  { n: "Astana", lat: 51.17, lon: 71.45 },
  { n: "Novosibirsk", lat: 55.03, lon: 82.92 },
  { n: "Irkutsk", lat: 52.29, lon: 104.30 },
  { n: "Yakutsk", lat: 62.03, lon: 129.73 },
  { n: "Ulaanbaatar", lat: 47.89, lon: 106.91 },
  { n: "Beijing", lat: 39.90, lon: 116.41 },
  { n: "Harbin", lat: 45.80, lon: 126.53 },
  { n: "Urumqi", lat: 43.83, lon: 87.62 },
  { n: "Seoul", lat: 37.57, lon: 126.98 },
  { n: "Tokyo", lat: 35.68, lon: 139.69 },
  { n: "Sapporo", lat: 43.06, lon: 141.35 },
  { n: "Delhi", lat: 28.61, lon: 77.21 },
  { n: "Kathmandu", lat: 27.72, lon: 85.32 },
  { n: "Cairo", lat: 30.04, lon: 31.24 },
  { n: "Casablanca", lat: 33.57, lon: -7.59 },
  { n: "Algiers", lat: 36.75, lon: 3.06 },
  { n: "Tunis", lat: 36.81, lon: 10.18 },
  { n: "Cape Town", lat: -33.92, lon: 18.42 },
  { n: "Johannesburg", lat: -26.20, lon: 28.05 },
  { n: "Nairobi", lat: -1.29, lon: 36.82 },
  { n: "Addis Ababa", lat: 9.02, lon: 38.75 },
  { n: "Antananarivo", lat: -18.88, lon: 47.51 },
  { n: "Sydney", lat: -33.87, lon: 151.21 },
  { n: "Melbourne", lat: -37.81, lon: 144.96 },
  { n: "Canberra", lat: -35.28, lon: 149.13 },
  { n: "Hobart", lat: -42.88, lon: 147.33 },
  { n: "Queenstown", lat: -45.03, lon: 168.66 },
  { n: "Auckland", lat: -36.85, lon: 174.76 },
];

async function fetchChunkSnow(chunk) {
  const params = new URLSearchParams({
    latitude: chunk.map((c) => c.lat).join(","),
    longitude: chunk.map((c) => c.lon).join(","),
    current: "temperature_2m,weather_code,snowfall",
    timezone: "auto",
  });
  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error(`Erro ${res.status} ao consultar neve`);
  const data = await res.json();
  const arr = Array.isArray(data) ? data : [data];
  return arr.map((d, i) => ({ city: chunk[i], current: d.current }));
}

async function showSnowing() {
  const btn = $("snow-btn");
  const span = btn.querySelector("span");

  if (state.snowLayer) {
    state.map.removeLayer(state.snowLayer);
    state.snowLayer = null;
    btn.classList.remove("active");
    span.textContent = "Onde está nevando?";
    setStatus("");
    return;
  }

  btn.disabled = true;
  span.textContent = "Buscando...";
  setStatus(`Consultando ${CITIES.length} cidades ao redor do mundo...`);

  try {
    const chunks = [];
    for (let i = 0; i < CITIES.length; i += 80) {
      chunks.push(CITIES.slice(i, i + 80));
    }
    const results = (await Promise.all(chunks.map(fetchChunkSnow))).flat();

    const snowing = results.filter(
      ({ current }) => SNOW_CODES.has(current.weather_code) || current.snowfall > 0
    );

    state.snowLayer = L.layerGroup();
    snowing.forEach(({ city, current }) => {
      const [condition, icon] = wmoInfo(current.weather_code);
      const snowInfo = current.snowfall > 0 ? `Neve: ${current.snowfall} cm/h` : "Neve no local";
      L.marker([city.lat, city.lon], {
        icon: L.divIcon({
          className: "",
          html: '<div class="snow-marker"><i class="ri-snowflake-line"></i></div>',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      })
        .bindPopup(
          `<div>
             <div class="popup-temp"><i class="${icon}"></i> ${Math.round(current.temperature_2m)}°C</div>
             <div>${escapeHtml(condition)}</div>
             <div class="popup-place">${escapeHtml(city.n)} · ${escapeHtml(snowInfo)}</div>
           </div>`
        )
        .addTo(state.snowLayer);
    });

    state.snowLayer.addTo(state.map);
    btn.classList.add("active");
    span.textContent = "Ocultar neve";

    if (snowing.length) {
      const bounds = L.featureGroup(state.snowLayer.getLayers()).getBounds().pad(0.2);
      state.map.fitBounds(bounds);
      setStatus(`${snowing.length} de ${CITIES.length} cidades monitoradas com neve agora.`);
    } else {
      setStatus(`Nenhuma das ${CITIES.length} cidades monitoradas está com neve agora.`);
    }
  } catch (err) {
    console.error(err);
    setStatus("Não foi possível consultar a neve agora.", true);
    btn.classList.remove("active");
    span.textContent = "Onde está nevando?";
  } finally {
    btn.disabled = false;
  }
}

async function reverseGeocode(lat, lon) {
  try {
    const url = `${NOMINATIM_URL}?format=jsonv2&zoom=10&lat=${lat}&lon=${lon}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Erro ${res.status}`);
    const data = await res.json();
    const a = data.address || {};
    const parts = [a.city || a.town || a.village || a.county || a.state, a.country];
    return parts.filter(Boolean).join(", ") || `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
  } catch (err) {
    console.error(err);
    return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function placeMarker(lat, lon, data, label) {
  const [condition, icon] = wmoInfo(data.current.weather_code);
  const popup = `
    <div>
      <div class="popup-temp"><i class="${icon}"></i> ${Math.round(data.current.temperature_2m)}°C</div>
      <div>${escapeHtml(condition)}</div>
      <div class="popup-place">${escapeHtml(label)}</div>
    </div>`;

  if (state.marker) {
    state.marker.setLatLng([lat, lon]).bindPopup(popup).openPopup();
  } else {
    state.marker = L.marker([lat, lon]).addTo(state.map);
    state.marker.bindPopup(popup).openPopup();
  }
}

function closeSidebar() {
  $("sidebar").classList.remove("open");
  $("sidebar-overlay").classList.remove("show");
}

$("menu-toggle").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
  $("sidebar-overlay").classList.toggle("show");
});

$("sidebar-overlay").addEventListener("click", closeSidebar);

initMap();
$("snow-btn").addEventListener("click", showSnowing);
