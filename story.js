// Story engine & content for a trip-long choose-your-own-adventure
const CAMP = { name: "Cummins Ferry RV Park + Campground", lat: 37.8896995, lon: -84.7683109 };

// Persistent settings
const Settings = {
  get() {
    const d = JSON.parse(localStorage.getItem("cf_cyoa_settings") || "{}");
    return {
      start: d.start || null,
      end: d.end || null,
      originMode: d.originMode || "gps",
      radiusMiles: d.radiusMiles || 15
    };
  },
  set(partial) {
    const now = { ...Settings.get(), ...partial };
    localStorage.setItem("cf_cyoa_settings", JSON.stringify(now));
    return now;
  }
};

// Geolocation helper
const Geo = {
  async current() {
    const s = Settings.get();
    if (s.originMode === "camp") return {lat: CAMP.lat, lon: CAMP.lon, source: "Campground"};
    return new Promise((resolve)=>{
      navigator.geolocation.getCurrentPosition(
        pos => resolve({lat: pos.coords.latitude, lon: pos.coords.longitude, source: "GPS"}),
        _ => resolve({lat: CAMP.lat, lon: CAMP.lon, source: "Campground (fallback)"}),
        { enableHighAccuracy:true, timeout: 8000 }
      );
    });
  },
  miles(a,b){
    const toRad = x => x * Math.PI / 180;
    const R = 3958.7613;
    const dLat = toRad(b.lat-a.lat), dLon = toRad(b.lon-a.lon);
    const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
    const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
  }
};

