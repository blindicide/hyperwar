import { Unit } from './unit.js';
import { setupMap, performCombat, performMove } from './core.js';
import { drawGame } from './renderer.js';
import { updateInfoPanel, populateUnitSelect, loadAllGameData, logToCombatLog } from './ui.js';
import { runAITurn, AI_FACTIONS } from './ai.js';

// --- Global Variables ---
let gridCols = 20;
let gridRows = 15;
let squareSize = 40;
let gridOffsetX = 0;
let gridOffsetY = 0;
const canvasPadding = 1;

// Game Data Stores (will be populated by loadAllGameData)
let unitTemplates = {};
let weaponsData = {};
let ammoData = {};
let groupTemplates = {};

// Active Game State
let activeUnits = [];
let nextUnitId = 0;
let selectedUnitId = null;
let currentFaction = 'NATO'; // Default, will be overwritten by scenario
let scenarioData = null;
let isDeploymentPhase = false;
let deploymentPool = {}; // { faction: { groupKey: { name: string, units: [unitData, ...] }, ... } }
let selectedDeploymentUnit = null; // Unit data selected from deployment panel { id, typeId, name, ... }

// --- DOM Elements ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const colsInput = document.getElementById('colsInput');
const rowsInput = document.getElementById('rowsInput');
const sizeInput = document.getElementById('sizeInput');
const redrawButton = document.getElementById('redrawButton');
const mapControlsDiv = document.querySelector('.controls');
const unitSelect = document.getElementById('unitSelect');
const unitControlsDiv = document.querySelector('.unit-controls');
const removeUnitButton = document.getElementById('removeUnitButton');
const endTurnButton = document.getElementById('endTurnButton');
const loadUnitButton = document.getElementById('loadUnitButton');
const unloadUnitButton = document.getElementById('unloadUnitButton');
const infoPanel = document.getElementById('infoPanel');
const infoContent = infoPanel.querySelector('.info-content');
const noSelectionMsg = infoPanel.querySelector('.no-selection');
const infoName = document.getElementById('info-name');
const infoClass = document.getElementById('info-class');
const infoFaction = document.getElementById('info-faction');
const infoHealth = document.getElementById('info-health');
const infoMovement = document.getElementById('info-movement');
const infoStance = document.getElementById('info-stance');
const infoAmmo = document.getElementById('info-ammo');
const infoCarriedUnitContainer = document.getElementById('info-carried-unit-container'); // Added
const infoCarriedUnit = document.getElementById('info-carried-unit'); // Added
const stanceButtons = document.querySelectorAll('.stance-button');
const stanceTooltip = document.getElementById('stanceTooltip');
const deploymentPanel = document.getElementById('deploymentPanel');
const deployListDiv = document.getElementById('deploymentList');
const startBattleButton = document.getElementById('startBattleButton');
const turnDiv = document.getElementById('turnIndicator');


if (!canvas || !ctx || !colsInput || !rowsInput || !sizeInput || !redrawButton || !infoPanel || !unitSelect || !removeUnitButton || !stanceButtons.length || !deploymentPanel || !deployListDiv || !startBattleButton || !turnDiv) {
    console.error("Failed to get necessary elements!");
    document.body.innerHTML = '<h1 style="color: red;">Error: Page setup failed! Check element IDs.</h1>';
}

// --- Helper Functions ---
function getUrlParameter(name) { /* ... (no changes needed) ... */
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}
async function loadScenario(scenarioName) { /* ... (no changes needed) ... */
    if (!scenarioName) return null;
    const scenarioPath = `scenarios/${scenarioName}.json`;
    console.log(`Attempting to load scenario: ${scenarioPath}`);
    try {
        const response = await fetch(scenarioPath);
        if (!response.ok) { throw new Error(`HTTP error! status: ${response.status} for ${scenarioPath}`); }
        const data = await response.json();
        console.log("Scenario data loaded:", data);
        logToCombatLog(`Loaded Scenario: ${data.name || scenarioName}`);
        logToCombatLog(data.description || 'No description.');
        return data;
    } catch (error) {
        console.error("Error loading scenario:", error);
        logToCombatLog(`Error loading scenario: ${scenarioName}.json. ${error.message}`);
        alert(`Failed to load scenario: ${scenarioName}.json. Check console for details.`);
        return null;
    }
}
function redraw() { /* ... (no changes needed) ... */
    drawGame(ctx, canvas, gridCols, gridRows, squareSize, gridOffsetX, gridOffsetY, activeUnits, selectedUnitId, currentFaction, weaponsData);
}

