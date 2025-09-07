// App wiring for tabs, settings, and view logic
const vStory = document.getElementById("viewStory");
const vMap = document.getElementById("viewMap");
const vSettings = document.getElementById("viewSettings");

function showView(which){
  vStory.hidden = which!=="story";
  vMap.hidden = which!=="map";
  vSettings.hidden = which!=="settings";
  // update active pill styles
  document.getElementById("btnStory").classList.toggle("active", which==="story");
  document.getElementById("btnMap").classList.toggle("active", which==="map");
  document.getElementById("btnSettings").classList.toggle("active", which==="settings");
}

document.getElementById("btnStory").addEventListener("click", ()=>showView("story"));
document.getElementById("btnMap").addEventListener("click", ()=>showView("map"));
document.getElementById("btnSettings").addEventListener("click", ()=>showView("settings"));

// Prefill settings if possible
(function initSettings(){
  const s = Settings.get();
  const sd = document.getElementById("startDate");
  const ed = document.getElementById("endDate");
  const om = document.getElementById("originMode");
  const rm = document.getElementById("radiusMiles");

  if (s.start) sd.value = s.start;
  if (s.end) ed.value = s.end;
  om.value = s.originMode;
  rm.value = s.radiusMiles;

  document.getElementById("settingsForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    const newVals = {
      start: sd.value || null,
      end: ed.value || null,
      originMode: om.value,
      radiusMiles: parseInt(rm.value || "15",10)
    };
    Settings.set(newVals);
    alert("Saved! The story will now use these dates and distance preferences.");
    showView("story");
    startStory();
  });
})();

// Kick off
showView("story");
startStory();
