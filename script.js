// --- Global Scope Variables ---
let gridCols = 20;
let gridRows = 15;
let squareSize = 40;

let gridOffsetX = 0;
let gridOffsetY = 0;
const canvasPadding = 1;

// Data Storage
let unitTypesData = {};
let activeUnits = [];
let nextUnitId = 0;
let selectedUnitId = null; // ID of the currently selected unit

// --- Canvas Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

// --- UI Elements ---
const colsInput = document.getElementById('colsInput');
const rowsInput = document.getElementById('rowsInput');
const sizeInput = document.getElementById('sizeInput');
const redrawButton = document.getElementById('redrawButton');

// Unit Management UI Elements
const unitSelect = document.getElementById('unitSelect');
const addUnitButton = document.getElementById('addUnitButton');
const removeUnitButton = document.getElementById('removeUnitButton');
const endTurnButton = document.getElementById('endTurnButton');

// Turn state
let currentFaction = 'NATO'; // or 'WP'

// Info Panel Elements
const infoPanel = document.getElementById('infoPanel');
const infoContent = infoPanel.querySelector('.info-content');
const noSelectionMsg = infoPanel.querySelector('.no-selection');
const infoName = document.getElementById('info-name');
const infoType = document.getElementById('info-type');
const infoFaction = document.getElementById('info-faction');
const infoHealth = document.getElementById('info-health');
const infoMovement = document.getElementById('info-movement');
const infoWeaponName = document.getElementById('info-weapon-name');
const infoWeaponAttack = document.getElementById('info-weapon-attack');
const infoWeaponAccuracy = document.getElementById('info-weapon-accuracy');
const infoWeaponFireRate = document.getElementById('info-weapon-fireRate');
const infoWeaponMaxDistance = document.getElementById('info-weapon-maxDistance');


if (!canvas || !ctx || !colsInput || !rowsInput || !sizeInput || !redrawButton || !infoPanel || !unitSelect || !removeUnitButton) {
    console.error("Failed to get necessary elements!");
    document.body.innerHTML = '<h1 style="color: red;">Error: Page setup failed! Check element IDs.</h1>';
}

// Import Unit class
import { Unit } from './js/unit.js';