// --- Initialize Game ---
async function initializeGame() {
    console.log("Initializing game...");
    const scenarioName = getUrlParameter('scenario');
    let isScenarioMode = false;
    let unitsToPlace = [];
    let playerFaction = 'NATO'; // Default player faction

    // Load all game data
    const { data: loadedGameData, error: loadError } = await loadAllGameData();
    if (loadError) { console.error("Initialization halted due to data loading errors."); return; }
    unitTemplates = loadedGameData.unitTemplates || {};
    weaponsData = loadedGameData.weaponsData || {};
    ammoData = loadedGameData.ammoData || {};
    groupTemplates = loadedGameData.groupTemplates || {};

    let initialCols, initialRows, initialSize;

    // Determine mode and initial settings
    if (scenarioName) {
        scenarioData = await loadScenario(scenarioName);
        if (scenarioData?.map && scenarioData.units) {
            isScenarioMode = true;
            console.log("Scenario mode activated.");
            initialCols = scenarioData.map.cols;
            initialRows = scenarioData.map.rows;
            initialSize = parseInt(sizeInput.value, 10);

            // Determine player faction (always use the first faction listed in the scenario)
            if (scenarioData.factions?.length > 0) {
                 playerFaction = scenarioData.factions[0]; // Always start with the first faction listed
                 console.log(`Starting faction set to first in scenario: ${playerFaction}`);
            } else {
                 console.warn("Scenario factions array missing/empty. Defaulting player faction.");
                 playerFaction = 'NATO'; // Fallback
            }
            currentFaction = playerFaction; // Set starting faction for deployment

            if (turnDiv) turnDiv.textContent = `Deployment Phase: ${currentFaction}`;

            // Hide map creation controls, but keep unit controls div visible for unload button
            [colsInput, rowsInput, sizeInput, redrawButton].forEach(el => { if (el) el.style.display = 'none'; });
            mapControlsDiv?.querySelectorAll('label').forEach(label => { if (['colsInput', 'rowsInput', 'sizeInput'].includes(label.htmlFor)) label.style.display = 'none'; });

            // Hide specific sandbox elements within unit controls
            if (unitControlsDiv) {
                const unitSelectLabel = unitControlsDiv.querySelector('label[for="unitSelect"]');
                if (unitSelectLabel) unitSelectLabel.style.display = 'none';
                if (unitSelect) unitSelect.style.display = 'none';
                const unitSelectHelpText = unitControlsDiv.querySelector('i'); // Assuming the italic text is the only <i>
                if (unitSelectHelpText) unitSelectHelpText.style.display = 'none';
                // Keep removeUnitButton, loadUnitButton, unloadUnitButton potentially visible
            }


        } else {
            console.warn("Scenario data incomplete/failed. Falling back to sandbox.");
            isScenarioMode = false;
        }
    }

    if (!isScenarioMode) { // Sandbox mode setup
        console.log("Sandbox mode activated.");
        initialCols = parseInt(colsInput.value, 10);
        initialRows = parseInt(rowsInput.value, 10);
        initialSize = parseInt(sizeInput.value, 10);
        populateUnitSelect(unitSelect, unitTemplates);
        if (turnDiv) turnDiv.textContent = `Current Turn: ${currentFaction}`; // Show normal turn indicator
    }

    // Setup Map
    console.log("Setting up map:", initialCols, initialRows, initialSize);
    const dims = setupMap(ctx, canvas, initialCols, initialRows, initialSize, canvasPadding, colsInput, rowsInput, sizeInput, (c, r, s, ox, oy) => {
        gridCols = c; gridRows = r; squareSize = s; gridOffsetX = ox; gridOffsetY = oy; redraw();
    });
    Object.assign(window, { gridCols, gridRows, squareSize, gridOffsetX, gridOffsetY }); // Assign to global scope (if needed) or pass down

    // Expand Units/Groups for Scenario Mode into unitsToPlace
    if (isScenarioMode && scenarioData?.units) {
        activeUnits = []; // Ensure activeUnits is empty before deployment phase
        let nextUnitIdRef = { value: 0 };
        unitsToPlace = [];

        scenarioData.units.forEach(unitInfo => {
            try {
                // Determine faction for this entry (use scenario default if not specified)
                const unitFaction = unitInfo.faction || (scenarioData.factions ? scenarioData.factions[0] : 'NATO');

                if (unitInfo.groupId) {
                    const groupUnits = expandGroup(
                        unitInfo.groupId, unitFaction, unitInfo.col, unitInfo.row,
                        unitTemplates, groupTemplates, ammoData, weaponsData,
                        nextUnitIdRef, 0, unitInfo.groupId
                    );
                    unitsToPlace.push(...groupUnits);
                } else if (unitInfo.typeId) {
                    if (!unitTemplates[unitInfo.typeId]) { console.warn(`Unit type "${unitInfo.typeId}" not found. Skipping.`); return; } // Use return instead of continue
                    const newUnit = new Unit(
                        unitInfo.typeId, unitInfo.col, unitInfo.row,
                        unitTemplates, weaponsData, ammoData,
                        nextUnitIdRef.value++, unitFaction
                    );
                    newUnit._originGroupId = 'single_units';
                    unitsToPlace.push(newUnit);
                } else { console.warn("Scenario entry missing typeId/groupId:", unitInfo); }
            } catch (error) { console.error(`Error expanding ${unitInfo.typeId || unitInfo.groupId}:`, error); }
        });
        nextUnitId = nextUnitIdRef.value;
        console.log("Units expanded for deployment pool:", unitsToPlace);
    }

    // Initial Draw
    redraw();
    // Pass new elements to updateInfoPanel
    updateInfoPanel(null, { infoName, infoClass, infoFaction, infoHealth, infoMovement, infoStance, infoAmmo, infoContent, noSelectionMsg, infoCarriedUnitContainer, infoCarriedUnit }, weaponsData, ammoData);
    console.log("Game Initialized. Map drawn.");
    updateStanceUI(null);

    // Start Deployment Phase if in Scenario Mode
    if (isScenarioMode) {
        isDeploymentPhase = true;
        deploymentPool = {};

        // Populate deploymentPool, grouping by faction and origin group
        unitsToPlace.forEach(unit => {
            const faction = unit.faction;
            const groupKey = unit._originGroupId || 'single_units';
            const groupName = groupTemplates[groupKey]?.name || (groupKey === 'single_units' ? 'Single Units' : `Group ${groupKey}`);

            if (!deploymentPool[faction]) deploymentPool[faction] = {};
            if (!deploymentPool[faction][groupKey]) deploymentPool[faction][groupKey] = { name: groupName, units: [] };

            // Handle placeholders (transports with passengers) and regular units
            if (unit.isPlaceholder) {
                // It's a transport placeholder created by expandGroup
                 deploymentPool[faction][groupKey].units.push({
                    id: unit.id, // Transport's ID
                    typeId: unit.templateId, // Transport's template ID
                    name: unit.name, // Transport's name
                    unitClass: unit.unitClass, // Transport's class
                    passengerTypeId: unit.passengerTypeId, // Passenger's template ID
                    passengerName: unit.passengerName, // Passenger's name
                    isPlaced: false
                });
            } else {
                 // It's a regular Unit instance (vehicle without passengers, or infantry without transport)
                 deploymentPool[faction][groupKey].units.push({
                    id: unit.id,
                    typeId: unit.templateId, // Use templateId from the Unit instance
                    name: unit.name,
                    unitClass: unit.unitClass,
                    // transport: unit.transport, // Not needed in pool if unit is placed directly
                    isPlaced: false
                });
            }
        });

        // Render and show the deployment UI for the current player faction
        renderDeploymentUI(deploymentPool, currentFaction); // Pass currentFaction
        if (deploymentPanel) deploymentPanel.style.display = 'block';
        logToCombatLog(`Deployment phase started for ${currentFaction}. Place your units.`);
    }
}

