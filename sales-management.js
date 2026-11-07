const MEDICINES_KEY = "pharmaMedicines";
const SALES_KEY = "pharmaSales";
const STOCK_HISTORY_KEY = "pharmaStockHistory";

let medicines = [];
let sales = [];
let cart = [];

const $ = id => document.getElementById(id);

/* =========================
   STORAGE HELPERS
========================= */

function readStorage(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value : [];
    } catch (error) {
        console.error(`Unable to read ${key}:`, error);
        return [];
    }
}

function money(value) {
    return "৳ " + Number(value || 0).toLocaleString("en-BD", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
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

function getMedicineId(medicine) {
    return String(medicine.id);
}

function getMedicineStock(medicine) {
    const stock = Number(medicine.stock);
    return Number.isFinite(stock) ? Math.max(0, stock) : 0;
}

function getSaleItems(sale) {
    if (Array.isArray(sale.items)) return sale.items;

    if (sale.medicineName) {
        return [{
            medicineName: sale.medicineName,
            quantity: Number(sale.quantity) || 0,
            unitPrice: Number(sale.unitPrice) || 0,
            total: Number(sale.total) || 0
        }];
    }

    return [];
}

function getSaleTotal(sale) {
    if (sale.total !== undefined) {
        return Number(sale.total) || 0;
    }

    return getSaleItems(sale).reduce(
        (sum, item) => sum + (Number(item.total) || 0),
        0
    );
}

function getSaleDate(sale) {
    const parsed = new Date(sale.dateISO || sale.date || "");
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateText(sale) {
    const date = getSaleDate(sale);
    return date ? date.toLocaleString() : "Date unavailable";
}

function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function isSameMonth(sale) {
    const date = getSaleDate(sale);
    const now = new Date();

    return Boolean(date) &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();
}

function isToday(sale) {
    const date = getSaleDate(sale);
    const now = new Date();

    return Boolean(date) &&
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
}

function loadData() {
    medicines = readStorage(MEDICINES_KEY);
    sales = readStorage(SALES_KEY);
}

/* =========================
   MEDICINE SELECTION
========================= */

function renderMedicineOptions() {
    const select = $("medicineSelect");
    const previousValue = select.value;

    select.innerHTML =
        '<option value="">Choose a medicine</option>';

    medicines.forEach(medicine => {
        const option = document.createElement("option");
        option.value = getMedicineId(medicine);
        option.textContent = medicine.name || "Unnamed medicine";
        select.appendChild(option);
    });

    if (medicines.some(
        medicine => getMedicineId(medicine) === previousValue
    )) {
        select.value = previousValue;
    }

    updateSelectedMedicine();
}

function updateSelectedMedicine() {
    const medicine = medicines.find(
        item => getMedicineId(item) === $("medicineSelect").value
    );

    if (!medicine) {
        $("unitPrice").value = money(0);

        $("stockHint").textContent = medicines.length
            ? "Choose a medicine to see its current stock."
            : "No medicines found. Add medicines in Medicine Management first.";

        $("stockHint").style.color = "";
        return;
    }

    const stock = getMedicineStock(medicine);
    const price = Number(medicine.price) || 0;
    const expiry = medicine.expiryDate;
    const expired = expiry && expiry < localDateString();

    $("unitPrice").value = money(price);

    $("stockHint").textContent =
        `Available stock: ${stock} units` +
        (expiry ? ` | Expiry: ${expiry}` : "") +
        (expired ? " | EXPIRED — cannot be sold" : "");

    $("stockHint").style.color = expired ? "#c0392b" : "";
}

/* =========================
   ADD ITEM TO CART
========================= */

function addItemToCart(event) {
    event.preventDefault();

    const medicineId = $("medicineSelect").value;
    const quantity = Number($("quantity").value);

    const medicine = medicines.find(
        item => getMedicineId(item) === medicineId
    );

    if (!medicine) {
        alert("Please select a medicine.");
        return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
        alert("Enter a valid quantity.");
        return;
    }

    if (
        medicine.expiryDate &&
        medicine.expiryDate < localDateString()
    ) {
        alert("This medicine has expired and cannot be sold.");
        return;
    }

    const stock = getMedicineStock(medicine);

    const existing = cart.find(
        item => item.medicineId === medicineId
    );

    const alreadyAdded = existing ? existing.quantity : 0;

    if (alreadyAdded + quantity > stock) {
        alert(
            `Insufficient stock. Available: ${stock - alreadyAdded} units.`
        );
        return;
    }

    const unitPrice = Number(medicine.price);

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        alert("This medicine has an invalid price.");
        return;
    }

    if (existing) {
        existing.quantity += quantity;
        existing.total = existing.quantity * existing.unitPrice;
    } else {
        cart.push({
            medicineId,
            medicineName: medicine.name || "Unnamed medicine",
            batchNumber: medicine.batchNumber || "—",
            unitPrice,
            quantity,
            total: unitPrice * quantity
        });
    }

    $("quantity").value = 1;
    renderCart();
}

/* =========================
   RENDER CART
========================= */

function renderCart() {
    const body = $("cartBody");
    body.innerHTML = "";

    $("emptyCart").style.display = cart.length ? "none" : "block";

    cart.forEach((item, index) => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHTML(item.medicineName)}</td>
            <td>${escapeHTML(item.batchNumber)}</td>
            <td>${money(item.unitPrice)}</td>
            <td>${item.quantity}</td>
            <td><strong>${money(item.total)}</strong></td>
            <td>
                <button class="small-action" type="button"
                    data-remove="${index}" aria-label="Remove item">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;

        body.appendChild(row);
    });

    const units = cart.reduce(
        (sum, item) => sum + item.quantity, 0
    );

    const total = cart.reduce(
        (sum, item) => sum + item.total, 0
    );

    $("cartItems").textContent = units;
    $("cartTotal").textContent = money(total);
}

