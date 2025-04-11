/**
 * Core game rendering and map setup functions
 */
import { logToCombatLog } from './ui.js'; // Import logging

// Terrain types and default terrain grid
export const terrainTypes = {
  plain: { moveCost: 1, coverBonus: 0, blocksLOS: false, color: '#e0cda9' },      // light tan
  forest: { moveCost: 2, coverBonus: 0.3, blocksLOS: true, color: '#228B22' },    // green
  hill: { moveCost: 2, coverBonus: 0.1, blocksLOS: false, color: '#A0522D' },     // brown
  water: { moveCost: Infinity, coverBonus: 0, blocksLOS: false, color: '#1E90FF' } // blue
};

// Generate a default 30x20 terrain grid with some variation
export const defaultTerrainGrid = Array.from({ length: 20 }, (_, row) =>
  Array.from({ length: 30 }, (_, col) => {
    if (row < 3 || row > 16) return 'forest'; // top/bottom rows forest
    if (col < 3 || col > 26) return 'water';  // left/right columns water
    if ((row + col) % 11 === 0) return 'hill'; // diagonal hills
    return 'plain'; // default
  })
);

// drawSquare and drawGame moved to renderer.js

export function setupMap(ctx, canvas, cols, rows, size, canvasPadding, colsInput, rowsInput, sizeInput, drawGameCallback) {
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const gridCols = Math.max(1, Math.min(cols, 200));
    const gridRows = Math.max(1, Math.min(rows, 200));
    const squareSize = Math.max(10, Math.min(size, 100));

    if (cols !== gridCols) colsInput.value = gridCols;
    if (rows !== gridRows) rowsInput.value = gridRows;
    if (size !== squareSize) sizeInput.value = squareSize;

    const logicalWidth = (gridCols * squareSize) + canvasPadding * 2;
    const logicalHeight = (gridRows * squareSize) + canvasPadding * 2;

    canvas.width = Math.round(logicalWidth * dpr);
    canvas.height = Math.round(logicalHeight * dpr);
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;

    const gridOffsetX = canvasPadding;
    const gridOffsetY = canvasPadding;

    drawGameCallback(gridCols, gridRows, squareSize, gridOffsetX, gridOffsetY);

    return { gridCols, gridRows, squareSize, gridOffsetX, gridOffsetY };
}


/**
 * Handles the logic for an attack between two units.
 * Modifies attacker's ammo, defender's health, and the activeUnits array.
 * Logs results to the combat log.
 * @param {Unit} attacker The attacking unit instance.
 * @param {Unit} defender The defending unit instance.
 * @param {Unit[]} activeUnits The array of all active units (will be modified if defender is destroyed).
 * @param {object} weaponsData Loaded weapons data.
 * @param {object} ammoData Loaded ammo data.
 * @returns {boolean} True if an attack occurred (target in range, ammo available, etc.), false otherwise.
 */