function updateStanceUI(selectedUnit) { /* ... (no changes needed, already checks isDeploymentPhase) ... */
    stanceButtons.forEach(button => {
        const stance = button.dataset.stance;
        if (selectedUnit && selectedUnit.faction === currentFaction && !isDeploymentPhase) { // Disable during deployment
            button.disabled = false; button.style.opacity = '1';
            button.style.border = (selectedUnit.currentStance === stance) ? '2px solid #FFD700' : '1px solid #ccc';
        } else {
            button.disabled = true; button.style.opacity = '0.5'; button.style.border = '1px solid #ccc';
        }
    });
    if (isDeploymentPhase) {
         stanceTooltip.textContent = `Place units first.`;
    } else if (selectedUnit && selectedUnit.faction === currentFaction) {
        stanceTooltip.textContent = `Current Stance: ${selectedUnit.currentStance}. Click to change.`;
    } else if (selectedUnit) {
        stanceTooltip.textContent = `Cannot change stance for opponent's unit.`;
    } else {
        stanceTooltip.textContent = `Select one of your units to set stance.`;
    }
}

window.addEventListener('DOMContentLoaded', initializeGame);

// --- Event Listeners ---
stanceButtons.forEach(button => { /* ... (no changes needed) ... */
    button.addEventListener('click', () => {
        if (isDeploymentPhase) return;
        const stance = button.dataset.stance;
        const selectedUnit = activeUnits.find(u => u.id === selectedUnitId);
        if (selectedUnit && selectedUnit.faction === currentFaction) {
            selectedUnit.currentStance = stance;
            console.log(`Unit ${selectedUnit.id} stance changed to: ${stance}`);
            updateStanceUI(selectedUnit);
        }
    });
});
redrawButton.addEventListener('click', () => { /* ... (no changes needed) ... */
    const cols = parseInt(colsInput.value, 10); const rows = parseInt(rowsInput.value, 10); const size = parseInt(sizeInput.value, 10);
    if (isNaN(cols) || isNaN(rows) || isNaN(size)) { alert("Please enter valid numbers."); return; }
    const dims = setupMap(ctx, canvas, cols, rows, size, canvasPadding, colsInput, rowsInput, sizeInput, (c, r, s, ox, oy) => {
        gridCols = c; gridRows = r; squareSize = s; gridOffsetX = ox; gridOffsetY = oy; redraw();
    });
    gridCols = dims.gridCols; gridRows = dims.gridRows; squareSize = dims.squareSize; gridOffsetX = dims.gridOffsetX; gridOffsetY = dims.gridOffsetY;
    redraw();
    updateInfoPanel(null, { infoName, infoClass, infoFaction, infoHealth, infoMovement, infoStance, infoAmmo, infoContent, noSelectionMsg }, weaponsData, ammoData);
});