/* =========================
   COMPLETE SALE
   AUTOMATIC STOCK UPDATE
========================= */

function completeSale(event) {
    event.preventDefault();

    if (!cart.length) {
        alert("Please add at least one medicine to the sale.");
        return;
    }

    const currentMedicines = readStorage(MEDICINES_KEY);
    const currentSales = readStorage(SALES_KEY);
    const stockHistory = readStorage(STOCK_HISTORY_KEY);

    // Validate every item before changing stock.
    for (const item of cart) {
        const medicine = currentMedicines.find(
            m => getMedicineId(m) === item.medicineId
        );

        if (!medicine) {
            alert(
                `${item.medicineName} no longer exists in Medicine Management.`
            );
            return;
        }

        if (
            medicine.expiryDate &&
            medicine.expiryDate < localDateString()
        ) {
            alert(`${item.medicineName} has expired. Sale cancelled.`);
            return;
        }

        if (getMedicineStock(medicine) < item.quantity) {
            alert(
                `Insufficient stock for ${item.medicineName}. ` +
                "Refresh and try again."
            );
            return;
        }

        if (Number(medicine.price) !== item.unitPrice) {
            alert(
                `The price of ${item.medicineName} has changed. ` +
                "Remove it and add it again."
            );
            return;
        }
    }

    const now = new Date();

    const saleId = "S-" +
        now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0") +
        "-" + now.getTime().toString().slice(-6);

    const items = cart.map(item => ({ ...item }));

    const total = items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
    );

    const sale = {
        id: saleId,
        dateISO: now.toISOString(),
        date: now.toLocaleString(),
        customer: $("customerName").value.trim(),
        paymentMethod: $("paymentMethod").value,
        note: $("saleNote").value.trim(),
        items,
        total,
        status: "Completed"
    };

    // Reduce medicine stock after a successful sale.
    const updatedMedicines = currentMedicines.map(medicine => {
        const soldItem = cart.find(
            item => item.medicineId === getMedicineId(medicine)
        );

        if (!soldItem) return medicine;

        return {
            ...medicine,
            stock: getMedicineStock(medicine) - soldItem.quantity
        };
    });

    // Record stock movements.
    const updatedHistory = [...stockHistory];

    cart.forEach(item => {
        const medicine = currentMedicines.find(
            m => getMedicineId(m) === item.medicineId
        );

        const previousStock = getMedicineStock(medicine);
        const newStock = previousStock - item.quantity;

        updatedHistory.push({
            id: `SH-${now.getTime()}-${item.medicineId}`,
            date: now.toLocaleString(),
            dateISO: now.toISOString(),
            medicineId: item.medicineId,
            name: item.medicineName,
            operation: "Sale",
            previousStock,
            change: -item.quantity,
            newStock,
            note: `Sale ID: ${saleId}`
        });
    });

    // Save data with best-effort rollback.
    const keys = [
        MEDICINES_KEY,
        SALES_KEY,
        STOCK_HISTORY_KEY
    ];

    let previousValues;

    try {
        previousValues = keys.map(
            key => localStorage.getItem(key)
        );

        localStorage.setItem(
            MEDICINES_KEY,
            JSON.stringify(updatedMedicines)
        );

        localStorage.setItem(
            SALES_KEY,
            JSON.stringify([...currentSales, sale])
        );

        localStorage.setItem(
            STOCK_HISTORY_KEY,
            JSON.stringify(updatedHistory)
        );

    } catch (error) {
        if (previousValues) {
            keys.forEach((key, index) => {
                try {
                    if (previousValues[index] === null) {
                        localStorage.removeItem(key);
                    } else {
                        localStorage.setItem(
                            key,
                            previousValues[index]
                        );
                    }
                } catch (rollbackError) {
                    console.error(
                        "Storage rollback failed:",
                        rollbackError
                    );
                }
            });
        }

        console.error("Unable to save sale:", error);

        alert(
            "Sale could not be saved. " +
            "Please check browser storage and try again."
        );

        return;
    }

    medicines = updatedMedicines;
    sales = [...currentSales, sale];
    cart = [];

    $("completeSaleForm").reset();
    $("addItemForm").reset();
    $("quantity").value = 1;

    renderMedicineOptions();
    renderCart();
    renderSummary();
    renderRecentSales();
    renderSalesHistory();

    window.dispatchEvent(new Event("pharmaMedicinesUpdated"));
    window.dispatchEvent(new Event("pharmaSalesUpdated"));
    window.dispatchEvent(new Event("pharmaStockHistoryUpdated"));

    alert(
        `Sale saved successfully!\n` +
        `Sale ID: ${saleId}\n` +
        `Total: ${money(total)}`
    );
}