// Console output mirroring
const consoleDiv = document.getElementById('consoleOutput');
function appendToConsole(msg, isError = false) {
    const p = document.createElement('div');
    p.textContent = msg;
    p.style.color = isError ? '#f55' : '#0f0';
    consoleDiv.appendChild(p);
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

const origLog = console.log;
console.log = function(...args) {
    origLog.apply(console, args);
    appendToConsole(args.join(' '));
};

const origError = console.error;
console.error = function(...args) {
    origError.apply(console, args);
    appendToConsole(args.join(' '), true);
};


// --- Drawing Functions ---

/**
 * Draws a single square outline.
 * @param {CanvasRenderingContext2D} context - The canvas rendering context.
 * @param {number} pixelX - Top-left x-coordinate in logical pixels.
 * @param {number} pixelY - Top-left y-coordinate in logical pixels.
 * @param {number} size - Side length in logical pixels.
 * @param {string} color - Stroke color.
 */
function drawSquare(context, pixelX, pixelY, size, color) {
    context.strokeStyle = color;
    context.lineWidth = 1;
    context.strokeRect(pixelX, pixelY, size, size);
}



// --- UI Update Function ---
/**
 * Updates the info panel based on the selected unit.
 */
function updateInfoPanel() {
    const selectedUnit = activeUnits.find(unit => unit.id === selectedUnitId);

    if (selectedUnit) {
        infoName.textContent = selectedUnit.name;
        infoType.textContent = selectedUnit.type;
        infoFaction.textContent = selectedUnit.faction;
        infoHealth.textContent = `${selectedUnit.health} / ${selectedUnit.maxHealth}`;
        infoMovement.textContent = `${selectedUnit.movementRemaining} / ${selectedUnit.movementSpeed}`; // Show remaining/total

        // Weapon Info
        infoWeaponName.textContent = selectedUnit.weapon.name;
        infoWeaponAttack.textContent = selectedUnit.weapon.attack;
        // Format accuracy as percentage
        infoWeaponAccuracy.textContent = `${(selectedUnit.weapon.accuracy * 100).toFixed(0)}%`;
        infoWeaponFireRate.textContent = selectedUnit.weapon.fireRate;
        infoWeaponMaxDistance.textContent = selectedUnit.weapon.maxDistance;

        // Show the content, hide the placeholder message
        infoContent.style.display = 'block';
        noSelectionMsg.style.display = 'none';

    } else {
        // Clear all fields if no unit is selected
        infoName.textContent = '-';
        infoType.textContent = '-';
        infoFaction.textContent = '-';
        infoHealth.textContent = '-';
        infoMovement.textContent = '-';
        infoWeaponName.textContent = '-';
        infoWeaponAttack.textContent = '-';
        infoWeaponAccuracy.textContent = '-';
        infoWeaponFireRate.textContent = '-';
        infoWeaponMaxDistance.textContent = '-';

        // Hide the content, show the placeholder message
        infoContent.style.display = 'none';
        noSelectionMsg.style.display = 'block';
    }
}


// --- Grid and Unit Drawing ---
/**
 * Draws the entire game state (grid and units).
 */
function drawGame() {
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    // Determine selected unit
    const selectedUnit = activeUnits.find(u => u.id === selectedUnitId);
    console.log("Selected unit in drawGame:", selectedUnit);
    const moveRange = new Set();
    const attackTargets = new Set();

    if (selectedUnit) {
        // Calculate movement range (simple Manhattan distance)
        for (let q = 0; q < gridCols; q++) {
            for (let r = 0; r < gridRows; r++) {
                const dist = Math.abs(q - selectedUnit.col) + Math.abs(r - selectedUnit.row);
                if (dist > 0 && dist <= Math.floor(selectedUnit.movementRemaining)) {
                    const occupied = activeUnits.some(u => u.col === q && u.row === r);
                    if (!occupied) {
                        moveRange.add(`${q},${r}`);
                    }
                }
            }
        }
    }

    // Always calculate attackable enemy units within weapon maxDistance
    if (selectedUnit) {
        activeUnits.forEach(u => {
            if (u.faction !== selectedUnit.faction) {
                const dist = Math.abs(u.col - selectedUnit.col) + Math.abs(u.row - selectedUnit.row);
                if (dist > 0 && dist <= Math.floor(selectedUnit.weapon.maxDistance)) {
                    attackTargets.add(`${u.col},${u.row}`);
                }
            }
        });
    }

    // --- Draw Grid ---
    const defaultGridColor = '#ccc';
    for (let q = 0; q < gridCols; q++) {
        for (let r = 0; r < gridRows; r++) {
            const pixelX = gridOffsetX + q * squareSize;
            const pixelY = gridOffsetY + r * squareSize;
            const logicalCanvasWidth = canvas.width / dpr;
            const logicalCanvasHeight = canvas.height / dpr;
            if (pixelX < logicalCanvasWidth + squareSize && pixelY < logicalCanvasHeight + squareSize &&
                pixelX + squareSize > 0 && pixelY + squareSize > 0)
            {
                const key = `${q},${r}`;
                if (attackTargets.has(key)) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'; // vivid red overlay
                    ctx.fillRect(pixelX, pixelY, squareSize, squareSize);
                    drawSquare(ctx, pixelX, pixelY, squareSize, '#cc0000');
                } else if (moveRange.has(key)) {
                    ctx.fillStyle = 'rgba(100, 255, 100, 0.3)'; // semi-transparent light green
                    ctx.fillRect(pixelX, pixelY, squareSize, squareSize);
                    drawSquare(ctx, pixelX, pixelY, squareSize, '#33cc33');
                } else {
                    drawSquare(ctx, pixelX, pixelY, squareSize, defaultGridColor);
                }
            }
        }
    }

    // --- Draw Units ---
    activeUnits.forEach(unit => {
        // Set selection state based on global selectedUnitId BEFORE drawing
        unit.isSelected = (unit.id === selectedUnitId);

        if (unit.col >= 0 && unit.col < gridCols && unit.row >= 0 && unit.row < gridRows) {
            unit.draw(ctx, squareSize, gridOffsetX, gridOffsetY, currentFaction);
        }
    });

    // --- Draw crosshairs on attackable enemy units ---
    attackTargets.forEach(key => {
        const [q, r] = key.split(',').map(Number);
        const pixelX = gridOffsetX + q * squareSize;
        const pixelY = gridOffsetY + r * squareSize;

        ctx.strokeStyle = '#cc0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pixelX, pixelY);
        ctx.lineTo(pixelX + squareSize, pixelY + squareSize);
        ctx.moveTo(pixelX + squareSize, pixelY);
        ctx.lineTo(pixelX, pixelY + squareSize);
        ctx.stroke();
    });

    ctx.restore();
}

