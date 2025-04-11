import { performCombat, performMove } from './core.js';
import { logToCombatLog } from './ui.js';

// Simple AI Configuration
export const AI_FACTIONS = ['WarsawPact']; // Factions controlled by AI (Exported)
const AI_ACTION_DELAY = 500; // Delay in ms between AI unit actions

/**
 * Finds the nearest enemy unit to a given unit.
 * @param {Unit} unit The unit to find the nearest enemy for.
 * @param {Unit[]} allUnits Array of all active units.
 * @returns {Unit | null} The nearest enemy unit, or null if no enemies exist.
 */
function findNearestEnemy(unit, allUnits) {
    let nearestEnemy = null;
    let minDistance = Infinity;

    allUnits.forEach(otherUnit => {
        if (otherUnit.faction !== unit.faction) {
            const dist = Math.abs(otherUnit.col - unit.col) + Math.abs(otherUnit.row - unit.row);
            if (dist < minDistance) {
                minDistance = dist;
                nearestEnemy = otherUnit;
            }
        }
    });
    return nearestEnemy;
}

import { terrainTypes, defaultTerrainGrid } from './core.js';

/**
 * Finds a path towards a target using BFS with terrain move costs.
 * Avoids occupied squares and impassable terrain.
 * @param {Unit} unit The moving unit.
 * @param {Unit} target The target unit.
 * @param {Unit[]} allUnits All active units.
 * @param {number} gridCols Number of columns in the grid.
 * @param {number} gridRows Number of rows in the grid.
 * @returns {Array<{col: number, row: number}>} An array of path coordinates [{col, row}, ...], empty if no path found.
 */
function findPathTowards(unit, target, allUnits, gridCols, gridRows) {
    const visited = Array.from({ length: gridCols }, () => Array(gridRows).fill(false));
    const prev = Array.from({ length: gridCols }, () => Array(gridRows).fill(null));
    const costMap = Array.from({ length: gridCols }, () => Array(gridRows).fill(Infinity));
    const queue = [];

    queue.push({ col: unit.col, row: unit.row, cost: 0 });
    costMap[unit.col][unit.row] = 0;
    visited[unit.col][unit.row] = true;

    const directions = [
        [0, 1], [1, 0], [0, -1], [-1, 0]
    ];

    while (queue.length > 0) {
        const { col, row, cost } = queue.shift();
        for (const [dx, dy] of directions) {
            const ncol = col + dx;
            const nrow = row + dy;
            if (
                ncol >= 0 && ncol < gridCols &&
                nrow >= 0 && nrow < gridRows
            ) {
                const terrainType = (defaultTerrainGrid[nrow] && defaultTerrainGrid[nrow][ncol]) || 'plain';
                const terrain = terrainTypes[terrainType] || terrainTypes['plain'];
                if (terrain.moveCost === Infinity) continue;
                const occupied = allUnits.some(u => u.col === ncol && u.row === nrow);
                if (occupied && !(ncol === target.col && nrow === target.row)) continue;
                const newCost = cost + terrain.moveCost;
                if (newCost < costMap[ncol][nrow] && newCost <= unit.movementRemaining) {
                    costMap[ncol][nrow] = newCost;
                    prev[ncol][nrow] = { col, row };
                    queue.push({ col: ncol, row: nrow, cost: newCost });
                }
            }
        }
    }

    // Reconstruct path to the closest reachable tile to the target
    let bestCol = target.col;
    let bestRow = target.row;
    let minDist = Math.abs(target.col - unit.col) + Math.abs(target.row - unit.row);
    let found = false;
    for (let q = 0; q < gridCols; q++) {
        for (let r = 0; r < gridRows; r++) {
            if (costMap[q][r] <= unit.movementRemaining) {
                const dist = Math.abs(target.col - q) + Math.abs(target.row - r);
                if (dist < minDist) {
                    minDist = dist;
                    bestCol = q;
                    bestRow = r;
                    found = true;
                }
            }
        }
    }
    if (!found && costMap[target.col][target.row] > unit.movementRemaining) {
        // No reachable tile
        return { path: [], costMap };
    }

    // Build path from bestCol, bestRow to unit.col, unit.row
    const path = [];
    let c = bestCol;
    let r = bestRow;
    while (!(c === unit.col && r === unit.row)) {
        path.unshift({ col: c, row: r });
        const prevStep = prev[c][r];
        if (!prevStep) break;
        c = prevStep.col;
        r = prevStep.row;
    }
    return { path, costMap };
}