// Canvas click to add/select units OR place deployment units
canvas.addEventListener('click', (event) => {
    if (event.button === 2) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left; const clickY = event.clientY - rect.top;
    const col = Math.floor((clickX - gridOffsetX) / squareSize); const row = Math.floor((clickY - gridOffsetY) / squareSize);
    if (col < 0 || col >= gridCols || row < 0 || row >= gridRows) return;

    const clickedUnit = activeUnits.find(u => u.col === col && u.row === row);

    // --- Deployment Phase Placement ---
    if (isDeploymentPhase && selectedDeploymentUnit && !clickedUnit) {
        // TODO: Add deployment zone validation
        try {
            // Add logging to check selectedDeploymentUnit
            console.log("Attempting placement. Selected:", JSON.stringify(selectedDeploymentUnit));

            // Ensure selectedDeploymentUnit is valid and contains typeId
            if (!selectedDeploymentUnit || typeof selectedDeploymentUnit.typeId === 'undefined') {
                 console.error("Placement Error: selectedDeploymentUnit is invalid or missing typeId.", selectedDeploymentUnit);
                 logToCombatLog("Error: Invalid unit selected for placement.");
                 document.querySelectorAll('#deploymentList .deployment-item').forEach(item => { item.style.fontWeight = 'normal'; item.style.backgroundColor = ''; });
                 selectedDeploymentUnit = null; // Clear internal selection
                 return;
            }

            // Find the corresponding unit data in the pool again to ensure it's the correct one and not stale
            let unitDataFromPool = null;
            const poolFaction = deploymentPool[currentFaction];
            if (poolFaction) {
                for (const groupKey in poolFaction) {
                    const group = poolFaction[groupKey];
                    // Find unit by ID within the specific group's units array
                    const foundUnit = group.units.find(u => u.id === selectedDeploymentUnit.id && !u.isPlaced);
                    if (foundUnit) { unitDataFromPool = foundUnit; break; }
                }
            }

            // Verify the found data
            if (!unitDataFromPool || unitDataFromPool.typeId !== selectedDeploymentUnit.typeId) {
                 console.error("Mismatch or unit not found in pool during placement:", selectedDeploymentUnit, unitDataFromPool);
                 logToCombatLog("Error: Could not verify unit for placement.");
                 selectedDeploymentUnit = null;
                 document.querySelectorAll('#deploymentList .deployment-item').forEach(item => { item.style.fontWeight = 'normal'; item.style.backgroundColor = ''; });
                 return;
            }

            // Use the verified data from the pool
            const unitData = unitDataFromPool;
            console.log("Verified unitData for placement:", unitData);

            let placedUnitName = unitData.name; // Default name

            // Check if placing a transport with a passenger
            if (unitData.passengerTypeId) {
                // Create the transport unit
                const transportUnit = new Unit(
                    unitData.typeId, col, row,
                    unitTemplates, weaponsData, ammoData,
                    unitData.id, // Use the pre-assigned transport ID
                    currentFaction
                );

                // Create the passenger unit (don't assign col/row yet)
                const passengerUnit = new Unit(
                    unitData.passengerTypeId, -1, -1, // Place off-map initially
                    unitTemplates, weaponsData, ammoData,
                    nextUnitId++, // Assign a new ID for the passenger
                    currentFaction
                );
                passengerUnit._originGroupId = unitData._originGroupId; // Keep track of origin

                // Load passenger into transport immediately
                transportUnit.carriedUnit = passengerUnit;
                console.log(`Pre-loaded ${passengerUnit.name} into ${transportUnit.name}`);

                // Add ONLY the transport to active units
                activeUnits.push(transportUnit);
                placedUnitName = `${transportUnit.name} (carrying ${passengerUnit.name})`; // Update log message

            } else {
                // Placing a regular unit (no passenger)
                const newUnit = new Unit(
                    unitData.typeId, col, row,
                    unitTemplates, weaponsData, ammoData,
                    unitData.id, // Use the pre-assigned ID
                    currentFaction
                );
                // newUnit.transport = unitData.transport; // Transport property is on infantry, not needed here
                 newUnit._originGroupId = unitData._originGroupId; // Keep track of origin
                activeUnits.push(newUnit);
            }

            unitData.isPlaced = true; // Mark as placed in the pool
            selectedDeploymentUnit = null; // Deselect from panel

            // Update UI
            renderDeploymentUI(deploymentPool, currentFaction);
            redraw();
            logToCombatLog(`Placed ${placedUnitName} at (${col}, ${row}).`);

        } catch (error) {
            console.error("Error placing deployment unit:", error);
            logToCombatLog(`Error placing unit: ${error.message}`);
        }
        return;
    }

    // --- Unit Placement (Sandbox Mode Only) ---
    const selectedTypeId = unitSelect.value;
    if (!isDeploymentPhase && !scenarioData && selectedTypeId && !clickedUnit) { /* ... (sandbox logic) ... */
        if (Object.keys(unitTemplates).length === 0) { console.warn("Unit templates not loaded."); return; }
        try {
            const newUnit = new Unit(selectedTypeId, col, row, unitTemplates, weaponsData, ammoData, nextUnitId++);
            const template = unitTemplates[selectedTypeId];
            if (template && template.faction) newUnit.faction = template.faction;
            activeUnits.push(newUnit);
            redraw();
        } catch (error) { console.error("Error creating unit:", error); alert("Failed to add unit."); }
        return;
    }

    // --- Unit Selection Logic (Outside Deployment) ---
    if (!isDeploymentPhase) { /* ... (selection logic) ... */
        if (clickedUnit && clickedUnit.id === selectedUnitId) selectedUnitId = null;
        else if (clickedUnit) selectedUnitId = clickedUnit.id;
        else selectedUnitId = null;

        redraw();
        const selectedUnitInstance = activeUnits.find(u => u.id === selectedUnitId);
        // Pass new elements to updateInfoPanel
        updateInfoPanel(selectedUnitInstance, { infoName, infoClass, infoFaction, infoHealth, infoMovement, infoStance, infoAmmo, infoContent, noSelectionMsg, infoCarriedUnitContainer, infoCarriedUnit }, weaponsData, ammoData);
        updateStanceUI(selectedUnitInstance);

        // Debugging unload button visibility
        if (unloadUnitButton) {
            console.log("Checking unload button visibility for unit:", selectedUnitInstance?.id, selectedUnitInstance?.name);
            console.log("  - Has capacity:", selectedUnitInstance?.capacity);
            console.log("  - Has carriedUnit:", selectedUnitInstance?.carriedUnit); // Log the carried unit object itself
            const shouldShow = !!(selectedUnitInstance?.capacity && selectedUnitInstance.carriedUnit); // Ensure boolean
            console.log("  - Should show button:", shouldShow);
            unloadUnitButton.style.display = shouldShow ? 'inline-block' : 'none'; // Explicitly set display
            unloadUnitButton.disabled = !shouldShow;
        }
    } else { // During Deployment
        if (!clickedUnit) { // Clicked empty space
            // selectedDeploymentUnit = null; // Don't clear selection when clicking empty space, allow placement click
            document.querySelectorAll('#deploymentList .deployment-item').forEach(item => { item.style.fontWeight = 'normal'; item.style.backgroundColor = ''; });
        }
    }
});

