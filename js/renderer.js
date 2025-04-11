/**
 * Handles all canvas rendering for the game map, grid, and units.
 */
import { terrainTypes, defaultTerrainGrid } from './core.js';
// import { logToCombatLog } from './ui.js'; // Import if needed for logging errors
// import { Unit } from './unit.js'; // Import if drawUnit needs Unit methods

// Background image (placeholder - removed)
// const backgroundImage = new Image();
// backgroundImage.src = '...';

export function drawSquare(context, pixelX, pixelY, size, color) {
    context.strokeStyle = color;
    context.lineWidth = 1;
    context.strokeRect(pixelX, pixelY, size, size);
}

// --- Symbol Drawing Helpers (Internal) ---

function _drawInfantry(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y + h);
    ctx.moveTo(x + w, y);
    ctx.lineTo(x, y + h);
    ctx.stroke();
}

function _drawArmor(ctx, x, y, w, h) {
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    const radiusX = w * 0.35; // Adjust scaling as needed
    const radiusY = h * 0.25; // Adjust scaling as needed
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.stroke();
}

function _drawAPC(ctx, x, y, w, h) {
    // Draw a rectangle with a dot in the center (stylized APC/IFV)
    ctx.beginPath();
    ctx.rect(x + w * 0.15, y + h * 0.3, w * 0.7, h * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.08, 0, 2 * Math.PI);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
}

function _drawSPG(ctx, x, y, w, h) {
    // Draw a rectangle with a short barrel (stylized SPG)
    ctx.beginPath();
    ctx.rect(x + w * 0.2, y + h * 0.35, w * 0.6, h * 0.3);
    ctx.stroke();
    // Barrel
    ctx.beginPath();
    ctx.moveTo(x + w * 0.8, y + h * 0.5);
    ctx.lineTo(x + w * 0.95, y + h * 0.5);
    ctx.stroke();
}

function _drawRecon(ctx, x, y, w, h) {
    // Draw a rectangle with a diagonal slash (stylized recon vehicle)
    ctx.beginPath();
    ctx.rect(x + w * 0.2, y + h * 0.35, w * 0.6, h * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.25, y + h * 0.65);
    ctx.lineTo(x + w * 0.75, y + h * 0.35);
    ctx.stroke();
}

/**
 * Draws a MIL-STD-like symbol for a unit.
 * @param {CanvasRenderingContext2D} ctx The canvas context.
 * @param {string[]} symbolTypes Array of symbol identifiers (e.g., ['infantry'], ['armor', 'wheeled']).
 * @param {string} symbolColor Color for the symbol elements.
 * @param {number} x Top-left x coordinate of the symbol's bounding box.
 * @param {number} y Top-left y coordinate of the symbol's bounding box.
 * @param {number} w Width of the symbol's bounding box.
 * @param {number} h Height of the symbol's bounding box.
 */
export function drawMilStdSymbol(ctx, symbolTypes, symbolColor, x, y, w, h) {
    ctx.strokeStyle = symbolColor;
    ctx.lineWidth = 2; // Adjust as needed

    if (symbolTypes.includes('infantry')) {
        _drawInfantry(ctx, x, y, w, h);
    }
    if (symbolTypes.includes('armor')) {
        _drawArmor(ctx, x, y, w, h);
    }
    if (symbolTypes.includes('apc') || symbolTypes.includes('ifv')) {
        _drawAPC(ctx, x, y, w, h);
    }
    if (symbolTypes.includes('spg')) {
        _drawSPG(ctx, x, y, w, h);
    }
    if (symbolTypes.includes('recon')) {
        _drawRecon(ctx, x, y, w, h);
    }
    // Add more symbol types here
}


// --- Exported Unit Drawing Function ---

/**
 * Draws a single unit on the canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Unit} unit The unit object to draw.
 * @param {number} size The size of the grid square.
 * @param {number} offsetX The grid's X offset on the canvas.
 * @param {number} offsetY The grid's Y offset on the canvas.
 * @param {string} currentFaction The faction whose turn it currently is.
 */
