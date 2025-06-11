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

const confirmButtons = document.getElementById("confirm-buttons");
const confirmBuildBtn = document.getElementById("confirm-build");
const cancelBuildBtn = document.getElementById("cancel-build");

let pendingTile = null;

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
      pendingTile = null;
    }, 300); // match CSS transition duration
  }
  

// Position confirm buttons near the tile (relative to grid container)
function positionConfirmButtons(tile) {
    const rect = tile.getBoundingClientRect();

    confirmButtons.style.position = "absolute";
    confirmButtons.style.left = `${rect.left + window.scrollX + rect.width / 2 - confirmButtons.offsetWidth / 2}px`;
    confirmButtons.style.top = `${rect.top + window.scrollY + rect.height + 10 - 40}px`;

    confirmButtons.classList.remove("hidden");
    setTimeout(() => {
        confirmButtons.classList.add("active");
    }, 10);
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

  tile.addEventListener("mouseenter", () => {
    if (buildMode && selectedBuilding) {
      tile.classList.add("hovering");
    }
  });
  tile.addEventListener("mouseleave", () => {
    tile.classList.remove("hovering");
  });

  tile.addEventListener("click", () => {
    if (!buildMode) return;
    if (!selectedBuilding) {
      alert("Select a building first!");
      return;
    }
    if (tile.classList.contains("house") || tile.classList.contains("shop") || tile.classList.contains("park")) {
      alert("This tile is already occupied!");
      return;
    }
    if (steps < selectedCost) {
      alert("Not enough steps to build!");
      return;
    }

    // If there's a pending tile and it's not this one, switch to the new tile
    if (pendingTile && pendingTile !== tile) {
      // Remove pending highlight from old tile
      pendingTile.classList.remove("pending");

      // Set new pending tile and highlight it
      pendingTile = tile;
      pendingTile.classList.add("pending");

      // Move confirm buttons to new tile
      positionConfirmButtons(tile);

      return;
    }

    // If no pending tile, set this tile as pending and show buttons
    if (!pendingTile) {
      pendingTile = tile;
      pendingTile.classList.add("pending");
      positionConfirmButtons(tile);
    }
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

// Confirm building placement
confirmBuildBtn.addEventListener("click", () => {
  if (!pendingTile) return;

  pendingTile.classList.remove("pending");
  pendingTile.classList.add(selectedBuilding);

  steps -= selectedCost;
  buildingCounts[selectedBuilding]++;
  updateStepCount();
  updateBuildingCounts();

  pendingTile.classList.remove("hovering");

  hideConfirmButtons();
});

// Cancel building placement
cancelBuildBtn.addEventListener("click", () => {
  if (pendingTile) {
    pendingTile.classList.remove("pending", "hovering");
  }
  hideConfirmButtons();
});

// Init UI
updateStepCount();
updateBuildingCounts();