// Right-click to move/attack/load (Disabled during deployment)
canvas.addEventListener('contextmenu', (event) => { /* ... (no changes needed, already checks isDeploymentPhase) ... */
    event.preventDefault();
    if (isDeploymentPhase) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left; const clickY = event.clientY - rect.top;
    const col = Math.floor((clickX - gridOffsetX) / squareSize); const row = Math.floor((clickY - gridOffsetY) / squareSize);
    if (col < 0 || col >= gridCols || row < 0 || row >= gridRows) return;

    const selectedUnit = activeUnits.find(u => u.id === selectedUnitId);
    if (!selectedUnit || selectedUnit.faction !== currentFaction) return;

    const targetUnit = activeUnits.find(u => u.col === col && u.row === row);

    // --- Load Action ---
    const isInfantry = selectedUnit.symbol?.includes('infantry');
    if (isInfantry && targetUnit && targetUnit.faction === currentFaction && targetUnit.capacity && !targetUnit.carriedUnit) {
        const dist = Math.abs(targetUnit.col - selectedUnit.col) + Math.abs(targetUnit.row - selectedUnit.row);
        if (dist === 1) {
            targetUnit.carriedUnit = selectedUnit;
            const unitIndex = activeUnits.findIndex(u => u.id === selectedUnit.id);
            if (unitIndex > -1) activeUnits.splice(unitIndex, 1);
            logToCombatLog(`${targetUnit.name} loaded ${selectedUnit.name}.`);
            selectedUnitId = targetUnit.id;
            redraw();
            // Pass new elements to updateInfoPanel
            updateInfoPanel(targetUnit, { infoName, infoClass, infoFaction, infoHealth, infoMovement, infoStance, infoAmmo, infoContent, noSelectionMsg, infoCarriedUnitContainer, infoCarriedUnit }, weaponsData, ammoData);
            updateStanceUI(targetUnit);
            return;
        }
    }

    // --- Attack Action ---
    if (targetUnit && targetUnit.faction !== currentFaction) {
        if (selectedUnit.hasAttacked) { console.log(`Unit ${selectedUnit.id} already attacked.`); return; }
        const attackSuccessful = performCombat(selectedUnit, targetUnit, activeUnits, weaponsData, ammoData);
        if (attackSuccessful) {
            redraw();
            const unitToShowInfo = activeUnits.find(u => u.id === targetUnit.id) || selectedUnit;
            // Pass new elements to updateInfoPanel
            updateInfoPanel(unitToShowInfo, { infoName, infoClass, infoFaction, infoHealth, infoMovement, infoStance, infoAmmo, infoContent, noSelectionMsg, infoCarriedUnitContainer, infoCarriedUnit }, weaponsData, ammoData);
            updateStanceUI(selectedUnit);
        }
        return;
    }

    // --- Movement Action ---
    if (!targetUnit) {
        const moveSuccessful = performMove(selectedUnit, col, row, activeUnits);
        if (moveSuccessful) {
            redraw();
            // Pass new elements to updateInfoPanel
            updateInfoPanel(selectedUnit, { infoName, infoClass, infoFaction, infoHealth, infoMovement, infoStance, infoAmmo, infoContent, noSelectionMsg, infoCarriedUnitContainer, infoCarriedUnit }, weaponsData, ammoData);
        }
    }
});