export function drawUnit(ctx, unit, size, offsetX, offsetY, currentFaction) {
    const pixelX = offsetX + unit.col * size;
    const pixelY = offsetY + unit.row * size;
    const centerX = pixelX + size / 2;
    const centerY = pixelY + size / 2;

    // Save context state
    const originalAlpha = ctx.globalAlpha;
    const originalStrokeStyle = ctx.strokeStyle;
    const originalLineWidth = ctx.lineWidth;
    const originalFillStyle = ctx.fillStyle;

    // Selection highlight
    if (unit.isSelected) {
        ctx.strokeStyle = '#FFD700'; // Gold
        ctx.lineWidth = 3;
        ctx.strokeRect(pixelX - 2, pixelY - 2, size + 4, size + 4);
    }

    // Background color
    if (unit.display.bgColor) {
        ctx.fillStyle = unit.display.bgColor;
        ctx.fillRect(pixelX, pixelY, size, size);
    }

    // Dim if moved/attacked this turn
    const isOwnTurn = unit.faction === currentFaction;
    if (isOwnTurn && (unit.hasMoved || unit.hasAttacked)) {
        ctx.globalAlpha = 0.5; // Dim slightly
    } else {
         ctx.globalAlpha = 1.0;
    }

    // Draw MIL-STD Symbol
    const padding = size * 0.1; // Padding inside the square
    const innerX = pixelX + padding;
    const innerY = pixelY + padding;
    const innerW = size - 2 * padding;
    const innerH = size - 2 * padding;
    drawMilStdSymbol(
        ctx,
        unit.symbol,
        unit.display.color || '#FFFFFF', // Use display color for symbol
        innerX,
        innerY,
        innerW,
        innerH
    );

    // Reset alpha after drawing symbol and before health bar
    ctx.globalAlpha = 1.0;

    // Health bar
    const healthBarHeight = 5;
    const healthBarWidth = size * 0.8;
    const healthBarX = centerX - healthBarWidth / 2;
    const healthBarY = pixelY + size - healthBarHeight - 2;
    const healthPercent = unit.health > 0 ? unit.health / unit.maxHealth : 0;

    ctx.fillStyle = '#D32F2F'; // Red background
    ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
    if (unit.health > 0) {
        ctx.fillStyle = '#4CAF50'; // Green health
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercent, healthBarHeight);
    }
    ctx.strokeStyle = '#333'; // Border
    ctx.lineWidth = 1;
    ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);

    // Restore context state
    ctx.globalAlpha = originalAlpha;
    ctx.strokeStyle = originalStrokeStyle;
    ctx.lineWidth = originalLineWidth;
    ctx.fillStyle = originalFillStyle;
}