/**
 * Sets up map dimensions, resizes canvas, AND redraws the game.
 * @param {number} cols - Number of columns.
 * @param {number} rows - Number of rows.
 * @param {number} size - Square side length in logical CSS pixels.
 */
function setupMap(cols, rows, size) {
    // (Keep the setupMap logic the same as previous version, ensuring it calls drawGame at the end)
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    console.log(`Setting up map: ${cols}x${rows}, Size: ${size}, DPR: ${dpr}`);
    gridCols = Math.max(1, Math.min(cols, 200));
    gridRows = Math.max(1, Math.min(rows, 200));
    squareSize = Math.max(10, Math.min(size, 100));
    if (cols !== gridCols) colsInput.value = gridCols;
    if (rows !== gridRows) rowsInput.value = gridRows;
    if (size !== squareSize) sizeInput.value = squareSize;
    const logicalWidth = (gridCols * squareSize) + canvasPadding * 2;
    const logicalHeight = (gridRows * squareSize) + canvasPadding * 2;
    canvas.width = Math.round(logicalWidth * dpr);
    canvas.height = Math.round(logicalHeight * dpr);
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;
    gridOffsetX = canvasPadding;
    gridOffsetY = canvasPadding;
    console.log(`Logical Size: ${logicalWidth.toFixed(0)}x${logicalHeight.toFixed(0)}`);
    console.log(`Bitmap Size: ${canvas.width}x${canvas.height}`);
    drawGame();
}

// --- Data Loading ---


// --- UI Helper Functions ---
/** Populates the unit selection dropdown */
function populateUnitSelect() {
    if (!unitSelect || Object.keys(unitTypesData).length === 0) return;

    // Clear existing options (except the placeholder)
    while (unitSelect.options.length > 1) {
        unitSelect.remove(1);
    }

    // Add options for each unit type
    for (const unitTypeId in unitTypesData) {
        const unitType = unitTypesData[unitTypeId];
        const option = document.createElement('option');
        option.value = unitTypeId;
        // Display format: "Faction: Name (Type)"
        option.textContent = `${unitType.faction}: ${unitType.name} (${unitType.type})`;
        unitSelect.appendChild(option);
    }
    console.log("Unit selection dropdown populated.");
}


// --- Initial Unit Placement (Example) ---
// This function is now unused but kept for reference or potential future use
function placeInitialUnits() {
    activeUnits = [];
    nextUnitId = 0;
    selectedUnitId = null; // Reset selection when placing units

    if (Object.keys(unitTypesData).length === 0) {
        console.error("Unit data not loaded, cannot place units.");
        return;
    }
    // (Keep placement logic the same as previous version, checking bounds)
    const natoCol = 1;
    const natoRow1 = 1;
    const natoRow2 = 2;
    const wpCol = Math.max(0, gridCols - 2);
    const wpRow1 = Math.max(0, gridRows - 2);
    const wpRow2 = Math.max(0, gridRows - 3);
    let unitsPlaced = 0;
    if (gridCols > natoCol && gridRows > natoRow2) {
         activeUnits.push(new Unit('us_rifleman', natoCol, natoRow1));
         activeUnits.push(new Unit('us_m60_tank', natoCol, natoRow2));
         unitsPlaced += 2;
    }
    if (gridCols > wpCol && gridRows > wpRow1 && gridRows > wpRow2 && wpCol !== natoCol) {
         activeUnits.push(new Unit('sov_rifleman', wpCol, wpRow1));
         activeUnits.push(new Unit('sov_t62_tank', wpCol, wpRow2));
         unitsPlaced += 2;
    }
    if (unitsPlaced > 0) {
        console.log(`Placed ${unitsPlaced} initial units:`, activeUnits);
    } else {
        console.warn("Grid too small or unit data missing, could not place initial units.");
    }
}