// Remove unit button
removeUnitButton.addEventListener('click', () => { /* ... (no changes needed) ... */
    if (scenarioData || isDeploymentPhase) { console.log("Cannot remove units."); return; }
    if (selectedUnitId === null) { alert("Select unit to remove."); return; }
    const unitIndex = activeUnits.findIndex(unit => unit.id === selectedUnitId);
    if (unitIndex !== -1) {
        activeUnits.splice(unitIndex, 1);
        selectedUnitId = null;
        redraw();
        // Pass new elements to updateInfoPanel
        updateInfoPanel(null, { infoName, infoClass, infoFaction, infoHealth, infoMovement, infoStance, infoAmmo, infoContent, noSelectionMsg, infoCarriedUnitContainer, infoCarriedUnit }, weaponsData, ammoData);
        updateStanceUI(null);
    }
});

// --- Unload Button Logic ---
if (unloadUnitButton) { /* ... (no changes needed) ... */
    unloadUnitButton.addEventListener('click', () => {
        if (isDeploymentPhase) return;
        const selectedUnit = activeUnits.find(u => u.id === selectedUnitId);
        if (!selectedUnit?.capacity || !selectedUnit.carriedUnit) return;

        let unloadCol = -1, unloadRow = -1;
        const potentialSpots = [ { r: selectedUnit.row + 1, c: selectedUnit.col }, { r: selectedUnit.row - 1, c: selectedUnit.col }, { r: selectedUnit.row, c: selectedUnit.col + 1 }, { r: selectedUnit.row, c: selectedUnit.col - 1 } ];
        for (const spot of potentialSpots) {
            if (spot.c >= 0 && spot.c < gridCols && spot.r >= 0 && spot.r < gridRows && !activeUnits.some(u => u.col === spot.c && u.row === spot.r)) {
                unloadCol = spot.c; unloadRow = spot.r; break;
            }
        }

        if (unloadCol !== -1) {
            const carried = selectedUnit.carriedUnit;
            carried.col = unloadCol; carried.row = unloadRow;
            activeUnits.push(carried);
            selectedUnit.carriedUnit = null;
            logToCombatLog(`${selectedUnit.name} unloaded ${carried.name}.`);
            redraw();
            // Pass new elements to updateInfoPanel
            updateInfoPanel(selectedUnit, { infoName, infoClass, infoFaction, infoHealth, infoMovement, infoStance, infoAmmo, infoContent, noSelectionMsg, infoCarriedUnitContainer, infoCarriedUnit }, weaponsData, ammoData);
            updateStanceUI(selectedUnit);
        } else { alert("No empty adjacent space to unload!"); }
    });
}

// --- Turn Processing Functions ---
function handleTurnEnd() {
    redraw();
    // Pass new elements to updateInfoPanel
    updateInfoPanel(null, { infoName, infoClass, infoFaction, infoHealth, infoMovement, infoStance, infoAmmo, infoContent, noSelectionMsg, infoCarriedUnitContainer, infoCarriedUnit }, weaponsData, ammoData);
    updateStanceUI(null);
    canvas.style.pointerEvents = 'auto';
    endTurnButton.disabled = false;
    console.log("Turn end processing complete.");
}
window.processTurnEnd = function processTurnEnd() { /* ... (no changes needed, already checks isDeploymentPhase) ... */
    if (isDeploymentPhase) { alert("Finish deployment first!"); return; }
    if (activeUnits.length === 0) { alert("No units on map."); return; }

    const factionsPresent = [...new Set(activeUnits.map(unit => unit.faction))];
    if (factionsPresent.length <= 1) { console.log("Only one faction present."); alert(`Only ${factionsPresent[0] || 'one'} faction remaining.`); return; }
    factionsPresent.sort();

    const currentIndex = factionsPresent.indexOf(currentFaction);
    const nextIndex = (currentIndex + 1) % factionsPresent.length;
    const nextFaction = factionsPresent[nextIndex];

    console.log(`Switching turn: ${currentFaction} -> ${nextFaction}. Factions: ${factionsPresent.join(', ')}`);
    currentFaction = nextFaction;

    activeUnits.forEach(unit => { if (unit.faction === currentFaction) { unit.hasMoved = false; unit.hasAttacked = false; unit.movementRemaining = unit.movementSpeed; } });
    selectedUnitId = null;

    if (turnDiv) turnDiv.textContent = `Current Turn: ${currentFaction}`;

    redraw();
    // Pass new elements to updateInfoPanel
    updateInfoPanel(null, { infoName, infoClass, infoFaction, infoHealth, infoMovement, infoStance, infoAmmo, infoContent, noSelectionMsg, infoCarriedUnitContainer, infoCarriedUnit }, weaponsData, ammoData);
    updateStanceUI(null);

    if (AI_FACTIONS.includes(currentFaction)) {
        canvas.style.pointerEvents = 'none'; endTurnButton.disabled = true;
        console.log(`Starting AI turn for ${currentFaction}...`);
        runAITurn(currentFaction, activeUnits, weaponsData, ammoData, gridCols, gridRows, redraw, handleTurnEnd);
    } else {
        canvas.style.pointerEvents = 'auto'; endTurnButton.disabled = false;
    }
}
endTurnButton.addEventListener('click', processTurnEnd);

