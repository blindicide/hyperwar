(async () => {
const API_BASE = 'http://localhost:3000';

async function loadUnits() {
    try {
        const res = await fetch(`${API_BASE}/units`);
        if (!res.ok) throw new Error('Failed to fetch units');
        return await res.json();
    } catch (e) {
        console.error("Error loading units from server:", e);
        return {};
    }
}

async function saveUnit(id, unitObj) {
    try {
        const res = await fetch(`${API_BASE}/units`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, item: unitObj })
        });
        if (!res.ok) throw new Error('Failed to save unit');
    } catch (e) {
        console.error("Error saving unit to server:", e);
    }
}

async function deleteUnit(id) {
    try {
        const res = await fetch(`${API_BASE}/units/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete unit');
    } catch (e) {
        console.error("Error deleting unit from server:", e);
    }
}

const factionForm = document.getElementById('createFactionForm');
const factionStatus = document.getElementById('factionStatusMessage');
const factionList = document.getElementById('factionList');
const factionSelect = document.getElementById('unitFaction');
const countryGroup = document.getElementById('countryGroup');
const countrySelect = document.getElementById('unitCountry');
const customCountryInput = document.getElementById('customCountry');
let factionsCache = {};

async function loadWeapons() {
    try {
        const res = await fetch(`${API_BASE}/weapons`);
        if (!res.ok) throw new Error('Failed to fetch weapons');
        return await res.json();
    } catch (e) {
        console.error("Error loading weapons from server:", e);
        return {};
    }
}

async function loadFactions() {
    try {
        const res = await fetch(`${API_BASE}/factions`);
        if (!res.ok) throw new Error('Failed to fetch factions');
        return await res.json();
    } catch (e) {
        console.error("Error loading factions from server:", e);
        return {};
    }
}

async function populateFactionDropdown() {
    const factions = await loadFactions();
    factionsCache = factions;
    const defaultFactions = ['NATO', 'WarsawPact'];
    factionSelect.innerHTML = '';

    defaultFactions.forEach(faction => {
        const opt = document.createElement('option');
        opt.value = faction;
        opt.textContent = faction;
        factionSelect.appendChild(opt);
    });

    Object.entries(factions).forEach(([id, factionObj]) => {
        const opt = document.createElement('option');
        opt.value = factionObj.name;
        opt.textContent = factionObj.name;
        factionSelect.appendChild(opt);
    });

    const customOpt = document.createElement('option');
    customOpt.value = 'Custom';
    customOpt.textContent = 'Custom';
    factionSelect.appendChild(customOpt);

    // Populate country dropdown for the initial faction
    updateCountryDropdown(factionSelect.value);
}

// Update country dropdown based on selected faction
function updateCountryDropdown(selectedFaction) {
    if (!countryGroup || !countrySelect || !customCountryInput) return;
    countrySelect.style.display = '';
    customCountryInput.style.display = 'none';

    if (selectedFaction === 'Custom') {
        countrySelect.style.display = 'none';
        customCountryInput.style.display = '';
        countrySelect.innerHTML = '<option value="">Select a country</option>';
        return;
    }

    // Find countries for the selected faction
    let countries = [];
    if (factionsCache[selectedFaction] && Array.isArray(factionsCache[selectedFaction].countries)) {
        countries = factionsCache[selectedFaction].countries;
    } else if (selectedFaction === 'NATO') {
        countries = ["USA", "UK", "France", "FRG", "Canada"];
    } else if (selectedFaction === 'WarsawPact') {
        countries = ["USSR", "GDR", "Poland", "Czechoslovakia"];
    }
    countrySelect.innerHTML = '<option value="">Select a country</option>';
    countries.forEach(country => {
        const opt = document.createElement('option');
        opt.value = country;
        opt.textContent = country;
        countrySelect.appendChild(opt);
    });
}

async function renderUnitList() {
    const units = await loadUnits();
    const unitList = document.getElementById('unitList');
    unitList.innerHTML = '';

    // --- Dynamic class list and select ---
    const classSet = new Set();
    Object.values(units).forEach(unit => {
        if (unit.unitClass && unit.unitClass.trim()) classSet.add(unit.unitClass.trim());
    });
    const classList = Array.from(classSet).sort();
    // Populate class select
    const classSelect = document.getElementById('unitClass');
    if (classSelect) {
        classSelect.innerHTML = '';
        classList.forEach(cls => {
            const opt = document.createElement('option');
            opt.value = cls;
            opt.textContent = cls;
            classSelect.appendChild(opt);
        });
    }
    // Display class list
    const classListDiv = document.getElementById('classList');
    if (classListDiv) {
        classListDiv.innerHTML = `<b>Current Classes:</b> ${classList.join(', ')}`;
    }

    Object.entries(units).forEach(([id, unit]) => {
        const div = document.createElement('div');
        div.className = 'weapon-item';
        div.innerHTML = `
            <strong>${unit.name}</strong> (${unit.unitClass})<br/>
            Faction: ${unit.faction}, Health: ${(unit.maxHealth ?? unit.health ?? "?")}, Move: ${unit.movementSpeed}
            <br/>
            <button data-id="${id}" class="edit-unit-btn">Edit</button>
            <button data-id="${id}" class="delete-unit-btn">Delete</button>
        `;
        unitList.appendChild(div);
    });

    unitList.querySelectorAll('.delete-unit-btn').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.dataset.id;
            await deleteUnit(id);
            renderUnitList();
        };
    });

    unitList.querySelectorAll('.edit-unit-btn').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.dataset.id;
            const units = await loadUnits();
            const unit = units[id];
            if (!unit) return;

            const form = document.getElementById('createUnitForm');
            form.dataset.editingId = id;
            document.getElementById('unitName').value = unit.name;
            document.getElementById('unitClass').value = unit.unitClass;
            document.getElementById('unitFaction').value = unit.faction;
            document.getElementById('unitHealth').value = unit.health;
            document.getElementById('unitMovement').value = unit.movementSpeed;
            document.getElementById('displayChar').value = unit.display.char;
            document.getElementById('displayColor').value = unit.display.color;
            document.getElementById('displayBgColor').value = unit.display.bgColor;
            document.getElementById('statusMessage').textContent = `Editing unit: ${unit.name}`;
        };
    });
}

async function loadAndRenderWeapons() {
    const allWeapons = await loadWeapons();
    // Load ammo data for names
    let allAmmo = {};
    try {
        const res = await fetch('http://localhost:3000/ammo');
        if (res.ok) {
            allAmmo = await res.json();
        }
    } catch (e) {
        console.error("Error loading ammo for weapon assignment UI:", e);
    }
    const container = document.getElementById('weaponAssignmentContainer');
    container.innerHTML = '';

    Object.entries(allWeapons).forEach(([weaponId, weapon]) => {
        const div = document.createElement('div');
        div.className = 'weapon-item';

        // Checkbox for assignment
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `assign-weapon-${weaponId}`;
        checkbox.dataset.weaponId = weaponId;

        // Label for weapon
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.innerHTML = `<strong>${weapon.name}</strong> (ID: ${weaponId})<br/>
            Compatible Ammo: ${weapon.compatibleAmmo.map(ammoId => {
                const ammo = allAmmo[ammoId];
                return ammo ? `${ammo.name} (${ammoId})` : ammoId;
            }).join(', ')}<br/>
            Accuracy: ${weapon.baseAccuracy}, Range: ${weapon.maxDistance}, Fire Rate: ${weapon.fireRate}`;

        // Container for controls (hidden unless checked)
        const controlsDiv = document.createElement('div');
        controlsDiv.style.display = 'none';
        controlsDiv.innerHTML = `
            Max Count: <input type="number" min="1" value="1" data-weapon-id="${weaponId}" class="max-count-input" style="width:60px;" />
            Priority: <input type="number" min="1" max="3" value="3" data-weapon-id="${weaponId}" class="priority-input" style="width:60px;" />
            Preferred Ammo: <select data-weapon-id="${weaponId}" class="preferred-ammo-select">
                ${weapon.compatibleAmmo.map(ammoId => {
                    const ammo = allAmmo[ammoId];
                    return `<option value="${ammoId}">${ammo ? ammo.name : ammoId}</option>`;
                }).join('')}
            </select>
            <br/>
            Ammo Counts:<br/>
            ${weapon.compatibleAmmo.map(ammoId => {
                const ammo = allAmmo[ammoId];
                return `${ammo ? ammo.name : ammoId}: <input type="number" min="0" value="0" data-weapon-id="${weaponId}" data-ammo-id="${ammoId}" class="ammo-count-input" style="width:60px;" />`;
            }).join('')}
        `;

        // Show/hide controls on checkbox change
        checkbox.addEventListener('change', () => {
            controlsDiv.style.display = checkbox.checked ? '' : 'none';
        });

        div.appendChild(checkbox);
        div.appendChild(label);
        div.appendChild(controlsDiv);
        container.appendChild(div);
    });
}

async function saveFaction(id, factionObj) {
    try {
        const res = await fetch(`${API_BASE}/factions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, item: factionObj })
        });
        if (!res.ok) throw new Error('Failed to save faction');
    } catch (e) {
        console.error("Error saving faction to server:", e);
    }
}

