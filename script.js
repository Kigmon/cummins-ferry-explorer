const TABS = ['explore','map','settings'];

function changeTab(tab) {
  TABS.forEach(name => {
    const section = document.getElementById(name);
    const btn = document.querySelector(`.tab-button[data-tab="${name}"]`);
    if (section) section.style.display = name === tab ? '' : 'none';
    if (btn) btn.classList.toggle('active', name === tab);
  });
  if (tab === 'map' && map) {
    // ensure map resizes properly when shown
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }
}

document.querySelectorAll('.tab-button').forEach(btn => {
  btn.addEventListener('click', () => {
    changeTab(btn.dataset.tab);
  });
});

const campgroundCoords = { lat: 37.8896995, lon: -84.7683109 };

let settings = {
  origin: 'camp',
  radius: 2000,
  defaultCategories: ['cafe','bakery','restaurant']
};

function loadSettings() {
  const saved = localStorage.getItem('cfExplorerSettings');
  if (saved) {
    try { settings = JSON.parse(saved); } catch(e) { console.error(e); }
  }
  // Update form fields
  const originRadios = document.querySelectorAll('input[name="origin"]');
  originRadios.forEach(r => { r.checked = r.value === settings.origin; });
  document.getElementById('radiusInput').value = settings.radius;
  document.querySelectorAll('input[name="defaultCategory"]').forEach(cb => {
    cb.checked = settings.defaultCategories.includes(cb.value);
  });
  // Update map toggles
  document.getElementById('toggleCafe').checked = settings.defaultCategories.includes('cafe');
  document.getElementById('toggleBakery').checked = settings.defaultCategories.includes('bakery');
  document.getElementById('toggleRestaurant').checked = settings.defaultCategories.includes('restaurant');
}

function saveSettings(ev) {
  ev.preventDefault();
  // Gather values from form
  const origin = document.querySelector('input[name="origin"]:checked').value;
  const radius = parseInt(document.getElementById('radiusInput').value) || 2000;
  const defaultCats = Array.from(document.querySelectorAll('input[name="defaultCategory"]:checked')).map(cb => cb.value);
  settings = { origin, radius, defaultCategories: defaultCats };
  localStorage.setItem('cfExplorerSettings', JSON.stringify(settings));
  // Update toggles to match settings
  document.getElementById('toggleCafe').checked = defaultCats.includes('cafe');
  document.getElementById('toggleBakery').checked = defaultCats.includes('bakery');
  document.getElementById('toggleRestaurant').checked = defaultCats.includes('restaurant');
  // Refresh current category list
  fetchAndDisplayPlaces(document.getElementById('categorySelect').value);
}

document.getElementById('settingsForm').addEventListener('submit', saveSettings);

document.getElementById('categorySelect').addEventListener('change', () => {
  fetchAndDisplayPlaces(document.getElementById('categorySelect').value);
});

function getOriginCoords(callback) {
  if (settings.origin === 'camp') {
    callback(campgroundCoords);
  } else if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => callback({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => callback(campgroundCoords)
    );
  } else {
    callback(campgroundCoords);
  }
}

const categories = {
  cafe: { key: 'amenity', value: 'cafe', label: 'Coffee Shop' },
  bakery: { key: 'shop', value: 'bakery', label: 'Bakery' },
  restaurant: { key:'amenity', value:'restaurant', label:'Restaurant' }
};

function fetchAndDisplayPlaces(cat) {
  getOriginCoords(({lat, lon}) => {
    const radius = settings.radius;
    const c = categories[cat];
    const query = `[out:json][timeout:25];(node["${c.key}"="${c.value}"](around:${radius},${lat},${lon});way["${c.key}"="${c.value}"](around:${radius},${lat},${lon});rel["${c.key}"="${c.value}"](around:${radius},${lat},${lon}););out center;`;
    const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);
    fetch(url)
      .then(res => res.json())
      .then(data => {
        const places = data.elements.map(elem => {
          const coords = elem.lat !== undefined ? { lat: elem.lat, lon: elem.lon } : { lat: elem.center.lat, lon: elem.center.lon };
          const distance = haversine(lat, lon, coords.lat, coords.lon);
          return {
            id: elem.id,
            name: elem.tags.name || c.label,
            coords,
            distance,
            tags: elem.tags
          };
        }).sort((a,b) => a.distance - b.distance).slice(0, 20);
        renderPlacesList(places, cat);
        updateMapMarkers(cat, places);
      })
      .catch(err => console.error(err));
  });
}