/* =========================
   SALES SUMMARY
========================= */

function renderSummary() {
    const monthSales = sales.filter(isSameMonth);

    const total = monthSales.reduce(
        (sum, sale) => sum + getSaleTotal(sale),
        0
    );

    const units = monthSales.reduce(
        (sum, sale) => sum + getSaleItems(sale).reduce(
            (itemSum, item) =>
                itemSum + (Number(item.quantity) || 0),
            0
        ),
        0
    );

    $("totalSales").textContent = money(total);
    $("totalTransactions").textContent = monthSales.length;
    $("unitsSold").textContent = units;

    $("averageSale").textContent = money(
        monthSales.length ? total / monthSales.length : 0
    );
}

/* =========================
   RECENT SALES
   WITH DELETE OPTION
========================= */

function renderRecentSales() {
    const container = $("recentSales");
    const recent = [...sales].reverse().slice(0, 5);

    if (!recent.length) {
        container.innerHTML =
            '<p class="recent-empty">No sales recorded yet.</p>';
        return;
    }

    container.innerHTML = recent.map(sale => {
        const itemText = getSaleItems(sale).map(item =>
            `${item.medicineName || "Medicine"} (${Number(item.quantity) || 0})`
        ).join(", ");

        return `
            <div class="recent-row">
                <div>
                    <div class="recent-name">
                        ${escapeHTML(sale.customer || sale.id || "Internal sale")}
                    </div>

                    <div class="recent-detail">
                        ${escapeHTML(itemText)}
                    </div>

                    <div class="recent-detail">
                        ${escapeHTML(sale.id || "")}
                    </div>
                </div>

                <div>
                    <div class="recent-amount">
                        ${money(getSaleTotal(sale))}
                    </div>

                    <div class="recent-date">
                        ${escapeHTML(dateText(sale))}
                    </div>

                    <div class="recent-date">
                        ${escapeHTML(sale.paymentMethod || "—")}
                    </div>

                    <button
                        class="delete-btn"
                        type="button"
                        data-delete-sale="${escapeHTML(sale.id || "")}"
                        aria-label="Delete sale record"
                    >
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

/* =========================
   SALES HISTORY
   WITH DELETE OPTION
========================= */

function renderSalesHistory() {
    const query = $("historySearch").value.trim().toLowerCase();
    const date = $("dateFilter").value;

    const filtered = [...sales].reverse().filter(sale => {
        const items = getSaleItems(sale);

        const searchable = [
            sale.id,
            sale.customer,
            sale.paymentMethod,
            ...items.map(item => item.medicineName)
        ].join(" ").toLowerCase();

        const saleDate = getSaleDate(sale);

        const matchesDate = !date ||
            (saleDate && localDateString(saleDate) === date);

        return searchable.includes(query) && matchesDate;
    });

    const body = $("salesHistoryBody");
    body.innerHTML = "";

    $("emptyHistory").style.display =
        filtered.length ? "none" : "block";

    filtered.forEach(sale => {
        const items = getSaleItems(sale);

        const units = items.reduce(
            (sum, item) => sum + (Number(item.quantity) || 0),
            0
        );

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(dateText(sale))}</td>

            <td class="sale-id">
                ${escapeHTML(sale.id || "—")}
            </td>

            <td>
                ${escapeHTML(sale.customer || "Not provided")}
            </td>

            <td>
                ${units} unit${units === 1 ? "" : "s"}
            </td>

            <td class="amount-cell">
                ${money(getSaleTotal(sale))}
            </td>

            <td>
                ${escapeHTML(sale.paymentMethod || "—")}
            </td>

            <td>
                <span class="status">
                    ${escapeHTML(sale.status || "Completed")}
                </span>
            </td>

            <td>
                <button
                    class="view-btn"
                    type="button"
                    data-view-sale="${escapeHTML(sale.id || "")}"
                >
                    <i class="fa-regular fa-eye"></i> View
                </button>

                <button
                    class="delete-btn"
                    type="button"
                    data-delete-sale="${escapeHTML(sale.id || "")}"
                >
                    <i class="fa-solid fa-trash"></i> Delete
                </button>
            </td>
        `;

        body.appendChild(row);
    });
}