/**
 * Decides and executes an action for a single AI unit.
 * @param {Unit} aiUnit The AI unit to control.
 * @param {Unit[]} allUnits Array of all active units (mutable).
 * @param {object} weaponsData Game weapons data.
 * @param {object} ammoData Game ammo data.
 * @param {number} gridCols Number of columns in the grid.
 * @param {number} gridRows Number of rows in the grid.
 */
function decideUnitAction(aiUnit, allUnits, weaponsData, ammoData, gridCols, gridRows) {
    console.log(`AI deciding action for ${aiUnit.name} (ID: ${aiUnit.id})`);
    const nearestEnemy = findNearestEnemy(aiUnit, allUnits);

    if (!nearestEnemy) {
        console.log(`AI ${aiUnit.name}: No enemies found.`);
        return; // No enemies left
    }

    console.log(`AI ${aiUnit.name}: Nearest enemy is ${nearestEnemy.name} at (${nearestEnemy.col}, ${nearestEnemy.row})`);

    // 1. Try to Attack
    if (!aiUnit.hasAttacked) {
        // Check if enemy is in range *before* calling performCombat
        const dist = Math.abs(nearestEnemy.col - aiUnit.col) + Math.abs(nearestEnemy.row - aiUnit.row);
        const maxRange = aiUnit.getMaxAttackRange(weaponsData); // Assumes this checks ammo too
        if (dist <= maxRange) {
             console.log(`AI ${aiUnit.name}: Enemy in range (${dist} <= ${maxRange}). Attempting attack.`);
             const attacked = performCombat(aiUnit, nearestEnemy, allUnits, weaponsData, ammoData);
             if (attacked) {
                 console.log(`AI ${aiUnit.name}: Attacked ${nearestEnemy.name}. Action complete.`);
                 return; // Action complete
             } else {
                 console.log(`AI ${aiUnit.name}: Attack attempt failed (e.g., no ammo for weapons in range).`);
             }
        } else {
             console.log(`AI ${aiUnit.name}: Enemy out of range (${dist} > ${maxRange}).`);
        }
    } else {
         console.log(`AI ${aiUnit.name}: Already attacked this turn.`);
    }


    // 2. Try to Move (if didn't attack and hasn't moved)
    if (!aiUnit.hasAttacked && !aiUnit.hasMoved) {
         console.log(`AI ${aiUnit.name}: Attempting to move towards ${nearestEnemy.name}.`);
        const { path, costMap } = findPathTowards(aiUnit, nearestEnemy, allUnits, gridCols, gridRows);

        if (path.length > 0) {
            // Find the furthest reachable step on the path whose cost is within movementRemaining
            // Try up to 5 furthest reachable steps, decreasing distance each time
            const moveCandidates = [];
            let usedCost = 0;
            let c = aiUnit.col;
            let r = aiUnit.row;
            for (const step of path) {
                const terrainType = (defaultTerrainGrid[step.row] && defaultTerrainGrid[step.row][step.col]) || 'plain';
                const terrain = terrainTypes[terrainType] || terrainTypes['plain'];
                usedCost += terrain.moveCost;
                if (usedCost <= aiUnit.movementRemaining) {
                    moveCandidates.push({ ...step, usedCost });
                } else {
                    break;
                }
                c = step.col;
                r = step.row;
            }
            // Try from furthest to nearest (up to 5 attempts)
            let moved = false;
            for (let i = moveCandidates.length - 1, tries = 0; i >= 0 && tries < 5; i--, tries++) {
                const step = moveCandidates[i];
                console.log(`AI ${aiUnit.name}: Attempting to move to (${step.col}, ${step.row}) using ${step.usedCost} MP.`);
                if (performMove(aiUnit, step.col, step.row, allUnits)) {
                    moved = true;
                    // 3. Try to Attack Again After Moving
                    console.log(`AI ${aiUnit.name}: Re-evaluating attack after move.`);
                    const newNearestEnemy = findNearestEnemy(aiUnit, allUnits);
                    if (newNearestEnemy) {
                        const distAfterMove = Math.abs(newNearestEnemy.col - aiUnit.col) + Math.abs(newNearestEnemy.row - aiUnit.row);
                        const maxRangeAfterMove = aiUnit.getMaxAttackRange(weaponsData);
                        if (distAfterMove <= maxRangeAfterMove) {
                            console.log(`AI ${aiUnit.name}: New nearest enemy ${newNearestEnemy.name} now in range (${distAfterMove} <= ${maxRangeAfterMove}). Attempting attack.`);
                            performCombat(aiUnit, newNearestEnemy, allUnits, weaponsData, ammoData);
                        } else {
                            console.log(`AI ${aiUnit.name}: New nearest enemy ${newNearestEnemy.name} still out of range after move.`);
                        }
                    } else {
                        console.log(`AI ${aiUnit.name}: No enemies left after move.`);
                    }
                    return; // Action complete (moved, possibly attacked)
                }
            }
            if (!moved) {
                console.log(`AI ${aiUnit.name}: No valid move calculated (all attempts failed).`);
            }
        } else { // else for if(path.length > 0)
             console.log(`AI ${aiUnit.name}: No valid path found.`);
        } // end else for if(path.length > 0)
    } else { // else for if(!aiUnit.hasAttacked && !aiUnit.hasMoved)
         console.log(`AI ${aiUnit.name}: Cannot move (already moved or attacked).`);
    } // end else for if(!aiUnit.hasAttacked && !aiUnit.hasMoved)

    console.log(`AI ${aiUnit.name}: No further action taken.`);
}


