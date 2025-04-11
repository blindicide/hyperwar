import { customUnitTemplates } from '../custom_units.js';

/**
 * UI update and data loading functions
 */

/**
 * Updates the info panel based on the selected unit.
 * Requires weaponsData and ammoData to look up names.
 */
export function updateInfoPanel(selectedUnit, elements, weaponsData, ammoData) {
    const {
        infoName, infoClass, infoFaction, infoHealth, infoMovement,
        infoStance, infoAmmo, infoCarriedUnitContainer, infoCarriedUnit, // Added carried unit elements
        infoContent, noSelectionMsg
    } = elements;

    if (selectedUnit) {
        infoName.textContent = selectedUnit.name;
        infoClass.textContent = selectedUnit.unitClass || 'N/A';
        infoFaction.textContent = selectedUnit.faction;
        infoHealth.textContent = `${selectedUnit.health} / ${selectedUnit.maxHealth}`;
        infoMovement.textContent = `${selectedUnit.movementRemaining} / ${selectedUnit.movementSpeed}`;
        infoStance.textContent = selectedUnit.currentStance || 'Default'; // Display current stance

        // Display carried unit if applicable
        if (infoCarriedUnitContainer && infoCarriedUnit) {
            if (selectedUnit.carriedUnit) {
                infoCarriedUnit.textContent = selectedUnit.carriedUnit.name || 'Unknown';
                infoCarriedUnitContainer.style.display = 'block';
            } else {
                infoCarriedUnit.textContent = '-';
                infoCarriedUnitContainer.style.display = 'none';
            }
        }

        // Format and display weapons and ammo
        let ammoHtml = '<p><strong>Weapons:</strong></p><ul>';
        if (selectedUnit.loadoutTemplate && selectedUnit.currentAmmo && weaponsData && ammoData) {
            selectedUnit.loadoutTemplate.forEach(item => {
                const weapon = weaponsData[item.weaponId];
                if (!weapon) return;
                const weaponName = weapon.name;
                const accuracy = weapon.baseAccuracy !== undefined ? (weapon.baseAccuracy * 100).toFixed(0) + '%' : '?';
                const range = weapon.maxDistance !== undefined ? weapon.maxDistance : '?';

                ammoHtml += `<li>${weaponName} (accuracy ${accuracy}, range ${range})<ul>`;

                const ammoCounts = selectedUnit.currentAmmo[item.weaponId];
                if (ammoCounts) {
                    Object.entries(ammoCounts).forEach(([ammoId, count]) => {
                        const ammoDetails = ammoData[ammoId];
                        const ammoName = ammoDetails ? ammoDetails.name : ammoId;
                        const ammoType = ammoDetails ? ammoDetails.type : '?';
                        const damage = ammoDetails ? ammoDetails.damage : '?';
                        ammoHtml += `<li>${ammoName} (damage ${damage}, ${ammoType}): ${count}</li>`;
                    });
                }

                ammoHtml += '</ul></li>';
            });
        }
        ammoHtml += '</ul>';
        infoAmmo.innerHTML = ammoHtml;


        infoContent.style.display = 'block';
        noSelectionMsg.style.display = 'none';
    } else {
        infoName.textContent = '-';
        infoClass.textContent = '-';
        infoFaction.textContent = '-';
        infoHealth.textContent = '-';
        infoMovement.textContent = '-';
        infoStance.textContent = '-'; // Clear stance
        infoAmmo.innerHTML = '<p><strong>Ammo:</strong> <span>-</span></p>'; // Clear ammo
        if (infoCarriedUnitContainer) infoCarriedUnitContainer.style.display = 'none'; // Hide carried unit info

        infoContent.style.display = 'none';
        noSelectionMsg.style.display = 'block';
    }
}

/**
 * Populates the unit selection dropdown
 */
export function populateUnitSelect(unitSelect, unitTypesData) {
    if (!unitSelect || Object.keys(unitTypesData).length === 0) return;

    while (unitSelect.options.length > 1) {
        unitSelect.remove(1);
    }

    for (const unitTypeId in unitTypesData) {
        const unitType = unitTypesData[unitTypeId];
        const option = document.createElement('option');
        option.value = unitTypeId;
        // Display format: "Faction: Name (Class)"
        option.textContent = `${unitType.faction}: ${unitType.name} (${unitType.unitClass || 'N/A'})`;
        unitSelect.appendChild(option);
    }
}

const API_BASE = 'http://localhost:3000';

export async function loadAllGameData() {
    const loadedData = {};
    let hasError = false;

    // Load units from backend API
    try {
        const res = await fetch(`${API_BASE}/units`);
        if (!res.ok) throw new Error('Failed to fetch units');
        loadedData.unitTemplates = await res.json();
        console.log("Units loaded from backend:", loadedData.unitTemplates);
    } catch (e) {
        console.error("Error loading units from backend:", e);
        loadedData.unitTemplates = {};
        hasError = true;
    }

    // Load weapons from backend API
    try {
        const res = await fetch(`${API_BASE}/weapons`);
        if (!res.ok) throw new Error('Failed to fetch weapons');
        loadedData.weaponsData = await res.json();
        console.log("Weapons loaded from backend:", loadedData.weaponsData);
    } catch (e) {
        console.error("Error loading weapons from backend:", e);
        loadedData.weaponsData = {};
        hasError = true;
    }

    // Load ammo from backend API
    try {
        const res = await fetch(`${API_BASE}/ammo`);
        if (!res.ok) throw new Error('Failed to fetch ammo');
        loadedData.ammoData = await res.json();
        console.log("Ammo loaded from backend:", loadedData.ammoData);
    } catch (e) {
        console.error("Error loading ammo from backend:", e);
        loadedData.ammoData = {};
        hasError = true;
    }

    // Load groups from backend API
    try {
        const res = await fetch(`${API_BASE}/groups`);
        if (!res.ok) throw new Error('Failed to fetch groups');
        loadedData.groupTemplates = await res.json();
        console.log("Groups loaded from backend:", loadedData.groupTemplates);
    } catch (e) {
        console.error("Error loading groups from backend:", e);
        loadedData.groupTemplates = {};
        hasError = true;
    }

    console.log("Final loaded unitTemplates:", loadedData.unitTemplates);
    console.log("Final loaded weaponsData:", loadedData.weaponsData);
    console.log("Final loaded ammoData:", loadedData.ammoData);
    console.log("Final loaded groupTemplates:", loadedData.groupTemplates);

    return { data: loadedData, error: hasError };
}

/**
 * Logs a message to the combat log div.
 * @param {string} message - The message to log.
 */
export function logToCombatLog(message) {
    const combatLog = document.getElementById('combatLog');
    if (combatLog) {
        const entry = document.createElement('div'); // Use div for block display
        entry.textContent = message;
        combatLog.appendChild(entry);
        // Auto-scroll to the bottom
        combatLog.scrollTop = combatLog.scrollHeight;
    } else {
        console.warn("Combat log element not found!");
    }
}