async function deleteFaction(id) {
    try {
        const res = await fetch(`${API_BASE}/factions/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete faction');
    } catch (e) {
        console.error("Error deleting faction from server:", e);
    }
}

async function renderFactionList() {
    const factions = await loadFactions();
    factionList.innerHTML = '';

    Object.entries(factions).forEach(([id, faction]) => {
        const div = document.createElement('div');
        div.className = 'weapon-item';
        div.innerHTML = `
            <strong>${faction.name}</strong> (ID: ${id})<br/>
            <span>Countries: ${(faction.countries && faction.countries.length > 0) ? faction.countries.join(", ") : "None"}</span>
            <br/>
            <button data-id="${id}" class="edit-faction-btn">Edit</button>
            <button data-id="${id}" class="delete-faction-btn">Delete</button>
        `;
        factionList.appendChild(div);
    });

    factionList.querySelectorAll('.delete-faction-btn').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.dataset.id;
            await deleteFaction(id);
            renderFactionList();
            populateFactionDropdown();
        };
    });

    factionList.querySelectorAll('.edit-faction-btn').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.dataset.id;
            const factions = await loadFactions();
            const faction = factions[id];
            if (!faction) return;

            factionForm.dataset.editingId = id;
            document.getElementById('factionName').value = faction.name;
            document.getElementById('factionCountries').value = (faction.countries && faction.countries.length > 0) ? faction.countries.join(", ") : "";
            factionStatus.textContent = `Editing faction: ${faction.name}`;
        };
    });
}

factionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('factionName').value.trim();
    const countriesRaw = document.getElementById('factionCountries').value.trim();
    let countries = [];
    if (countriesRaw.length > 0) {
        countries = countriesRaw.split(',').map(c => c.trim()).filter(c => c.length > 0);
    }
    if (!name) {
        factionStatus.textContent = 'Please enter a faction name.';
        factionStatus.style.color = 'red';
        return;
    }

    let id = factionForm.dataset.editingId;
    if (!id) {
        id = `${Date.now()}`; // Numeric ID as string
    }

    await saveFaction(id, { name, countries });
    factionForm.reset();
    delete factionForm.dataset.editingId;
    factionStatus.textContent = 'Faction saved successfully.';
    factionStatus.style.color = 'green';
    renderFactionList();
    populateFactionDropdown();
});

const form = document.getElementById('createUnitForm');
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = '';
    statusMessage.style.color = 'black';

    try {
        const formData = new FormData(form);
        let countryValue = '';
        if (formData.get('unitFaction') === 'Custom') {
            countryValue = formData.get('customCountry');
        } else {
            countryValue = formData.get('unitCountry');
        }

        const unitData = {
            name: formData.get('unitName'),
            unitClass: formData.get('unitClass'),
            faction: formData.get('unitFaction') === 'Custom' ? formData.get('customFaction') : formData.get('unitFaction'),
            country: countryValue,
            health: parseInt(formData.get('unitHealth'), 10),
            maxHealth: parseInt(formData.get('unitHealth'), 10), // Add maxHealth
            movementSpeed: parseInt(formData.get('unitMovement'), 10),
            display: {
                char: formData.get('displayChar'),
                color: formData.get('displayColor'),
                bgColor: formData.get('displayBgColor'),
            },
            loadout: [] // Will populate below
        };

        // Build loadout from weapon assignment UI
        const weaponDivs = document.querySelectorAll('#weaponAssignmentContainer .weapon-item');
        weaponDivs.forEach(div => {
            const weaponIdMatch = div.innerHTML.match(/ID: ([^)<]+)/);
            if (!weaponIdMatch) return;
            const weaponId = weaponIdMatch[1];

            const maxCountInput = div.querySelector(`.max-count-input[data-weapon-id="${weaponId}"]`);
            const priorityInput = div.querySelector(`.priority-input[data-weapon-id="${weaponId}"]`);
            const preferredAmmoSelect = div.querySelector(`.preferred-ammo-select[data-weapon-id="${weaponId}"]`);
            const ammoInputs = div.querySelectorAll(`.ammo-count-input[data-weapon-id="${weaponId}"]`);

            const maxCount = parseInt(maxCountInput.value, 10) || 0;
            if (maxCount <= 0) return; // Skip weapons with zero count

            const priority = parseInt(priorityInput.value, 10) || 3;
            const preferredAmmo = preferredAmmoSelect.value;

            const ammo = {};
            ammoInputs.forEach(input => {
                const ammoId = input.dataset.ammoId;
                const count = parseInt(input.value, 10) || 0;
                ammo[ammoId] = count;
            });

            unitData.loadout.push({
                weaponId,
                maxCount,
                priority,
                preferredAmmo,
                ammo
            });
        });

        if (!unitData.name || !unitData.unitClass || !unitData.faction || !unitData.country) {
            throw new Error("Name, Class, Faction, and Country are required.");
        }
        if (isNaN(unitData.health) || unitData.health <= 0) {
            throw new Error("Health must be positive.");
        }
        if (isNaN(unitData.movementSpeed) || unitData.movementSpeed <= 0) {
            throw new Error("Movement Speed must be positive.");
        }

        let id = form.dataset.editingId;
        if (!id) {
            id = `${Date.now()}`; // Numeric ID as string
        }

        await saveUnit(id, unitData);
        form.reset();
        delete form.dataset.editingId;
        statusMessage.textContent = 'Unit saved successfully.';
        statusMessage.style.color = 'green';
        renderUnitList();
        // Reset country dropdown to match default faction
        updateCountryDropdown(factionSelect.value);
    } catch (error) {
        statusMessage.textContent = `Error: ${error.message}`;
        statusMessage.style.color = 'red';
    }
});

await loadAndRenderWeapons();
await renderFactionList();
await populateFactionDropdown();
await renderUnitList();

// Add event listener for faction dropdown to update country dropdown
if (factionSelect) {
    factionSelect.addEventListener('change', (e) => {
        const selectedFaction = factionSelect.value;
        updateCountryDropdown(selectedFaction);
    });
}

// Hide/show custom country input on page load
if (countrySelect && customCountryInput) {
    updateCountryDropdown(factionSelect.value);
}
})();