// Overpass API for nearby venues
const Overpass = {
  async searchNearby({center, radiusMeters, kind}){
    const queries = {
      coffee: [
        'node["amenity"="cafe"]',
        'node["amenity"="coffee_shop"]',
        'way["amenity"="cafe"]'
      ],
      breakfast: [
        'node["amenity"="cafe"]',
        'node["shop"="bakery"]',
        'node["amenity"="restaurant"]'
      ],
      food: [
        'node["amenity"="restaurant"]',
        'way["amenity"="restaurant"]'
      ]
    }[kind] || [];
    if (!queries.length) return [];
    const around = `(${radiusMeters},${center.lat},${center.lon})`;
    const body = `[out:json][timeout:25];(${queries.map(q=>`${q}(around:${around})`).join(";")});out center 100;`;
    const res = await fetch("https://overpass-api.de/api/interpreter",{
      method:"POST",
      headers:{ "Content-Type":"application/x-www-form-urlencoded; charset=UTF-8" },
      body: new URLSearchParams({ data: body }).toString()
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.elements||[]).map(el=>{
      const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
      const name = el.tags?.name || "Local spot";
      return { id:String(el.id), lat, lon, name, tags: el.tags||{} };
    }).filter(x=>x.lat && x.lon);
  }
};

// Curated nearby landmark coords for story arcs
const Landmarks = {
  shakerVillage: { name: "Shaker Village of Pleasant Hill", lat: 37.8164, lon: -84.7403, tag: "history" },
  highBridge:   { name: "High Bridge Overlook", lat: 37.7795, lon: -84.7162, tag: "river" },
  tomDorman:    { name: "Tom Dorman State Nature Preserve", lat: 37.7589, lon: -84.6392, tag: "trail" }
};

// Utility to format miles
const fmtMiles = (m) => `${m.toFixed(1)} mi`;

// Story content templates — light, witty, all-ages
const Story = {
  titleFor(day, part){
    const names = { morning:"Morning", midday:"Afternoon", evening:"Evening" };
    return `Day ${day} — ${names[part]}`;
  },
  textIntro(dateStr){
    return `Fog curls off the Kentucky River as you unzip the tent at <b>${CAMP.name}</b>. The limestone palisades glow pale gold and a kingfisher scolds the sun for sleeping in. Your trip begins <b>${dateStr}</b>, and the story will follow you day by day—gently nudging you toward tasty bites and pretty sights while keeping everything kid‑friendly.`;
  },
  morning(){
    return `The campground stirs. Someone’s flipping pancakes. Somewhere else, a horse nickers as if to say, “coffee?” What will you reach for first?`;
  },
  midday(){
    return `Bellies content, it’s time to roam. These hills remember Shaker songs, iron rails, and riverboats. Pick a path and the tale will tag along.`;
  },
  evening(){
    return `Fireflies spark to life and the river turns to ink. One last adventure before pajamas? Or a campfire story older than the cliffs?`;
  },
  // Dynamic epilogues when a destination is chosen
  epilogue(placeName, vibe){
    const lines = {
      coffee:`At <b>${placeName}</b>, the barista draws a tiny horse in the foam. You swear it winks. Energy: restored.`,
      breakfast:`<b>${placeName}</b> serves up warm things and warmer smiles. A crumb escapes; a sparrow volunteers for cleanup.`,
      food:`You swap bites at <b>${placeName}</b> and declare everything “the winner.” Democracy in action.`,
      history:`Guides whisper neat facts and not‑so‑secret trivia. The past feels very present—and photogenic.`,
      river:`From the overlook, the <i>river</i> draws a long S through the stone like a story that forgot to end.`,
      trail:`On the trail, cedar and limestone argue softly about whose turn it is to smell amazing today.`
    };
    return lines[vibe] || `You enjoy your time at <b>${placeName}</b>. Memory: saved.`;
  }
};

// Chapter factories (produce choices)
async function chapterMorning(day){
  const origin = await Geo.current();
  const miles = Settings.get().radiusMiles;
  const radiusMeters = Math.round(miles * 1609.34);
  const results = await Overpass.searchNearby({center:origin, radiusMeters, kind:"coffee"});
  const enriched = results.map(r => ({...r, distance: Geo.miles(origin,{lat:r.lat,lon:r.lon})}))
                         .sort((a,b)=>a.distance-b.distance).slice(0,4);
  const choices = [
    ...enriched.map(r => ({
      id: "coffee:"+r.id, label: r.name,
      meta: `${fmtMiles(r.distance)} · coffee`,
      onChoose: () => showEpilogue(day,"morning", r.name, "coffee")
    })),
    {
      id:"breakfast-any", label:"Find a hearty breakfast nearby",
      meta:"We’ll search restaurants & bakeries",
      onChoose: async () => {
        const results2 = await Overpass.searchNearby({center:origin, radiusMeters, kind:"breakfast"});
        const sorted = results2.map(r => ({...r, distance:Geo.miles(origin,{lat:r.lat,lon:r.lon})}))
                               .sort((a,b)=>a.distance-b.distance).slice(0,4);
        renderChoices("Breakfast quests", "coffee",
          `Choose breakfast based on the group's mood. Distances from <b>${origin.source}</b>.`,
          sorted.map(r => ({
            id:"bf:"+r.id,
            label:r.name,
            meta:`${fmtMiles(r.distance)} · breakfast`,
            onChoose:()=>showEpilogue(day,"morning", r.name, "breakfast")
          }))
        );
      }
    }
  ];
  renderChapter(Story.titleFor(day,"morning"), "coffee", Story.morning(), choices);
}

async function chapterMidday(day){
  const origin = await Geo.current();
  const options = [
    Landmarks.shakerVillage,
    Landmarks.highBridge,
    Landmarks.tomDorman
  ].map(L => ({
    ...L, distance: Geo.miles(origin, {lat:L.lat, lon:L.lon})
  })).sort((a,b)=>a.distance-b.distance);
  const choices = options.map(L => ({
    id:"lm:"+L.name,
    label: L.name,
    meta: `${fmtMiles(L.distance)} · ${L.tag}`,
    onChoose:()=>showEpilogue(day,"midday", L.name, L.tag)
  }));
  renderChapter(Story.titleFor(day,"midday"), "trail", Story.midday(), choices);
}

async function chapterEvening(day){
  const origin = await Geo.current();
  const choices = [
    { id:"campfire", label:"Campfire tales & s’mores", meta:"Low miles · maximum cozy", onChoose:()=>showEpilogue(day,"evening","the campfire circle","campfire")},
    { id:"stargaze", label:"Stargazing by the river", meta:"Bring a blanket", onChoose:()=>showEpilogue(day,"evening","the riverbank","river")},
    { id:"nightwalk", label:"Short night walk", meta:"Fireflies likely", onChoose:()=>showEpilogue(day,"evening","the campground trail","trail")},
  ];
  renderChapter(Story.titleFor(day,"evening"), "campfire", Story.evening(), choices);
}

// Show chapter text and choices
function renderChapter(title, artTheme, paragraph, choices){
  document.getElementById("title").innerHTML = title;
  document.getElementById("text").innerHTML = paragraph;
  document.getElementById("art").innerHTML = whimsicalSVG(title+paragraph, artTheme);
  const c = document.getElementById("choices");
  c.innerHTML = "";
  choices.forEach(ch => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.innerHTML = `<div><div>${ch.label}</div>` + (ch.meta? `<span class="muted">${ch.meta}</span>`:"") + `</div>`;
    btn.addEventListener("click", ch.onChoose);
    c.appendChild(btn);
  });
}