/* =========================
   DELETE SALE RECORD
   STOCK WILL NOT CHANGE
========================= */

function deleteSale(id) {
    if (!id) {
        alert("Invalid sale ID.");
        return;
    }

    // Read the latest saved sales records.
    const currentSales = readStorage(SALES_KEY);

    const sale = currentSales.find(
        item => String(item.id) === String(id)
    );

    if (!sale) {
        alert("Sale record not found. Please refresh the page.");
        refreshPageData();
        return;
    }

    const confirmed = confirm(
        `Are you sure you want to delete this sale record?\n\n` +
        `Sale ID: ${sale.id}\n` +
        `Amount: ${money(getSaleTotal(sale))}\n\n` +
        `This action cannot be undone.\n` +
        `Medicine stock will NOT be changed.`
    );

    if (!confirmed) return;

    // Delete only the selected sale record.
    const updatedSales = currentSales.filter(
        item => String(item.id) !== String(id)
    );

    // Keep a backup in case saving fails.
    let previousSalesValue;

    try {
        previousSalesValue = localStorage.getItem(SALES_KEY);

        localStorage.setItem(
            SALES_KEY,
            JSON.stringify(updatedSales)
        );

    } catch (error) {
        // Best-effort restoration of the previous sales data.
        try {
            if (previousSalesValue === null) {
                localStorage.removeItem(SALES_KEY);
            } else if (previousSalesValue !== undefined) {
                localStorage.setItem(
                    SALES_KEY,
                    previousSalesValue
                );
            }
        } catch (rollbackError) {
            console.error("Sales rollback failed:", rollbackError);
        }

        console.error("Unable to delete sale:", error);

        alert(
            "Unable to delete the sale record. " +
            "Please check browser storage and try again."
        );

        return;
    }

    // Update only sales data on this page.
    // Medicines and stock history are intentionally untouched.
    sales = updatedSales;

    renderSummary();
    renderRecentSales();
    renderSalesHistory();

    // Notify other features in the same browser tab.
    window.dispatchEvent(new Event("pharmaSalesUpdated"));

    alert("Sale record deleted successfully.");
}

/* =========================
   VIEW SALE DETAILS
========================= */

function viewSale(id) {
    const sale = sales.find(
        item => String(item.id) === String(id)
    );

    if (!sale) return;

    const itemLines = getSaleItems(sale).map(item =>
        `${item.medicineName}: ${item.quantity} × ` +
        `${money(item.unitPrice)} = ${money(item.total)}`
    );

    alert(
        `Sale ID: ${sale.id || "—"}\n` +
        `Date: ${dateText(sale)}\n` +
        `Customer: ${sale.customer || "Not provided"}\n` +
        `Payment: ${sale.paymentMethod || "—"}\n\n` +
        itemLines.join("\n") +
        `\n\nTotal: ${money(getSaleTotal(sale))}` +
        (sale.note ? `\nNote: ${sale.note}` : "")
    );
}

/* =========================
   CSV EXPORT
========================= */