// --- Deployment UI Rendering ---
function renderDeploymentUI(pool, playerFaction) {
    if (!deployListDiv) return;
    deployListDiv.innerHTML = '';

    const factionPool = pool[playerFaction]; // Use the correct player faction
    if (!factionPool || Object.keys(factionPool).length === 0) {
        deployListDiv.innerHTML = '<p>No units available for deployment for this faction.</p>';
        return;
    }

    for (const groupKey in factionPool) {
        const groupData = factionPool[groupKey];
        const groupContainer = document.createElement('div');
        groupContainer.style.marginBottom = '10px';

        const groupHeader = document.createElement('h4');
        groupHeader.textContent = groupData.name || groupKey;
        groupHeader.style.margin = '5px 0';
        groupContainer.appendChild(groupHeader);

        const ul = document.createElement('ul');
        ul.style.listStyle = 'none'; ul.style.paddingLeft = '15px';

        if (groupData.units?.length > 0) {
            groupData.units.forEach(unitData => { // unitData now includes passengerTypeId/Name if applicable
                const li = document.createElement('li');
                // Display passenger info in the format "Passenger (Transport)" or just "Unit Name"
                let displayText = unitData.name; // Default to unit name (transport or standalone)
                if (unitData.passengerName) {
                    // Format as "Passenger (Transport)"
                    displayText = `${unitData.passengerName} (${unitData.name})`;
                } else {
                    // Add unit class for non-passenger entries
                    displayText += ` (${unitData.unitClass})`;
                }
                li.textContent = displayText;
                li.dataset.unitId = unitData.id; // This is the transport's ID if it has a passenger
                li.dataset.groupKey = groupKey;
                li.classList.add('deployment-item');

                if (unitData.isPlaced) {
                    li.style.textDecoration = 'line-through'; li.style.color = 'grey'; li.style.cursor = 'default';
                } else {
                    li.style.cursor = 'pointer';
                    li.onclick = () => {
                        // Find the actual unit data object from the pool to ensure it has typeId etc.
                        const actualUnitData = deploymentPool[playerFaction]?.[groupKey]?.units.find(u => u.id === unitData.id);
                        console.log("UI Click - Found actual data:", actualUnitData); // Log found data

                        if (actualUnitData && !actualUnitData.isPlaced) {
                            selectedDeploymentUnit = actualUnitData; // Assign the full object
                            console.log("UI Click - Assigned selectedDeploymentUnit:", selectedDeploymentUnit); // Log assigned object

                            document.querySelectorAll('#deploymentList .deployment-item').forEach(item => {
                                const isSelected = item.dataset.unitId === unitData.id.toString();
                                item.style.fontWeight = isSelected ? 'bold' : 'normal';
                                item.style.backgroundColor = isSelected ? '#e0e0e0' : '';
                            });
                            logToCombatLog(`Selected ${unitData.name} for placement.`);
                        } else {
                             console.log("UI Click - Unit already placed or not found, clearing selection.");
                             selectedDeploymentUnit = null;
                             document.querySelectorAll('#deploymentList .deployment-item').forEach(item => { item.style.fontWeight = 'normal'; item.style.backgroundColor = ''; });
                        }
                    };
                }
                ul.appendChild(li);
            });
        } else {
             ul.innerHTML = '<li><i>No units in this group entry.</i></li>';
        }
        groupContainer.appendChild(ul);
        deployListDiv.appendChild(groupContainer);
    }
}

