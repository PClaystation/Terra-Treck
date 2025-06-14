const gridSize = 20;
let steps = 1000;
let selectedBuilding = null;
let selectedCost = 0;
let buildMode = false;

const grid = document.getElementById("grid");
const stepCount = document.getElementById("step-count");
const buildToggle = document.getElementById("build-toggle");
const buildingOptions = document.getElementById("building-options");
const resetButton = document.getElementById("reset-button");

const buildingCounts = {
  house: 0,
  shop: 0,
  park: 0,
};

const buildingSizes = {
    house: { width: 1, height: 1 },
    shop: { width: 2, height: 1 },
    park: { width: 2, height: 2 },
  };
  
  const treeImages = [
    "./images/Tree1-removebg-preview.png",
    "./images/Tree2-removebg-preview.png",
    "./images/Tree3-removebg-preview.png"
    // add as many as you want
  ];


const confirmButtons = document.getElementById("confirm-buttons");
const confirmBuildBtn = document.getElementById("confirm-build");
const cancelBuildBtn = document.getElementById("cancel-build");

let pendingTiles = [];

let previewLocked = false;
let lockedPreviewTiles = [];


function updateStepCount() {
  stepCount.textContent = steps;
}

function updateBuildingCounts() {
  for (const b in buildingCounts) {
    // No UI count updates needed since you removed count display
  }
}

function clearSelectedButtons() {
  document.querySelectorAll(".building-btn").forEach(btn => btn.classList.remove("selected"));
}

function enterBuildMode() {
  buildMode = true;
  buildToggle.classList.add("build-mode-active");
  buildingOptions.classList.remove("hidden");
  clearSelectedButtons();
  selectedBuilding = null;
  selectedCost = 0;

  document.querySelectorAll('.tile').forEach(tile => {
    tile.classList.add('build-mode');
  });
}

function exitBuildMode() {
  buildMode = false;
  buildToggle.classList.remove("build-mode-active");
  buildingOptions.classList.add("hidden");
  clearSelectedButtons();
  selectedBuilding = null;
  selectedCost = 0;

  document.querySelectorAll('.tile').forEach(tile => {
    tile.classList.remove('build-mode');
  });

  hideConfirmButtons();
}

function hideConfirmButtons() {
    confirmButtons.classList.remove("active");
    setTimeout(() => {
      confirmButtons.classList.add("hidden");
      confirmButtons.style.left = "";
      confirmButtons.style.top = "";
      pendingTiles = [];                  // reset the array, not some old var
    }, 300);
  }
  

// Position confirm buttons near the tile (relative to grid container)
function positionConfirmButtons(baseTile) {
    if (!pendingTiles.length) return;
  
    // get bottom-right tile
    const last = pendingTiles[pendingTiles.length - 1];
    const rect = last.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
  
    confirmButtons.classList.remove("hidden");  // unhide
    confirmButtons.style.left = `${rect.right - gridRect.left + 10}px`;
    confirmButtons.style.top  = `${rect.bottom - gridRect.top + 10}px`;
    setTimeout(() => confirmButtons.classList.add("active"), 10);
  }
  

  

// Toggle build mode button
buildToggle.addEventListener("click", () => {
  if (buildMode) {
    exitBuildMode();
  } else {
    enterBuildMode();
  }
});

resetButton.addEventListener("click", () => {
  if (confirm("Are you sure you want to reset your city?")) {
    document.querySelectorAll(".tile").forEach(tile => {
      tile.classList.remove("house", "shop", "park", "hovering", "pending");
    });
    steps = 1000;
    for (const b in buildingCounts) buildingCounts[b] = 0;
    updateStepCount();
    updateBuildingCounts();
    exitBuildMode();
  }
});

// Build grid tiles and add events
for (let i = 0; i < gridSize * gridSize; i++) {
  const tile = document.createElement("div");
  tile.classList.add("tile");

    // Base green in HSL (easier to tweak lightness)
    const baseHue = 122;
    const baseSaturation = 39;
    const baseLightness = 49;
  
    // Randomize lightness ±5%
    const lightnessVariation = (Math.random() * 4) - 5; // -5 to +5
    const finalLightness = baseLightness + lightnessVariation;
  
    tile.style.backgroundColor = `hsl(${baseHue}, ${baseSaturation}%, ${finalLightness}%)`;

  if (Math.random() < 0.1) { // 10% chance to add a tree
    const treeImg = document.createElement("img");
    const randomIndex = Math.floor(Math.random() * treeImages.length);
    treeImg.src = treeImages[randomIndex];
    
    treeImg.style.width = "48px";
    treeImg.style.height = "auto";
    treeImg.style.pointerEvents = "none"; // so clicks pass through
    tile.appendChild(treeImg);
  }
  

  tile.addEventListener("mouseenter", () => {
    if (!buildMode || !selectedBuilding || previewLocked) return;
  
    document.querySelectorAll('.tile.hovering').forEach(t => t.classList.remove('hovering'));
  
    const tiles = getTilesForBuilding(tile, selectedBuilding);
    if (!tiles) return;
  
    tiles.forEach(t => t.classList.add('hovering'));
  });
  
  
  tile.addEventListener("mouseleave", () => {
    if (!buildMode || !selectedBuilding || previewLocked) return;
  
    document.querySelectorAll('.tile.hovering').forEach(t => t.classList.remove('hovering'));
  });
  
  tile.addEventListener("click", () => {
    if (!buildMode || !selectedBuilding || previewLocked) return;
  
    const tiles = getTilesForBuilding(tile, selectedBuilding);
    if (!tiles) {
      alert("Building is out of bounds!");
      return;
    }
  
    // Check if any of them are occupied
    for (const t of tiles) {
      if (
        t.classList.contains("house") ||
        t.classList.contains("shop") ||
        t.classList.contains("park")
      ) {
        alert("Some tiles are already occupied!");
        return;
      }
    }
  
    if (steps < selectedCost) {
      alert("Not enough steps to build!");
      return;
    }
  
    // Lock the preview
    previewLocked = true;
    lockedPreviewTiles = tiles;
  
    // Clear any existing preview or pending state
    document.querySelectorAll(".tile.hovering").forEach(t => t.classList.remove("hovering"));
    pendingTiles.forEach(t => t.classList.remove("pending"));
  
    // Show locked preview
    tiles.forEach(t => t.classList.add("hovering"));
    pendingTiles = tiles;
  
    positionConfirmButtons(tile);
  });
  
  
  grid.appendChild(tile);
}

