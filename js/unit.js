import { drawUnit } from './renderer.js'; // Import drawUnit from renderer

export class Unit {
    // Constructor now takes the template ID and all loaded game data
    constructor(templateId, col, row, unitTemplates, weaponsData, ammoData, nextUnitId) {
        const template = unitTemplates[templateId];
        if (!template) {
            throw new Error(`Unknown unit template ID: ${templateId}`);
        }

        this.id = nextUnitId;
        this.templateId = templateId; // Store the template ID
        this.name = template.name;
        this.unitClass = template.unitClass || "Unknown";
        this.faction = template.faction;
        this.maxHealth = template.maxHealth;
        this.movementSpeed = template.movementSpeed;
        this.symbol = template.symbol || ['unknown']; // Store symbol types, default if missing
        this.capacity = template.capacity; // Copy capacity property if it exists
        this.display = { ...template.display }; // Keep display for colors etc.
        this.loadoutTemplate = template.loadout || []; // Store the base loadout definition

        // Initialize current state
        this.health = this.maxHealth;
        this.col = col;
        this.row = row;
        this.movementRemaining = this.movementSpeed;
        this.isSelected = false;
        this.hasMoved = false;
        this.hasAttacked = false;
        this.currentStance = 'Default'; // Add default stance
        this.carriedUnit = null; // For APC/IFV: unit being carried, or null

        // Initialize current ammo based on the loadout template
        this.currentAmmo = {};
        this.loadoutTemplate.forEach(loadoutItem => {
            if (loadoutItem.ammo) {
                // Store ammo counts keyed by weaponId, then ammoTypeId
                this.currentAmmo[loadoutItem.weaponId] = { ...loadoutItem.ammo };
            }
        });
    }

    // Calculate currently active weapons based on health percentage and priority
    getActiveWeaponCounts() {
        const activeCounts = {};
        // Ensure healthPercent is at least 0
        const healthPercent = Math.max(0, this.health / this.maxHealth);

        this.loadoutTemplate.forEach(loadoutItem => {
            // Calculate count based purely on health percentage
            // Ensure at least 1 weapon if health > 0, up to maxCount
            let currentCount = Math.ceil(loadoutItem.maxCount * healthPercent);
            currentCount = Math.max(0, Math.min(loadoutItem.maxCount, currentCount)); // Clamp between 0 and maxCount

            // If unit is alive but count is 0, make it 1 (if maxCount > 0)
            if (this.health > 0 && currentCount === 0 && loadoutItem.maxCount > 0) {
                currentCount = 1;
            }

            console.log(`Weapon ${loadoutItem.weaponId} healthPercent ${healthPercent.toFixed(2)}, calculated count: ${currentCount}`);

            if (currentCount > 0) {
                 // Check if this weapon system has any ammo left
                 let hasAmmo = false;
                 if (this.currentAmmo[loadoutItem.weaponId]) {
                     hasAmmo = Object.values(this.currentAmmo[loadoutItem.weaponId]).some(count => count > 0);
                 } else {
                     // If weapon doesn't use ammo (defined in loadout), assume it can fire
                     if (!loadoutItem.ammo) {
                         hasAmmo = true;
                     }
                 }

                 if (hasAmmo) {
                    activeCounts[loadoutItem.weaponId] = currentCount;
                 } else {
                     console.log(`Weapon ${loadoutItem.weaponId} has no ammo.`);
                 }
            }
        });
        console.log("Active weapon counts:", activeCounts);
        return activeCounts;
    }

    // Get the maximum attack range considering all active weapons with ammo
    getMaxAttackRange(weaponsData) {
        const activeWeaponCounts = this.getActiveWeaponCounts();
        let maxRange = 0;

        for (const weaponId in activeWeaponCounts) {
            const weaponPlatform = weaponsData[weaponId];
            if (weaponPlatform && weaponPlatform.maxDistance > maxRange) {
                 // Check if there's ammo for any compatible type for this weapon
                 let hasAmmoForWeapon = false;
                 if (this.currentAmmo[weaponId]) {
                     hasAmmoForWeapon = Object.values(this.currentAmmo[weaponId]).some(count => count > 0);
                 } else {
                     // If weapon doesn't use ammo (defined in loadout), assume it can fire
                     const loadoutItem = this.loadoutTemplate.find(item => item.weaponId === weaponId);
                     if (loadoutItem && !loadoutItem.ammo) {
                         hasAmmoForWeapon = true;
                     }
                 }

                 if (hasAmmoForWeapon) {
                    maxRange = weaponPlatform.maxDistance;
                 }
            }
        }
        return maxRange;
    }


    // Draw method now delegates to the renderer
    draw(context, size, offsetX, offsetY, currentFaction) {
        drawUnit(context, this, size, offsetX, offsetY, currentFaction);
    }
}
