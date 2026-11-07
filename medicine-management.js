document.addEventListener("DOMContentLoaded", function () {

    const STORAGE_KEY = "pharmaMedicines";

    const form = document.getElementById("medicineForm");
    const tableBody = document.getElementById("medicineTableBody");
    const searchInput = document.getElementById("searchInput");
    const cancelBtn = document.getElementById("cancelBtn");
    const saveBtn = document.getElementById("saveBtn");
    const formTitle = document.getElementById("formTitle");
    const emptyMessage = document.getElementById("emptyMessage");

    const fields = {
        id: document.getElementById("medicineId"),
        name: document.getElementById("medicineName"),
        category: document.getElementById("category"),
        manufacturer: document.getElementById("manufacturer"),
        price: document.getElementById("price"),
        stock: document.getElementById("stock"),
        lowStockLimit: document.getElementById("lowStockLimit"),
        batchNumber: document.getElementById("batchNumber"),
        expiryDate: document.getElementById("expiryDate")
    };

    function getMedicines() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    function saveMedicines(medicines) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(medicines));
        renderMedicines();
        updateSummary();

        // Notify other open tabs/pages.
        window.dispatchEvent(new Event("pharmaMedicinesUpdated"));
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, function (char) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[char];
        });
    }

    function getStatus(medicine) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const expiry = new Date(medicine.expiryDate + "T00:00:00");
        const remainingDays = Math.ceil(
            (expiry - today) / (1000 * 60 * 60 * 24)
        );

        if (remainingDays < 0) {
            return { text: "Expired", className: "status-expired" };
        }

        if (Number(medicine.stock) === 0) {
            return { text: "Out of Stock", className: "status-out" };
        }

        if (remainingDays <= 30) {
            return { text: "Near Expiry", className: "status-near" };
        }

        if (Number(medicine.stock) <= Number(medicine.lowStockLimit)) {
            return { text: "Low Stock", className: "status-low" };
        }

        return { text: "In Stock", className: "status-normal" };
    }

    function renderMedicines() {
        const medicines = getMedicines();
        const query = searchInput.value.trim().toLowerCase();

        const filtered = medicines.filter(function (medicine) {
            return [
                medicine.name,
                medicine.category,
                medicine.manufacturer,
                medicine.batchNumber
            ].some(function (value) {
                return String(value ?? "").toLowerCase().includes(query);
            });
        });

        tableBody.innerHTML = filtered.map(function (medicine) {
            const status = getStatus(medicine);

            return `
                <tr>
                    <td><strong>${escapeHTML(medicine.name)}</strong></td>
                    <td>${escapeHTML(medicine.category)}</td>
                    <td>${escapeHTML(medicine.manufacturer)}</td>
                    <td>৳${Number(medicine.price).toFixed(2)}</td>
                    <td>${Number(medicine.stock)}</td>
                    <td>${escapeHTML(medicine.expiryDate)}</td>
                    <td>
                        <span class="status ${status.className}">
                            ${status.text}
                        </span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button type="button"
                                class="action-btn edit-btn"
                                data-action="edit"
                                data-id="${escapeHTML(medicine.id)}"
                                aria-label="Edit ${escapeHTML(medicine.name)}">
                                <i class="fa-solid fa-pen"></i>
                            </button>

                            <button type="button"
                                class="action-btn delete-btn"
                                data-action="delete"
                                data-id="${escapeHTML(medicine.id)}"
                                aria-label="Delete ${escapeHTML(medicine.name)}">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        emptyMessage.hidden = filtered.length > 0;

        if (medicines.length > 0 && filtered.length === 0) {
            emptyMessage.textContent = "No matching medicines found.";
        } else {
            emptyMessage.textContent =
                "No medicines added yet. Use the form above to add your first medicine.";
        }
    }

    function updateSummary() {
        const medicines = getMedicines();

        document.getElementById("medicineCount").textContent =
            medicines.length;

        document.getElementById("stockCount").textContent =
            medicines.reduce((sum, medicine) =>
                sum + (Number(medicine.stock) || 0), 0);

        document.getElementById("lowStockCount").textContent =
            medicines.filter(function (medicine) {
                const stock = Number(medicine.stock) || 0;
                const limit = Number(medicine.lowStockLimit) || 0;
                return stock <= limit;
            }).length;
    }

    function resetForm() {
        form.reset();
        fields.id.value = "";
        fields.lowStockLimit.value = "10";
        formTitle.textContent = "Add New Medicine";
        saveBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Medicine';
        cancelBtn.hidden = true;
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const medicines = getMedicines();

        const medicine = {
            id: fields.id.value || (
                window.crypto && crypto.randomUUID
                    ? crypto.randomUUID()
                    : String(Date.now()) + Math.random().toString(16).slice(2)
            ),
            name: fields.name.value.trim(),
            category: fields.category.value,
            manufacturer: fields.manufacturer.value.trim(),
            price: Number(fields.price.value),
            stock: Number(fields.stock.value),
            lowStockLimit: Number(fields.lowStockLimit.value),
            batchNumber: fields.batchNumber.value.trim(),
            expiryDate: fields.expiryDate.value
        };

        if (
            !medicine.name ||
            !medicine.category ||
            !medicine.manufacturer ||
            !medicine.batchNumber ||
            !medicine.expiryDate ||
            !Number.isFinite(medicine.price) ||
            medicine.price <= 0 ||
            !Number.isInteger(medicine.stock) ||
            medicine.stock < 0 ||
            !Number.isInteger(medicine.lowStockLimit) ||
            medicine.lowStockLimit < 0
        ) {
            alert("Please enter valid medicine information.");
            return;
        }

        const existingIndex = medicines.findIndex(function (item) {
            return item.id === medicine.id;
        });

        if (existingIndex >= 0) {
            medicines[existingIndex] = medicine;
        } else {
            medicines.push(medicine);
        }

        try {
            saveMedicines(medicines);
            resetForm();
            alert(existingIndex >= 0
                ? "Medicine updated successfully."
                : "Medicine added successfully.");
        } catch (error) {
            alert("Unable to save data. Please check browser storage.");
        }
    });

    tableBody.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const id = button.dataset.id;
        const action = button.dataset.action;
        const medicines = getMedicines();

        const medicine = medicines.find(function (item) {
            return item.id === id;
        });

        if (!medicine) return;

        if (action === "edit") {
            fields.id.value = medicine.id;
            fields.name.value = medicine.name;
            fields.category.value = medicine.category;
            fields.manufacturer.value = medicine.manufacturer;
            fields.price.value = medicine.price;
            fields.stock.value = medicine.stock;
            fields.lowStockLimit.value = medicine.lowStockLimit;
            fields.batchNumber.value = medicine.batchNumber;
            fields.expiryDate.value = medicine.expiryDate;

            formTitle.textContent = "Edit Medicine";
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Medicine';
            cancelBtn.hidden = false;

            form.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        if (action === "delete") {
            if (!confirm(`Delete "${medicine.name}"? This cannot be undone.`)) {
                return;
            }

            try {
                saveMedicines(medicines.filter(function (item) {
                    return item.id !== id;
                }));

                if (fields.id.value === id) {
                    resetForm();
                }

                alert("Medicine deleted successfully.");
            } catch {
                alert("Unable to delete medicine.");
            }
        }
    });

    cancelBtn.addEventListener("click", resetForm);
    searchInput.addEventListener("input", renderMedicines);

    renderMedicines();
    updateSummary();

});