// --- Event Listeners ---

// Redraw button listener
redrawButton.addEventListener('click', () => {
    console.log("Redraw button clicked");
    const cols = parseInt(colsInput.value, 10);
    const rows = parseInt(rowsInput.value, 10);
    const size = parseInt(sizeInput.value, 10);

    if (isNaN(cols) || isNaN(rows) || isNaN(size)) {
        alert("Please enter valid numbers."); return;
    }

    setupMap(cols, rows, size);
    // placeInitialUnits(); // REMOVED: Don't automatically place units on redraw
    drawGame(); // Draw units (now unselected)
    updateInfoPanel(); // Update panel to show no selection
});

// Canvas click listener with point-and-click add unit support
canvas.addEventListener('click', (event) => {
    if (event.button === 2) return; // Ignore right-clicks here
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    const col = Math.floor((clickX - gridOffsetX) / squareSize);
    const row = Math.floor((clickY - gridOffsetY) / squareSize);

    if (col < 0 || col >= gridCols || row < 0 || row >= gridRows) {
        console.log("Clicked outside grid area");
        return;
    }

    const selectedTypeId = unitSelect.value;
    const clickedUnit = activeUnits.find(u => u.col === col && u.row === row);

    if (selectedTypeId && !clickedUnit) {
        if (!unitTypesData || Object.keys(unitTypesData).length === 0) {
            alert("Unit data not loaded yet. Please wait.");
            return;
        }
        // Add new unit at clicked empty cell
        try {
            const newUnit = new Unit(selectedTypeId, col, row, unitTypesData, nextUnitId++);
            activeUnits.push(newUnit);
            console.log(`Added ${newUnit.name} at [${col}, ${row}]`);
            drawGame();
        } catch (error) {
            console.error("Error creating unit:", error);
            alert("Failed to add unit. Check console.");
        }
        return;
    }

    // Otherwise, handle selection/deselection
    if (clickedUnit && clickedUnit.id === selectedUnitId) {
        // Deselect if clicking the selected unit again
        selectedUnitId = null;
        drawGame();
        updateInfoPanel();
        return;
    }

    let newlySelectedUnitId = null;
    if (clickedUnit) {
        newlySelectedUnitId = clickedUnit.id;
        console.log(`Clicked Unit: ${clickedUnit.name} (ID: ${clickedUnit.id})`);
    } else {
        console.log(`Clicked empty cell: [${col}, ${row}]`);
    }

    if (selectedUnitId !== newlySelectedUnitId) {
        selectedUnitId = newlySelectedUnitId;
        drawGame();
        updateInfoPanel();
    }
});