// --- Start Battle Button ---
if (startBattleButton) { /* ... (no changes needed, logic seems okay) ... */
    startBattleButton.addEventListener('click', () => {
        const factionPool = deploymentPool[currentFaction] || {};
        const unplacedUnits = Object.values(factionPool).flatMap(group => group.units).some(u => !u.isPlaced);

        if (unplacedUnits && !confirm("Not all units placed. Start anyway? Unplaced units lost.")) return;

        isDeploymentPhase = false;
        if (deploymentPanel) deploymentPanel.style.display = 'none';
        logToCombatLog("Deployment finished. Battle started!");
        canvas.style.pointerEvents = 'auto';
        if (turnDiv) turnDiv.textContent = `Current Turn: ${currentFaction}`; // Update turn indicator

        // // Handle transport loading *after* placement (REMOVED - Handled during placement now)
        // const unitsToLoad = activeUnits.filter(u => u.transport);
        // const availableTransports = activeUnits.filter(u => u.capacity === true);
        // unitsToLoad.forEach(unit => {
        //      let bestTransport = null; let minDist = Infinity;
        //      availableTransports.forEach(transport => {
        //          if (transport.col === -1 || transport.row === -1) return;
        //          if (transport.id === unit.transport && !transport.carriedUnit) {
        //               const dist = Math.abs(transport.col - unit.col) + Math.abs(transport.row - unit.row);
        //               if (dist === 1 && dist < minDist) { minDist = dist; bestTransport = transport; }
        //          }
        //      });
        //      if (bestTransport) {
        //          bestTransport.carriedUnit = unit;
        //          unit.col = -1; unit.row = -1;
        //          console.log(`Loaded ${unit.name} (${unit.id}) into ${bestTransport.name} (${bestTransport.id})`);
        //      } else {
        //          console.warn(`Post-deployment: Adjacent transport ${unit.transport} not found/full for ${unit.name} (${unit.id}).`);
        //          logToCombatLog(`Warning: Adjacent transport for ${unit.name} not found/full.`);
        //      }
        //  });
        //  activeUnits = activeUnits.filter(u => u.col !== -1); // Ensure units loaded off-map are removed if needed

         redraw(); // Redraw after potential changes (though none should happen here now)
    });
}

// --- Group Expansion Function ---
/**
 * Recursively expands a group template into individual unit instances.
 * Adds _originGroupId property to track origin.
 */
function expandGroup(groupId, faction, startCol, startRow, unitTemplates, groupTemplates, ammoData, weaponsData, nextUnitIdRef, depth = 0, topLevelGroupId = null) {
    if (depth > 10) { console.error("Max group expansion depth:", groupId); return []; }

    const groupTemplate = groupTemplates[groupId];
    if (!groupTemplate) { console.warn(`Group template "${groupId}" not found.`); return []; }

    const createdUnits = [];
    let currentOffset = 0;

    const originId = topLevelGroupId || groupId;

    groupTemplate.units.forEach(item => {
        const itemType = item.type;
        const count = item.count || 1;

        for (let i = 0; i < count; i++) {
            const unitCol = startCol + currentOffset;
            const unitRow = startRow;

            if (unitCol >= gridCols) { console.warn(`Unit placement (${unitCol}, ${unitRow}) out of bounds. Skipping.`); continue; }

            if (groupTemplates[itemType]) {
                const subGroupUnits = expandGroup(
                    itemType, faction, unitCol, unitRow,
                    unitTemplates, groupTemplates, ammoData, weaponsData,
                    nextUnitIdRef, depth + 1, originId
                );
                createdUnits.push(...subGroupUnits);
                currentOffset++; // Simple offset increment per subgroup entry
            } else if (unitTemplates[itemType]) {
                const unitTemplate = unitTemplates[itemType];
                if (!unitTemplate) {
                    console.warn(`Unit template "${itemType}" referenced in group "${groupId}" not found.`);
                    continue; // Skip this item
                }

                // Check if this unit has a designated transport
                if (unitTemplate.transport) {
                    const transportTypeId = unitTemplate.transport;
                    const transportTemplate = unitTemplates[transportTypeId];

                    if (transportTemplate) {
                        // Create a placeholder for the transport carrying this unit
                        const placeholder = {
                            isPlaceholder: true,
                            id: nextUnitIdRef.value++, // Assign ID to the transport placeholder
                            templateId: transportTypeId, // Transport's template ID
                            name: transportTemplate.name,
                            unitClass: transportTemplate.unitClass,
                            faction: faction, // Use the group's faction
                            _originGroupId: originId,
                            passengerTypeId: itemType, // Infantry's template ID
                            passengerName: unitTemplate.name, // Infantry's name
                            // Store initial position from scenario/group for potential use?
                            initialCol: unitCol,
                            initialRow: unitRow
                        };
                        createdUnits.push(placeholder);
                        console.log(`Created placeholder for ${transportTemplate.name} carrying ${unitTemplate.name}`);
                        currentOffset++;
                    } else {
                        console.warn(`Transport template "${transportTypeId}" for unit "${itemType}" not found. Creating unit without transport.`);
                        // Fallback: Create the infantry unit directly if transport is missing
                        try {
                            const newUnit = new Unit(itemType, unitCol, unitRow, unitTemplates, weaponsData, ammoData, nextUnitIdRef.value++, faction);
                            newUnit._originGroupId = originId;
                            createdUnits.push(newUnit);
                            currentOffset++;
                        } catch (error) { console.error(`Fallback Error creating unit ${itemType} in group ${groupId}:`, error); }
                    }
                } else {
                    // Unit does not have a transport, create it directly
                    try {
                        const newUnit = new Unit(itemType, unitCol, unitRow, unitTemplates, weaponsData, ammoData, nextUnitIdRef.value++, faction);
                        newUnit._originGroupId = originId;
                        createdUnits.push(newUnit);
                        currentOffset++;
                    } catch (error) { console.error(`Error creating unit ${itemType} in group ${groupId}:`, error); }
                }
            } else {
                console.warn(`Type "${itemType}" in group "${groupId}" is neither unit nor group.`);
            }
        }
    });
    return createdUnits;
}