// Main drawing function, moved from core.js
export function drawGame(ctx, canvas, gridCols, gridRows, squareSize, gridOffsetX, gridOffsetY, activeUnits, selectedUnitId, currentFaction, weaponsData) {
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform for clearing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background color instead of image
    ctx.fillStyle = '#ADD8E6'; // Light blue background
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.scale(dpr, dpr); // Scale for HiDPI displays

    const selectedUnit = activeUnits.find(u => u.id === selectedUnitId);
    const moveRange = new Set();
    const attackTargets = new Set();

    // Calculate move range for selected unit
    if (selectedUnit && selectedUnit.movementRemaining > 0) {
        // BFS for true movement cost
        const visited = Array.from({ length: gridCols }, () => Array(gridRows).fill(false));
        const queue = [];
        queue.push({
            col: selectedUnit.col,
            row: selectedUnit.row,
            cost: 0
        });
        visited[selectedUnit.col][selectedUnit.row] = true;

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
                    nrow >= 0 && nrow < gridRows &&
                    !visited[ncol][nrow]
                ) {
                    const terrainType = (defaultTerrainGrid[nrow] && defaultTerrainGrid[nrow][ncol]) || 'plain';
                    const terrain = terrainTypes[terrainType] || terrainTypes['plain'];
                    if (terrain.moveCost === Infinity) continue;
                    const newCost = cost + terrain.moveCost;
                    const occupied = activeUnits.some(u => u.col === ncol && u.row === nrow);
                    if (newCost <= selectedUnit.movementRemaining && !occupied) {
                        moveRange.add(`${ncol},${nrow}`);
                        queue.push({ col: ncol, row: nrow, cost: newCost });
                    } else if (newCost <= selectedUnit.movementRemaining && occupied) {
                        // Don't add to moveRange, but still mark as visited to prevent pathing through
                        // (prevents BFS from going through occupied tiles)
                    }
                    visited[ncol][nrow] = true;
                }
            }
        }
    }

    // Calculate attack targets for selected unit
    const maxAttackRange = selectedUnit ? selectedUnit.getMaxAttackRange(weaponsData) : 0;
    if (selectedUnit && maxAttackRange > 0) {
        activeUnits.forEach(u => {
            if (u.faction !== selectedUnit.faction) {
                const dist = Math.abs(u.col - selectedUnit.col) + Math.abs(u.row - selectedUnit.row);
                if (dist > 0 && dist <= Math.floor(maxAttackRange)) {
                    // Further check if any weapon *can* actually hit (has ammo, etc.) - complex, skip for now
                    attackTargets.add(`${u.col},${u.row}`);
                }
            }
        });
    }

    // Draw terrain tiles first
    for (let q = 0; q < gridCols; q++) {
        for (let r = 0; r < gridRows; r++) {
            const pixelX = gridOffsetX + q * squareSize;
            const pixelY = gridOffsetY + r * squareSize;
            const logicalCanvasWidth = canvas.width / dpr;
            const logicalCanvasHeight = canvas.height / dpr;

            if (pixelX < logicalCanvasWidth && pixelY < logicalCanvasHeight &&
                pixelX + squareSize > 0 && pixelY + squareSize > 0) {

                const terrainType = (defaultTerrainGrid[r] && defaultTerrainGrid[r][q]) || 'plain';
                const terrain = terrainTypes[terrainType] || terrainTypes['plain'];
                ctx.fillStyle = terrain.color;
                ctx.fillRect(pixelX, pixelY, squareSize, squareSize);
            }
        }
    }

    // Draw overlays and grid lines
    const defaultGridColor = '#ccc';
    for (let q = 0; q < gridCols; q++) {
        for (let r = 0; r < gridRows; r++) {
            const pixelX = gridOffsetX + q * squareSize;
            const pixelY = gridOffsetY + r * squareSize;
            const logicalCanvasWidth = canvas.width / dpr;
            const logicalCanvasHeight = canvas.height / dpr;

            if (pixelX < logicalCanvasWidth && pixelY < logicalCanvasHeight &&
                pixelX + squareSize > 0 && pixelY + squareSize > 0) {

                const key = `${q},${r}`;
                // Draw overlays
                if (attackTargets.has(key)) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'; // Semi-transparent red
                    ctx.fillRect(pixelX, pixelY, squareSize, squareSize);
                } else if (moveRange.has(key)) {
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.3)'; // Semi-transparent green
                    ctx.fillRect(pixelX, pixelY, squareSize, squareSize);
                }
                // Draw grid square outline
                drawSquare(ctx, pixelX, pixelY, squareSize, defaultGridColor);
            }
        }
    }

    // Draw Units
    activeUnits.forEach(unit => {
        // Check if unit is within grid bounds before drawing
        if (unit.col >= 0 && unit.col < gridCols && unit.row >= 0 && unit.row < gridRows) {
            // Call the new drawUnit function
            drawUnit(ctx, unit, squareSize, gridOffsetX, gridOffsetY, currentFaction);
        }
    });

    // Draw Attack Target Crosshairs (on top of units)
    attackTargets.forEach(key => {
        const [q, r] = key.split(',').map(Number);
        const pixelX = gridOffsetX + q * squareSize;
        const pixelY = gridOffsetY + r * squareSize;
        const padding = squareSize * 0.2; // Adjust padding for crosshair size

        ctx.strokeStyle = '#FF0000'; // Bright red
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pixelX + padding, pixelY + padding);
        ctx.lineTo(pixelX + squareSize - padding, pixelY + squareSize - padding);
        ctx.moveTo(pixelX + squareSize - padding, pixelY + padding);
        ctx.lineTo(pixelX + padding, pixelY + squareSize - padding);
        ctx.stroke();
    });

    ctx.restore(); // Restore context state
}