// Show epilogue then advance to next chapter automatically
function showEpilogue(day, part, placeName, vibe){
  const title = `A stop at ${placeName}`;
  document.getElementById("title").innerHTML = title;
  document.getElementById("text").innerHTML = Story.epilogue(placeName, vibe);
  document.getElementById("art").innerHTML = whimsicalSVG(title+placeName, part==="morning"?"coffee":(part==="midday"?"trail":"campfire"));
  const c = document.getElementById("choices");
  c.innerHTML = "";
  const seq = part==="morning" ? "midday" : (part==="midday" ? "evening" : "nextday");
  const nextBtn = document.createElement("button");
  nextBtn.className="choice";
  nextBtn.innerHTML = seq==="nextday" ? "Wrap up the day →" : "Onward →";
  nextBtn.addEventListener("click", async ()=>{
    if (seq==="midday") await chapterMidday(day);
    else if (seq==="evening") await chapterEvening(day);
    else await beginDay(day+1);
  });
  c.appendChild(nextBtn);
}

// Begin a day’s sequence (morning first)
async function beginDay(day){
  const s = Settings.get();
  const start = s.start ? new Date(s.start) : null;
  const d = start ? new Date(start.getTime() + (day-1)*86400000) : null;
  const dateLabel = d ? d.toLocaleDateString(undefined,{weekday:"long", month:"short", day:"numeric"}) : `Day ${day}`;
  document.getElementById("title").innerHTML = `Day ${day} begins — ${dateLabel}`;
  document.getElementById("text").innerHTML = Story.morning();
  document.getElementById("art").innerHTML = whimsicalSVG("day"+day, "river");
  document.getElementById("choices").innerHTML = "";
  await chapterMorning(day);
}

// Entry: build intro or resume
async function startStory(){
  const s = Settings.get();
  const dateStr = s.start && s.end ? `${new Date(s.start).toLocaleDateString()} to ${new Date(s.end).toLocaleDateString()}` : "soon™";
  document.getElementById("title").innerHTML = "Welcome to the Palisades";
  document.getElementById("text").innerHTML = Story.textIntro(dateStr);
  document.getElementById("art").innerHTML = whimsicalSVG("intro","river");
  const c = document.getElementById("choices");
  c.innerHTML = "";
  const go = document.createElement("button");
  go.className = "choice";
  go.textContent = "Begin Day 1";
  go.addEventListener("click", ()=>beginDay(1));
  c.appendChild(go);
}

function renderChoices(title, artTheme, paragraph, choices){
  return renderChapter(title, artTheme, paragraph, choices);
}

async function nextOptions(day, seq){
 
  const opts = [];
  if (seq === "midday"){
    const origin = await Geo.current();
    const mids = [Landmarks.shakerVillage, Landmarks.highBridge, Landmarks.tomDorman]
      .map(L => ({...L, distance: Geo.miles(origin, {lat:L.lat, lon:L.lon})}))
      .sort((a,b)=>a.distance-b.distance);
    mids.forEach(L => {
      opts.push({
        label: L.name,
        meta: `${L.tag} · ${fmtMiles(L.distance)}`,
        onChoose: () => showEpilogue(day, "midday", L.name, L.tag)
      });
    });
  } else if (seq === "evening"){
    [
      {label:"Campfire tales & s’mores", meta:"Cozy · low miles", target:["evening","the campfire circle","campfire"]},
      {label:"Stargazing by the river", meta:"Bring a blanket", target:["evening","the riverbank","river"]},
      {label:"Short night walk", meta:"Fireflies likely", target:["evening","the campground trail","trail"]},
    ].forEach(x => {
      const [part, place, vibe] = x.target;
      opts.push({ label:x.label, meta:x.meta, onChoose:()=>showEpilogue(day, part, place, vibe) });
    });
  } else {
    // nextday
    [
      {label:`Early start for Day ${day+1}`, meta:"Sunrise over the Palisades", go:()=>beginDay(day+1)},
      {label:`Sleep in, pancakes first (Day ${day+1})`, meta:"Leisure mode", go:()=>beginDay(day+1)},
    ].forEach(x => opts.push({label:x.label, meta:x.meta, onChoose:x.go}));
  }
  return opts;
}

async function showEpilogue(day, part, placeName, vibe){
  const title = `A stop at ${placeName}`;
  document.getElementById("title").innerHTML = title;
  document.getElementById("text").innerHTML = Story.epilogue(placeName, vibe);
  document.getElementById("art").innerHTML = whimsicalSVG(
    title+placeName, part==="morning" ? "coffee" : (part==="midday" ? "trail" : "campfire")
  );

  const seq = part==="morning" ? "midday" : (part==="midday" ? "evening" : "nextday");
  const c = document.getElementById("choices");
  c.innerHTML = "";
  const hdr = document.createElement("div");
  hdr.className = "muted";
  hdr.textContent = "Choose what’s next:";
  c.appendChild(hdr);

  (await nextOptions(day, seq)).forEach(ch => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.innerHTML = `<div><div>${ch.label}</div>` + (ch.meta? `<span class=\"muted\">${ch.meta}</span>`:"") + `</div>`;
    btn.addEventListener("click", ch.onChoose);
    c.appendChild(btn);
  });
}
}