function renderPlacesList(places, cat) {
  const list = document.getElementById('placesList');
  list.innerHTML = '';
  places.forEach(place => {
    const li = document.createElement('li');
    li.className = 'place-item';
    const img = document.createElement('img');
    img.className = 'place-image';
    img.src = generatePlaceholder(cat, place.id);
    img.alt = `${categories[cat].label} image`;
    const div = document.createElement('div');
    div.className = 'place-details';
    const title = document.createElement('h3');
    title.textContent = place.name;
    const dist = document.createElement('p');
    dist.textContent = `${place.distance.toFixed(2)} km away`;
    const desc = document.createElement('p');
    desc.textContent = generateDescription(cat, place.name);
    div.appendChild(title);
    div.appendChild(dist);
    div.appendChild(desc);
    li.appendChild(img);
    li.appendChild(div);
    list.appendChild(li);
  });
}

function generatePlaceholder(cat, id) {
  const hash = String(id).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const hue = hash % 360;
  const color = `hsl(${hue},70%,80%)`;
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = categories[cat].label.split(' ')[0];
  ctx.fillText(label, canvas.width / 2, canvas.height / 2);
  return canvas.toDataURL();
}

function generateDescription(cat, name) {
  const adjectives = ['cozy','popular','charming','trendy','friendly','local','delightful','hidden','lively','rustic'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const base = categories[cat].label.toLowerCase();
  return `A ${adj} ${base} near the campground.`;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

let map;
let markersLayer = {};
function initMap() {
  map = L.map('mapContainer').setView([campgroundCoords.lat, campgroundCoords.lon], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  markersLayer = {
    cafe: L.layerGroup().addTo(map),
    bakery: L.layerGroup().addTo(map),
    restaurant: L.layerGroup().addTo(map)
  };
}

function updateMapMarkers(cat, places) {
  if (!map) return;
  const layer = markersLayer[cat];
  layer.clearLayers();
  places.forEach(place => {
    const marker = L.marker([place.coords.lat, place.coords.lon]).bindPopup(`<strong>${place.name}</strong><br>${place.distance.toFixed(2)} km away`);
    layer.addLayer(marker);
  });
  // Fit bounds if map tab is visible
  if (document.getElementById('map').style.display !== 'none') {
    const visibleLatLngs = [];
    ['cafe','bakery','restaurant'].forEach(key => {
      const toggle = document.getElementById('toggle' + capitalize(key));
      if (toggle && toggle.checked) {
        markersLayer[key].eachLayer(l => visibleLatLngs.push(l.getLatLng()));
      }
    });
    if (visibleLatLngs.length) {
      const group = L.featureGroup(visibleLatLngs.map(latlng => L.marker(latlng)));
      map.fitBounds(group.getBounds().pad(0.2));
    }
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function applyToggleEvents() {
  document.getElementById('toggleCafe').addEventListener('change', () => toggleLayer('cafe'));
  document.getElementById('toggleBakery').addEventListener('change', () => toggleLayer('bakery'));
  document.getElementById('toggleRestaurant').addEventListener('change', () => toggleLayer('restaurant'));
}

function toggleLayer(cat) {
  const toggle = document.getElementById('toggle' + capitalize(cat));
  if (toggle.checked) {
    markersLayer[cat].addTo(map);
  } else {
    map.removeLayer(markersLayer[cat]);
  }
  // Recalculate fit bounds when toggling
  updateMapMarkers(cat, []);
}

document.addEventListener('DOMContentLoaded', () => {
  changeTab('explore');
  loadSettings();
  initMap();
  applyToggleEvents();
  fetchAndDisplayPlaces(document.getElementById('categorySelect').value);
});