export function performCombat(attacker, defender, activeUnits, weaponsData, ammoData) {
    console.log(`Unit ${attacker.id} attempting attack on Unit ${defender.id} in stance ${attacker.currentStance}`);

    const activeWeaponCounts = attacker.getActiveWeaponCounts();
    let totalPotentialDamage = 0;
    const combatLogMessages = [];
    let attackOccurred = false; // Flag to track if any weapon fired

    const targetCol = defender.col;
    const targetRow = defender.row;

    // Iterate through the unit's loadout to process active weapons
    for (const loadoutItem of attacker.loadoutTemplate) {
        const weaponId = loadoutItem.weaponId;
        const currentWeaponCount = activeWeaponCounts[weaponId];

        if (!currentWeaponCount || currentWeaponCount <= 0) {
            continue;
        }

        const weaponPlatform = weaponsData[weaponId];
        if (!weaponPlatform) {
            console.error(`Weapon data not found for ID: ${weaponId}`);
            continue;
        }

        // --- Infantry vs Infantry Anti-Tank Restriction ---
        const attackerIsInfantry = attacker.unitClass === "RifleSquad" || (attacker.symbol && attacker.symbol.includes("infantry"));
        const defenderIsInfantry = defender.unitClass === "RifleSquad" || (defender.symbol && defender.symbol.includes("infantry"));
        const isAntiTankWeapon = weaponPlatform.category === "Anti-Tank";

        if (attackerIsInfantry && defenderIsInfantry && isAntiTankWeapon) {
            continue;
        }

        // Check range
        const dist = Math.abs(targetCol - attacker.col) + Math.abs(targetRow - attacker.row);
        if (dist > weaponPlatform.maxDistance) {
            continue; // Weapon is out of range for this target
        }

        // Determine ammo type based on stance and availability
        let ammoToUseId = null;
        let availableAmmoCount = 0;
        const compatibleAmmo = weaponPlatform.compatibleAmmo || [];
        const preferredAmmo = loadoutItem.preferredAmmo;
        const unitAmmoStore = attacker.currentAmmo[weaponId] || {};

        if (preferredAmmo && unitAmmoStore[preferredAmmo] > 0) {
            ammoToUseId = preferredAmmo;
            availableAmmoCount = unitAmmoStore[preferredAmmo];
        } else {
            for (const ammoId of compatibleAmmo) {
                if (unitAmmoStore[ammoId] > 0) {
                    ammoToUseId = ammoId;
                    availableAmmoCount = unitAmmoStore[ammoId];
                    break;
                }
            }
        }

        if (!ammoToUseId) {
            continue; // No suitable ammo found or available
        }

        const ammoType = ammoData[ammoToUseId];
        if (!ammoType) {
            console.error(`Ammo data not found for ID: ${ammoToUseId}`);
            continue;
        }

        // --- Perform Attack Rolls for this weapon type ---
        attackOccurred = true; // Mark that at least one weapon is attempting to fire
        let hits = 0;
        const shotsToFire = Math.min(currentWeaponCount * weaponPlatform.fireRate, availableAmmoCount);

        // Calculate distance falloff factor (linear)
        const effectiveMaxDistance = Math.max(1, weaponPlatform.maxDistance);
        let distanceFactor = 1.0 - (dist / (effectiveMaxDistance + 1));
        distanceFactor = Math.max(0, Math.min(1, distanceFactor)); // Clamp between 0 and 1

        // --- Terrain cover bonus reduces hit chance ---
        const defenderTerrainType = (defaultTerrainGrid[defender.row] && defaultTerrainGrid[defender.row][defender.col]) || 'plain';
        const defenderTerrain = terrainTypes[defenderTerrainType] || terrainTypes['plain'];
        const coverBonus = defenderTerrain.coverBonus || 0;

        for (let i = 0; i < shotsToFire; i++) {
            let accuracy = weaponPlatform.baseAccuracy;
            // Reduce accuracy by cover bonus (e.g., 0.3 cover reduces 0.7 accuracy to 0.49)
            accuracy = accuracy * (1 - coverBonus);
            const roll = Math.random();
            if (roll <= accuracy) {
                hits++;
            }
        }

        // --- Effectiveness Matrix ---
        // Target type determination
        let targetType = "Infantry";
        if (defender.unitClass && typeof defender.unitClass === "string") {
            const uc = defender.unitClass.toLowerCase();
            if (uc.includes("tank")) targetType = "HeavyArmor";
            else if (uc.includes("ifv") || uc.includes("apc") || uc.includes("recon") || uc.includes("vehicle")) targetType = "LightVehicle";
            else if (uc.includes("spg") || uc.includes("artillery")) targetType = "LightVehicle";
            else if (uc.includes("infantry") || uc.includes("squad")) targetType = "Infantry";
        }

        // Effectiveness matrix
        const effectivenessMatrix = {
            "Bullet":      { Infantry: 1.0, LightVehicle: 0.3, HeavyArmor: 0.05 },
            "HEAT":        { Infantry: 0.7, LightVehicle: 1.0, HeavyArmor: 0.8 },
            "HE":          { Infantry: 1.2, LightVehicle: 0.8, HeavyArmor: 0.2 },
            "APFSDS":      { Infantry: 0.2, LightVehicle: 0.7, HeavyArmor: 1.0 }
        };

        // Get effectiveness factor
        let effType = ammoType.type || "Bullet";
        let eff = (effectivenessMatrix[effType] && effectivenessMatrix[effType][targetType]) || 0.1; // 0.1 as last resort

        // Log message with shots fired and hits
        if (hits > 0) {
            const damagePerHit = ammoType.damage * eff * distanceFactor;
            totalPotentialDamage += hits * damagePerHit;
            combatLogMessages.push(`${weaponPlatform.name} x ${currentWeaponCount} (${ammoType.name}, ${effType} vs ${targetType} x${eff.toFixed(2)}): ${shotsToFire} shots, ${hits} hits (cover ${Math.round(coverBonus * 100)}%, dmg factor ${distanceFactor.toFixed(2)})`);
            attacker.currentAmmo[weaponId][ammoToUseId] -= shotsToFire;
        } else {
            combatLogMessages.push(`${weaponPlatform.name} x ${currentWeaponCount} (${ammoType.name}): ${shotsToFire} shots, missed (cover ${Math.round(coverBonus * 100)}%)`);
        }
    } // End loop through loadout items

    if (!attackOccurred) {
        logToCombatLog(`${attacker.name} could not attack ${defender.name} (no weapons in range or with ammo).`);
        return false; // No attack happened
    }

    // --- Apply Damage and Update Log ---
    const actualDamage = Math.round(totalPotentialDamage);
    let finalMessage = `${attacker.name} attacks ${defender.name}. `;
    finalMessage += combatLogMessages.join('; ') + `. Total Damage: ${actualDamage}.`;

    if (actualDamage > 0) {
        defender.health -= actualDamage;
        if (defender.health <= 0) {
            defender.health = 0;
            // Handle carried unit logic for APC/IFV
            if (defender.carriedUnit) {
                const carried = defender.carriedUnit;
                const roll = Math.random();
                if (roll < 0.6) {
                    // 60% chance: carried unit destroyed
                    const carriedIndex = activeUnits.findIndex(u => u.id === carried.id);
                    if (carriedIndex > -1) {
                        activeUnits.splice(carriedIndex, 1);
                    }
                    finalMessage += ` ${defender.name} is destroyed! Carried unit (${carried.name}) is also destroyed.`;
                } else {
                    // 40% chance: carried unit survives, takes 0-30% casualties
                    carried.col = defender.col;
                    carried.row = defender.row;
                    const casualties = Math.floor(Math.random() * 31); // 0 to 30 percent
                    const hpLoss = Math.round(carried.maxHealth * (casualties / 100));
                    carried.health = Math.max(1, carried.health - hpLoss);
                    finalMessage += ` ${defender.name} is destroyed! Carried unit (${carried.name}) survives with ${casualties}% casualties.`;
                }
                defender.carriedUnit = null;
            }
            // Find index and remove defender from the original activeUnits array
            const defenderIndex = activeUnits.findIndex(u => u.id === defender.id);
            if (defenderIndex > -1) {
                activeUnits.splice(defenderIndex, 1);
            }
            finalMessage += ` ${defender.name} is destroyed!`;
        }
    }

    logToCombatLog(finalMessage);
    attacker.hasAttacked = true; // Mark attacker as having attacked

    return true; // Attack occurred
}