function downloadCSV() {
    if (!sales.length) {
        alert("There are no sales records to download.");
        return;
    }

    const rows = [[
        "Sale ID",
        "Date",
        "Customer",
        "Medicine",
        "Quantity",
        "Unit Price",
        "Item Total",
        "Sale Total",
        "Payment Method",
        "Note"
    ]];

    sales.forEach(sale => {
        getSaleItems(sale).forEach(item => {
            rows.push([
                sale.id || "",
                dateText(sale),
                sale.customer || "",
                item.medicineName || "",
                item.quantity || 0,
                item.unitPrice || 0,
                item.total || 0,
                getSaleTotal(sale),
                sale.paymentMethod || "",
                sale.note || ""
            ]);
        });
    });

    const csv = rows.map(row =>
        row.map(value => {
            let text = String(value ?? "");

            // Prevent spreadsheet formula injection.
            if (/^[\s]*[=+\-@]/.test(text)) {
                text = "'" + text;
            }

            return '"' + text.replace(/"/g, '""') + '"';
        }).join(",")
    ).join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "pharmaguard-sales-report.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* =========================
   TODAY'S SUMMARY
========================= */

function showTodaySummary() {
    const today = sales.filter(isToday);

    const total = today.reduce(
        (sum, sale) => sum + getSaleTotal(sale),
        0
    );

    const units = today.reduce(
        (sum, sale) => sum + getSaleItems(sale).reduce(
            (itemSum, item) =>
                itemSum + (Number(item.quantity) || 0),
            0
        ),
        0
    );

    alert(
        "Today's Sales Summary\n\n" +
        `Transactions: ${today.length}\n` +
        `Units sold: ${units}\n` +
        `Total sales: ${money(total)}`
    );
}

/* =========================
   REFRESH DATA
========================= */

function refreshPageData() {
    loadData();
    renderMedicineOptions();
    renderCart();
    renderSummary();
    renderRecentSales();
    renderSalesHistory();
}

/* =========================
   EVENT LISTENERS
========================= */

$("medicineSelect").addEventListener(
    "change",
    updateSelectedMedicine
);

$("addItemForm").addEventListener(
    "submit",
    addItemToCart
);

$("completeSaleForm").addEventListener(
    "submit",
    completeSale
);

// Remove an item from the unsaved cart.
$("cartBody").addEventListener("click", event => {
    const button = event.target.closest("[data-remove]");

    if (!button) return;

    cart.splice(Number(button.dataset.remove), 1);
    renderCart();
});

// Search and date filters.
$("historySearch").addEventListener(
    "input",
    renderSalesHistory
);

$("dateFilter").addEventListener(
    "change",
    renderSalesHistory
);

$("clearFilters").addEventListener("click", () => {
    $("historySearch").value = "";
    $("dateFilter").value = "";
    renderSalesHistory();
});

// History navigation.
$("viewAll").addEventListener("click", () => {
    $("historySection").scrollIntoView({
        behavior: "smooth"
    });
});

$("focusHistory").addEventListener("click", () => {
    $("historySection").scrollIntoView({
        behavior: "smooth"
    });

    $("historySearch").focus();
});

// Quick actions.
$("todaySummary").addEventListener(
    "click",
    showTodaySummary
);

$("downloadReport").addEventListener(
    "click",
    downloadCSV
);

// Handle View and Delete buttons in both sales sections.
document.addEventListener("click", event => {
    const deleteButton = event.target.closest("[data-delete-sale]");

    if (deleteButton) {
        deleteSale(deleteButton.dataset.deleteSale);
        return;
    }

    const viewButton = event.target.closest("[data-view-sale]");

    if (viewButton) {
        viewSale(viewButton.dataset.viewSale);
    }
});

// Mobile sidebar.
$("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
});

document.addEventListener("click", event => {
    if (
        window.innerWidth <= 900 &&
        !$("sidebar").contains(event.target) &&
        !$("menuToggle").contains(event.target)
    ) {
        $("sidebar").classList.remove("open");
    }
});

// Synchronize changes from other browser tabs.
window.addEventListener("storage", event => {
    if (
        event.key === MEDICINES_KEY ||
        event.key === SALES_KEY ||
        event.key === STOCK_HISTORY_KEY ||
        event.key === null
    ) {
        refreshPageData();
    }
});

// Synchronize updates from other features in the same tab.
window.addEventListener("pharmaMedicinesUpdated", refreshPageData);
window.addEventListener("pharmaSalesUpdated", refreshPageData);
window.addEventListener("pharmaStockHistoryUpdated", refreshPageData);

// Initial page load.
loadData();
renderMedicineOptions();
renderCart();
renderSummary();
renderRecentSales();
renderSalesHistory();