// Right-click to move selected unit
canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    const col = Math.floor((clickX - gridOffsetX) / squareSize);
    const row = Math.floor((clickY - gridOffsetY) / squareSize);

    if (col < 0 || col >= gridCols || row < 0 || row >= gridRows) return;

    const selectedUnit = activeUnits.find(u => u.id === selectedUnitId);
    if (!selectedUnit) return;
    if (selectedUnit.faction !== currentFaction) return;

    const targetUnit = activeUnits.find(u => u.col === col && u.row === row);

    if (targetUnit && targetUnit.faction !== currentFaction) {
        // Attack enemy unit
        if (selectedUnit.hasAttacked) return;

        const dist = Math.abs(col - selectedUnit.col) + Math.abs(row - selectedUnit.row);
        if (dist === 0 || dist > Math.floor(selectedUnit.weapon.maxDistance)) return;

        console.log(`Attacking ${targetUnit.name} with ${selectedUnit.name}`);

        let effectiveAccuracy = selectedUnit.weapon.accuracy - (dist - 1) * 0.1;
        effectiveAccuracy = Math.max(0, Math.min(1, effectiveAccuracy));
        const roll = Math.random();
        console.log(`Distance: ${dist}, Base accuracy: ${selectedUnit.weapon.accuracy}, Effective accuracy: ${effectiveAccuracy.toFixed(2)}, Roll: ${roll.toFixed(2)}`);

        const baseDamage = 4 + Math.floor(Math.random() * 3); // 4-6 damage
        const damage = baseDamage * effectiveAccuracy;

        if (roll <= effectiveAccuracy) {
            console.log(`Hit! Damage dealt: ${damage.toFixed(1)}`);
            targetUnit.health -= damage;
            if (targetUnit.health <= 0) {
                console.log(`${targetUnit.name} destroyed!`);
                activeUnits = activeUnits.filter(u => u.id !== targetUnit.id);
            }
        } else {
            console.log("Missed!");
        }

        selectedUnit.hasAttacked = true;
        drawGame();
        updateInfoPanel();
        return;
    }

    // Otherwise, move if empty square
    if (selectedUnit.hasMoved) return;

    const dist = Math.abs(col - selectedUnit.col) + Math.abs(row - selectedUnit.row);
    if (dist === 0 || dist > Math.floor(selectedUnit.movementRemaining)) return;

    const occupied = activeUnits.some(u => u.col === col && u.row === row);
    if (occupied) return;

    console.log(`Moving unit ${selectedUnit.name} to [${col}, ${row}]`);
    selectedUnit.col = col;
    selectedUnit.row = row;
    selectedUnit.movementRemaining -= dist;
    selectedUnit.hasMoved = true;
    drawGame();
    updateInfoPanel();
});

// Remove Unit button listener
removeUnitButton.addEventListener('click', () => {
    if (selectedUnitId === null) {
        alert("Please select a unit to remove.");
        return;
    }

    const unitIndex = activeUnits.findIndex(unit => unit.id === selectedUnitId);
    if (unitIndex !== -1) {
        const removedUnit = activeUnits.splice(unitIndex, 1)[0];
        console.log(`Removed ${removedUnit.name} (ID: ${selectedUnitId})`);
        selectedUnitId = null; // Deselect
        drawGame();
        updateInfoPanel(); // Update panel to show no selection
    } else {
        console.error(`Could not find selected unit with ID ${selectedUnitId} to remove.`);
        selectedUnitId = null; // Deselect even if not found (shouldn't happen)
        updateInfoPanel();
    }
});

endTurnButton.addEventListener('click', () => {
    currentFaction = currentFaction === 'NATO' ? 'WarsawPact' : 'NATO';
    console.log(`Turn ended. Now it's ${currentFaction}'s turn.`);

    // Reset hasMoved and movement points for new faction's units
    activeUnits.forEach(unit => {
        if (unit.faction === currentFaction) {
            unit.hasMoved = false;
            unit.movementRemaining = unit.movementSpeed;
        }
    });

    selectedUnitId = null; // Deselect any unit

    // Update turn indicator text
    const turnDiv = document.getElementById('turnIndicator');
    if (turnDiv) {
        turnDiv.textContent = `Current Turn: ${currentFaction}`;
    }

    drawGame();
    updateInfoPanel();
});


// --- Game Initialization ---
async function initializeGame() {
    console.log("Initializing game...");

    const initialCols = parseInt(colsInput.value, 10);
    const initialRows = parseInt(rowsInput.value, 10);
    const initialSize = parseInt(sizeInput.value, 10);
    setupMap(initialCols, initialRows, initialSize);

    // placeInitialUnits(); // REMOVED: Don't automatically place units on init
    drawGame(); // Draw initial state (no selection highlight)
    updateInfoPanel(); // Show the "no selection" message initially
    console.log("Game Initialized.");
}

window.addEventListener('DOMContentLoaded', initializeGame);