/**
 * Handles the logic for moving a unit.
 * Checks for validity (movement points, occupation) and updates unit state.
 * @param {Unit} unit The unit instance to move.
 * @param {number} targetCol The target column.
 * @param {number} targetRow The target row.
 * @param {Unit[]} activeUnits The array of all active units (for checking occupation).
 * @returns {boolean} True if the move was successful, false otherwise.
 */

export function performMove(unit, targetCol, targetRow, activeUnits) {
    if (unit.hasMoved) {
        console.log(`Unit ${unit.id} has already moved this turn.`);
        return false;
    }

    const dist = Math.abs(targetCol - unit.col) + Math.abs(targetRow - unit.row);
    if (dist === 0) {
        console.log(`Unit ${unit.id} target is same square.`);
        return false; // Cannot move to the same square
    }

    // Calculate total terrain move cost along straight-line path (no pathfinding yet)
    let totalCost = 0;
    let curCol = unit.col;
    let curRow = unit.row;
    let steps = dist;
    let dCol = targetCol > curCol ? 1 : (targetCol < curCol ? -1 : 0);
    let dRow = targetRow > curRow ? 1 : (targetRow < curRow ? -1 : 0);

    for (let i = 0; i < steps; i++) {
        if (curCol !== targetCol) curCol += dCol;
        else if (curRow !== targetRow) curRow += dRow;

        const terrainType = (defaultTerrainGrid[curRow] && defaultTerrainGrid[curRow][curCol]) || 'plain';
        const terrain = terrainTypes[terrainType] || terrainTypes['plain'];
        if (terrain.moveCost === Infinity) {
            console.log(`Unit ${unit.id} cannot cross impassable terrain (${terrainType}) at (${curCol}, ${curRow}).`);
            return false;
        }
        totalCost += terrain.moveCost;
    }

    if (totalCost > unit.movementRemaining) {
        console.log(`Unit ${unit.id} move cost ${totalCost} exceeds remaining ${unit.movementRemaining}.`);
        return false; // Not enough movement points
    }

    const occupied = activeUnits.some(u => u.col === targetCol && u.row === targetRow);
    if (occupied) {
        console.log(`Target square (${targetCol}, ${targetRow}) is occupied.`);
        return false; // Target square is occupied
    }

    // Perform the move
    unit.col = targetCol;
    unit.row = targetRow;
    unit.movementRemaining -= totalCost;
    unit.hasMoved = true;
    console.log(`Unit ${unit.id} moved to (${targetCol}, ${targetRow}). Remaining move: ${unit.movementRemaining}`);

    return true; // Move successful
}
