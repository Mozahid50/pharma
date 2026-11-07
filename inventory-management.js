document.addEventListener("DOMContentLoaded", function () {
    const MEDICINES_KEY = "pharmaMedicines";
    const HISTORY_KEY = "pharmaStockHistory";

    const $ = id => document.getElementById(id);

    const form = $("stockForm");
    const medicineSelect = $("medicineSelect");
    const operation = $("operation");
    const quantity = $("quantity");
    const stockNote = $("stockNote");
    const currentStock = $("currentStock");
    const inventorySearch = $("inventorySearch");

    function getMedicines() {
        try {
            const data = JSON.parse(localStorage.getItem(MEDICINES_KEY) || "[]");
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    function getHistory() {
        try {
            const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function saveHistory(history) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }

    function populateMedicineSelect() {
        const medicines = getMedicines();
        const previousValue = medicineSelect.value;

        medicineSelect.innerHTML =
            '<option value="">Select a medicine</option>';

        medicines.forEach(medicine => {
            const optionElement = document.createElement("option");
            optionElement.value = medicine.id;
            optionElement.textContent =
                `${medicine.name} — Stock: ${Number(medicine.stock) || 0}`;
            medicineSelect.appendChild(optionElement);
        });

        if (medicines.some(m => m.id === previousValue)) {
            medicineSelect.value = previousValue;
        }

        updateCurrentStock();
    }

    function updateCurrentStock() {
        const medicine = getMedicines().find(
            m => m.id === medicineSelect.value
        );

        currentStock.textContent = medicine
            ? `${Number(medicine.stock) || 0} units`
            : "Select a medicine";
    }

    function getStockStatus(medicine) {
        const stock = Number(medicine.stock) || 0;
        const limit = Number(medicine.lowStockLimit ?? 10);

        if (stock === 0) {
            return { text: "Out of Stock", className: "status-out" };
        }

        if (stock <= limit) {
            return { text: "Low Stock", className: "status-low" };
        }

        return { text: "In Stock", className: "status-normal" };
    }

    function renderInventory() {
        const medicines = getMedicines();
        const query = inventorySearch.value.trim().toLowerCase();

        const filtered = medicines.filter(medicine =>
            [
                medicine.name,
                medicine.category,
                medicine.manufacturer,
                medicine.batchNumber
            ].some(value =>
                String(value ?? "").toLowerCase().includes(query)
            )
        );

        $("inventoryBody").innerHTML = filtered.map(medicine => {
            const stock = Number(medicine.stock) || 0;
            const price = Number(medicine.price) || 0;
            const status = getStockStatus(medicine);

            return `
                <tr>
                    <td><strong>${escapeHTML(medicine.name)}</strong></td>
                    <td>${escapeHTML(medicine.category)}</td>
                    <td>${escapeHTML(medicine.batchNumber)}</td>
                    <td>৳${price.toFixed(2)}</td>
                    <td>${stock}</td>
                    <td>৳${(stock * price).toFixed(2)}</td>
                    <td>
                        <span class="status ${status.className}">
                            ${status.text}
                        </span>
                    </td>
                </tr>
            `;
        }).join("");

        $("inventoryEmpty").hidden = filtered.length > 0;

        $("medicineTypes").textContent = medicines.length;

        $("totalUnits").textContent = medicines.reduce(
            (sum, medicine) => sum + (Number(medicine.stock) || 0), 0
        );

        $("lowStockItems").textContent = medicines.filter(medicine => {
            const stock = Number(medicine.stock) || 0;
            const limit = Number(medicine.lowStockLimit ?? 10);
            return stock > 0 && stock <= limit;
        }).length;

        $("outOfStock").textContent = medicines.filter(
            medicine => (Number(medicine.stock) || 0) === 0
        ).length;

        populateMedicineSelect();
    }

    function renderHistory() {
    const history = getHistory();

    $("historyBody").innerHTML = history.slice().reverse().map(item => `
        <tr>
            <td>${escapeHTML(item.date)}</td>
            <td>${escapeHTML(item.name)}</td>
            <td>${escapeHTML(item.operation)}</td>
            <td>${Number(item.previousStock) || 0}</td>
            <td>${Number(item.change) > 0 ? "+" : ""}${Number(item.change) || 0}</td>
            <td>${Number(item.newStock) || 0}</td>
            <td>${escapeHTML(item.note || "—")}</td>
            <td>
                <button
                    type="button"
                    class="delete-history-btn"
                    data-history-id="${escapeHTML(item.id)}"
                    title="Delete stock history"
                    aria-label="Delete history for ${escapeHTML(item.name)}"
                >
                    <i class="fa-solid fa-trash"></i>
                    Delete
                </button>
            </td>
        </tr>
    `).join("");

    $("historyEmpty").hidden = history.length > 0;
}


$("historyBody").addEventListener("click", function (event) {
    const button = event.target.closest(".delete-history-btn");

    if (!button) return;

    const historyId = button.dataset.historyId;

    const confirmed = confirm(
        "Are you sure you want to delete this stock history record?\n\n" +
        "The current medicine stock will not change."
    );

    if (!confirmed) return;

    try {
        const history = getHistory();

        const updatedHistory = history.filter(
            item => String(item.id) !== String(historyId)
        );

        if (updatedHistory.length === history.length) {
            alert("History record not found.");
            return;
        }

        saveHistory(updatedHistory);
        renderHistory();

        alert("Stock history record deleted successfully.");
    } catch (error) {
        console.error("Unable to delete stock history:", error);
        alert("Could not delete the history record. Please try again.");
    }
});

    medicineSelect.addEventListener("change", updateCurrentStock);

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const medicines = getMedicines();
        const medicine = medicines.find(
            m => m.id === medicineSelect.value
        );

        if (!medicine) {
            alert("Please select a valid medicine first.");
            return;
        }

        const enteredQuantity = Number(quantity.value);

        if (
            !Number.isInteger(enteredQuantity) ||
            enteredQuantity < 0
        ) {
            alert("Please enter a valid whole-number quantity.");
            return;
        }

        const previousStock = Number(medicine.stock) || 0;

        const newStock = operation.value === "in"
            ? previousStock + enteredQuantity
            : enteredQuantity;

        if (!Number.isSafeInteger(newStock) || newStock < 0) {
            alert("The resulting stock quantity is invalid.");
            return;
        }

        if (newStock === previousStock) {
            alert("The stock quantity has not changed.");
            return;
        }

        const change = newStock - previousStock;

        const historyEntry = {
            id: Date.now().toString() + Math.random().toString(16).slice(2),
            date: new Date().toLocaleString(),
            medicineId: medicine.id,
            name: medicine.name,
            operation: operation.value === "in"
                ? "Stock In"
                : "Stock Adjustment",
            previousStock,
            change,
            newStock,
            note: stockNote.value.trim()
        };

        // Save both records before updating the visible interface.
        try {
            const history = getHistory();

            localStorage.setItem(
                MEDICINES_KEY,
                JSON.stringify(medicines.map(item =>
                    item.id === medicine.id
                        ? { ...item, stock: newStock }
                        : item
                ))
            );

            saveHistory([...history, historyEntry]);

            form.reset();
            renderInventory();
            renderHistory();

            window.dispatchEvent(new Event("pharmaMedicinesUpdated"));

            alert("Inventory updated successfully.");
        } catch (error) {
            alert(
                "Could not save the inventory. Please check browser storage."
            );
        }
    });

    inventorySearch.addEventListener("input", renderInventory);

    // Refresh if medicines are changed in another page or tab.
    window.addEventListener("storage", function (event) {
        if (event.key === MEDICINES_KEY || event.key === HISTORY_KEY) {
            renderInventory();
            renderHistory();
        }
    });

    window.addEventListener("pharmaMedicinesUpdated", function () {
        renderInventory();
        renderHistory();
    });

    renderInventory();
    renderHistory();
});