// Building buttons click logic
document.querySelectorAll(".building-btn").forEach(button => {
  button.addEventListener("click", () => {
    if (!buildMode) return;
    clearSelectedButtons();
    button.classList.add("selected");
    selectedBuilding = button.dataset.name;
    selectedCost = parseInt(button.dataset.cost, 10);

    // Cancel any pending placement when switching building types
    hideConfirmButtons();
  });
});
// —————————————————————————————
// 1. Fix your confirm button listener
confirmBuildBtn.addEventListener("click", (e) => {
    e.stopPropagation();              // now `e` is defined
    if (!previewLocked) return;
  
    lockedPreviewTiles.forEach(t => {
    const treeImg = t.querySelector("img");
    if (treeImg) t.removeChild(treeImg);
      t.classList.add(selectedBuilding);
      // if you want to keep track:
      t.dataset.building = selectedBuilding;
    });
  
    steps -= selectedCost;
    buildingCounts[selectedBuilding]++;
    updateStepCount();
    updateBuildingCounts();
  
    previewLocked = false;
    lockedPreviewTiles = [];
    hideConfirmButtons();            // use your existing hide fn
  });
  
  // —————————————————————————————
  // 2. Fix your cancel button listener
  cancelBuildBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!previewLocked) return;
  
    previewLocked = false;
    lockedPreviewTiles.forEach(t => t.classList.remove("hovering"));
    lockedPreviewTiles = [];
    pendingTiles = [];
    hideConfirmButtons();
  });
  
  
  

// Init UI
updateStepCount();
updateBuildingCounts();


function getTileAt(row, col) {
    if (row < 0 || col < 0 || row >= gridSize || col >= gridSize) return null;
    const index = row * gridSize + col;
    return grid.children[index];
  }
  
function getTilesForBuilding(baseTile, buildingType) {
const rect = baseTile.getBoundingClientRect();
const allTiles = [];

const baseIndex = Array.from(grid.children).indexOf(baseTile);
const baseRow = Math.floor(baseIndex / gridSize);
const baseCol = baseIndex % gridSize;

const { width, height } = buildingSizes[buildingType];

for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
    const tile = getTileAt(baseRow + dy, baseCol + dx);
    if (!tile) return null; // Out of bounds
    allTiles.push(tile);
    }
}

return allTiles;
}

const userId = "someUniqueUserId"; // Must match app
let stepTotal = parseInt(localStorage.getItem("stepTotal") || 0);
let lastTimestamp = localStorage.getItem("lastStepTimestamp");

document.getElementById("step-count").textContent = stepTotal;

function fetchStepsFromServer() {
    fetch(`https://mpmc.ddns.net:3000/steps/${userId}`)
        .then(res => res.json())
        .then(data => {
            console.log("Fetched step entries:", data);

            let newSteps = 0;
            data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            for (let entry of data) {
                const entryTime = new Date(entry.timestamp).getTime();
                const lastTime = lastTimestamp ? new Date(lastTimestamp).getTime() : 0;
            
                console.log(`Entry timestamp: ${entry.timestamp}, steps: ${entry.steps}`);
            
                if (entryTime > lastTime) {
                    newSteps += entry.steps;
                    lastTimestamp = entry.timestamp;
                }
            }
            
            console.log(`New steps to add: ${newSteps}`);
            
            if (newSteps > 0) {
                stepTotal += newSteps;
                localStorage.setItem("stepTotal", stepTotal);
                localStorage.setItem("lastStepTimestamp", lastTimestamp);
                document.getElementById("step-count").textContent = stepTotal;
            }
            
        })
        .catch(err => console.error("Error fetching steps:", err));
}

setInterval(fetchStepsFromServer, 30000);
fetchStepsFromServer();









/* ------------ */
/* ACCOUNT SHIT */
/* ------------ */
window.onload = () => {

  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  if (token && userId) {
    setLoggedIn(userId);
  } else {
    // Redirect to local login page instead of external URL
    const loginURL = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
    window.location.href = loginURL;
  }
};

/*logoutBtn.onclick = () => setLoggedOut();


/* ------------ */
/* ACCOUNT SHIT */
/* ------------ */