/**
 * Runs the AI turn for a given faction.
 * @param {string} aiFaction The faction whose turn it is.
 * @param {Unit[]} activeUnits Array of all active units (mutable).
 * @param {object} weaponsData Game weapons data.
 * @param {object} ammoData Game ammo data.
 * @param {number} gridCols Number of columns in the grid.
 * @param {number} gridRows Number of rows in the grid.
 * @param {function} redrawCallback Function to call to redraw the game state.
 * @param {function} endTurnCallback Function to call when AI turn is finished.
 */
export async function runAITurn(aiFaction, activeUnits, weaponsData, ammoData, gridCols, gridRows, redrawCallback, endTurnCallback) {
    logToCombatLog(`--- ${aiFaction} AI Turn Start ---`);
    const aiUnits = activeUnits.filter(u => u.faction === aiFaction);

    // Process units sequentially with delays
    for (let i = 0; i < aiUnits.length; i++) {
        const unit = aiUnits[i];
        // Check if unit still exists (might have been destroyed by previous AI action)
        if (activeUnits.some(u => u.id === unit.id)) {
            decideUnitAction(unit, activeUnits, weaponsData, ammoData, gridCols, gridRows); // Pass grid dimensions
            redrawCallback(); // Redraw after each unit's action
            // Wait for a short delay before processing the next unit
            await new Promise(resolve => setTimeout(resolve, AI_ACTION_DELAY));
        }
    }

    logToCombatLog(`--- ${aiFaction} AI Turn End ---`);
    console.log(`[AI] AI turn for ${aiFaction} completed. Calling endTurnCallback().`);
    // Automatically end the AI's turn
    endTurnCallback();

    console.log("[AI] Attempting to force switch to next faction turn...");
    // --- Force switch to next faction turn ---
    if (typeof window !== 'undefined' && typeof window.processTurnEnd === 'function') {
        console.log("[AI] Found window.processTurnEnd, calling it now.");
        window.processTurnEnd();
    } else if (typeof processTurnEnd === 'function') {
        console.log("[AI] Found global processTurnEnd, calling it now.");
        processTurnEnd();
    } else {
        console.warn("[AI] Could not auto-end AI turn: processTurnEnd not found.");
    }
}
