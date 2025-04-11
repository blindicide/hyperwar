document.addEventListener('DOMContentLoaded', () => {
    const weaponForm = document.getElementById('createWeaponForm');
    const weaponStatus = document.getElementById('statusMessage');
    const weaponList = document.getElementById('weaponList');

    const weaponExport = document.createElement('textarea');
    weaponExport.style.width = '100%';
    weaponExport.style.height = '100px';
    weaponExport.placeholder = 'Weapon JSON will appear here after save. Copy it into custom_weapons.js';
    weaponStatus.parentNode.insertBefore(weaponExport, weaponStatus.nextSibling);

    const ammoForm = document.getElementById('createAmmoForm');
    const ammoStatus = document.getElementById('ammoStatusMessage');
    const ammoList = document.getElementById('ammoList');

    const ammoExport = document.createElement('textarea');
    ammoExport.style.width = '100%';
    ammoExport.style.height = '100px';
    ammoExport.placeholder = 'Ammo JSON will appear here after save. Copy it into custom_ammo.js';
    ammoStatus.parentNode.insertBefore(ammoExport, ammoStatus.nextSibling);

    const API_BASE = 'http://localhost:3000'; // Change to your server IP if needed

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

    async function saveWeapon(id, weaponObj) {
        try {
            const res = await fetch(`${API_BASE}/weapons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, item: weaponObj })
            });
            if (!res.ok) throw new Error('Failed to save weapon');
        } catch (e) {
            console.error("Error saving weapon to server:", e);
        }
    }

    async function deleteWeapon(id) {
        try {
            const res = await fetch(`${API_BASE}/weapons/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete weapon');
        } catch (e) {
            console.error("Error deleting weapon from server:", e);
        }
    }

    async function loadAmmo() {
        try {
            const res = await fetch(`${API_BASE}/ammo`);
            if (!res.ok) throw new Error('Failed to fetch ammo');
            return await res.json();
        } catch (e) {
            console.error("Error loading ammo from server:", e);
            return {};
        }
    }

    async function saveAmmoItem(id, ammoObj) {
        try {
            const res = await fetch(`${API_BASE}/ammo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, item: ammoObj })
            });
            if (!res.ok) throw new Error('Failed to save ammo');
        } catch (e) {
            console.error("Error saving ammo to server:", e);
        }
    }

    async function deleteAmmo(id) {
        try {
            const res = await fetch(`${API_BASE}/ammo/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete ammo');
        } catch (e) {
            console.error("Error deleting ammo from server:", e);
        }
    }

    async function renderWeaponList() { // Make async
        const weapons = await loadWeapons(); // Await API call
        weaponList.innerHTML = '';

        Object.entries(weapons).forEach(([id, weapon]) => {
            const div = document.createElement('div');
            div.className = 'weapon-item';
            div.innerHTML = `
                <strong>${weapon.name}</strong> (ID: ${id})<br/>
                Ammo: ${weapon.compatibleAmmo.map(aid => aid).join(', ')}<br/>
                Accuracy: ${weapon.baseAccuracy}, Range: ${weapon.maxDistance}, Fire Rate: ${weapon.fireRate}
                <br/>
                <button data-id="${id}" class="edit-btn">Edit</button>
                <button data-id="${id}" class="delete-btn">Delete</button>
            `;
            weaponList.appendChild(div);
        });

        weaponList.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = async () => { // Make async
                const id = btn.dataset.id;
                await deleteWeapon(id); // Await API call
                renderWeaponList(); // Re-render
            };
        });

        weaponList.querySelectorAll('.edit-btn').forEach(btn => {
            btn.onclick = async () => { // Make async
                const id = btn.dataset.id;
                const weapons = await loadWeapons(); // Await API call
                const weapon = weapons[id];
                if (!weapon) return;

                weaponForm.dataset.editingId = id;
                document.getElementById('weaponName').value = weapon.name;
                document.getElementById('compatibleAmmo').value = weapon.compatibleAmmo.join(',');
                document.getElementById('baseAccuracy').value = weapon.baseAccuracy;
                document.getElementById('maxDistance').value = weapon.maxDistance;
                document.getElementById('fireRate').value = weapon.fireRate;
                weaponStatus.textContent = `Editing weapon: ${weapon.name}`;
            };
        });
    }

    async function renderAmmoList() { // Make async
        const ammo = await loadAmmo(); // Await API call
        ammoList.innerHTML = '';

        Object.entries(ammo).forEach(([id, a]) => {
            const div = document.createElement('div');
            div.className = 'weapon-item';
            div.innerHTML = `
                <strong>${a.name}</strong> (ID: ${id})<br/>
                Damage: ${a.damage}, Type: ${a.type}, AoE: ${a.aoeRadius}
                <br/>
                <button data-id="${id}" class="edit-ammo-btn">Edit</button>
                <button data-id="${id}" class="delete-ammo-btn">Delete</button>
            `;
            ammoList.appendChild(div);
        });

        ammoList.querySelectorAll('.delete-ammo-btn').forEach(btn => {
            btn.onclick = async () => { // Make async
                const id = btn.dataset.id;
                await deleteAmmo(id); // Await API call
                renderAmmoList(); // Re-render
            };
        });

        ammoList.querySelectorAll('.edit-ammo-btn').forEach(btn => {
            btn.onclick = async () => { // Make async
                const id = btn.dataset.id;
                const ammo = await loadAmmo(); // Await API call
                const a = ammo[id];
                if (!a) return;

                ammoForm.dataset.editingId = id;
                document.getElementById('ammoName').value = a.name;
                document.getElementById('ammoDamage').value = a.damage;
                document.getElementById('ammoType').value = a.type;
                document.getElementById('aoeRadius').value = a.aoeRadius;
                ammoStatus.textContent = `Editing ammo: ${a.name}`;
            };
        });
    }

    weaponForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('weaponName').value.trim();
        const compatibleAmmo = document.getElementById('compatibleAmmo').value.split(',').map(s => s.trim()).filter(Boolean);
        const baseAccuracy = parseFloat(document.getElementById('baseAccuracy').value);
        const maxDistance = parseInt(document.getElementById('maxDistance').value, 10);
        const fireRate = parseInt(document.getElementById('fireRate').value, 10);

        if (!name || compatibleAmmo.length === 0 || isNaN(baseAccuracy) || isNaN(maxDistance) || isNaN(fireRate)) {
            weaponStatus.textContent = 'Please fill out all fields correctly.';
            weaponStatus.style.color = 'red';
            return;
        }

        const weapons = loadWeapons();

        let id = weaponForm.dataset.editingId;
        if (!id) {
            id = `${Date.now()}`; // Numeric ID as string
        }

        weapons[id] = {
            name,
            compatibleAmmo,
            baseAccuracy,
            maxDistance,
            fireRate
        };

        saveWeapon(id, weapons[id]); // Use the correct function to save the specific item
        renderWeaponList();
        weaponForm.reset();
        delete weaponForm.dataset.editingId;
        weaponStatus.textContent = 'Weapon saved successfully.';
        weaponStatus.style.color = 'green';

        // Show JSON snippet for manual copy
        weaponExport.value = `"${id}": ${JSON.stringify(weapons[id], null, 2)},\n// Copy this into custom_weapons.js inside the exported object`;
    });

    ammoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('ammoName').value.trim();
        const damage = parseInt(document.getElementById('ammoDamage').value, 10);
        const type = document.getElementById('ammoType').value;
        const aoeRadius = parseInt(document.getElementById('aoeRadius').value, 10);

        if (!name || isNaN(damage) || isNaN(aoeRadius)) {
            ammoStatus.textContent = 'Please fill out all fields correctly.';
            ammoStatus.style.color = 'red';
            return;
        }

        const ammo = loadAmmo();

        let id = ammoForm.dataset.editingId;
        if (!id) {
            id = `${Date.now()}`; // Numeric ID as string
        }

        ammo[id] = {
            name,
            damage,
            type,
            aoeRadius
        };

        saveAmmoItem(id, ammo[id]); // Use the correct function to save the specific item
        renderAmmoList();
        ammoForm.reset();
        delete ammoForm.dataset.editingId;
        ammoStatus.textContent = 'Ammo saved successfully.';
        ammoStatus.style.color = 'green';

        // Show JSON snippet for manual copy
        ammoExport.value = `"${id}": ${JSON.stringify(ammo[id], null, 2)},\n// Copy this into custom_ammo.js inside the exported object`;
    });

    renderWeaponList();
    renderAmmoList();
});
