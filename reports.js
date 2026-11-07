const $ = id => document.getElementById(id);

const KEYS = {
    medicines: "pharmaMedicines",
    sales: "pharmaSales",
    history: "pharmaStockHistory"
};

let medicines = [];
let sales = [];
let stockHistory = [];
let currentRows = [];
let currentColumns = [];
let currentType = "sales";

function readArray(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        '"': "&quot;", "'": "&#39;"
    })[char]);
}

function money(value) {
    return "৳ " + Number(value || 0).toLocaleString("en-BD", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function localDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateOf(record) {
    const value = record.dateISO || record.date || "";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function expiryInfo(medicine) {
    const expiry = String(medicine.expiryDate || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
        return { status: "unknown", days: null, label: "No Expiry Date" };
    }

    const parsed = new Date(`${expiry}T00:00:00`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== expiry) {
        return { status: "unknown", days: null, label: "Invalid Date" };
    }

    const days = Math.round(
        (new Date(`${localDate()}T00:00:00`) - new Date(`${expiry}T00:00:00`)) / 86400000
    );

    if (days > 0) return { status: "expired", days: -days, label: "Expired" };
    if (days >= -30) return { status: "near", days: -days, label: "Near Expiry" };
    return { status: "safe", days: -days, label: "Safe" };
}

function saleItems(sale) {
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

function saleTotal(sale) {
    if (sale.total !== undefined) return Number(sale.total) || 0;
    return saleItems(sale).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
}

function isThisMonth(sale) {
    const date = dateOf(sale);
    const now = new Date();
    return date && date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth();
}

function loadData() {
    medicines = readArray(KEYS.medicines);
    sales = readArray(KEYS.sales);
    stockHistory = readArray(KEYS.history);
}

function renderOverview() {
    $("medicineTypes").textContent = medicines.length;

    $("stockUnits").textContent = medicines.reduce(
        (sum, item) => sum + Math.max(0, Number(item.stock) || 0), 0
    );

    $("monthlySales").textContent = money(
        sales.filter(isThisMonth).reduce((sum, sale) => sum + saleTotal(sale), 0)
    );

    $("expiryAlerts").textContent = medicines.filter(item => {
        const info = expiryInfo(item);
        return info.status === "expired" || info.status === "near";
    }).length;
}

function makeRows() {
    const type = $("reportType").value;
    const start = $("startDate").value;
    const end = $("endDate").value;

    if (start && end && start > end) {
        alert("The From Date must not be later than the To Date.");
        return;
    }

    currentType = type;

    const withinDateRange = record => {
        if (!start && !end) return true;
        const date = dateOf(record);
        if (!date) return false;
        const day = localDate(date);
        return (!start || day >= start) && (!end || day <= end);
    };

    if (type === "sales") {
        $("reportTitle").textContent = "Sales Report";
        $("reportSubtitle").textContent = "Saved sales transactions within the selected date range.";
        currentColumns = [
            ["Date & Time", r => r.displayDate],
            ["Sale ID", r => r.id],
            ["Customer", r => r.customer],
            ["Items", r => r.itemsText],
            ["Total Amount", r => money(r.total), true],
            ["Payment Method", r => r.payment],
            ["Status", r => r.status]
        ];

        currentRows = sales.filter(withinDateRange).map(sale => ({
            date: sale.dateISO || sale.date || "",
            displayDate: dateOf(sale)?.toLocaleString() || "Unavailable",
            id: sale.id || "—",
            customer: sale.customer || "Not provided",
            itemsText: saleItems(sale).map(item =>
                `${item.medicineName || "Medicine"} (${Number(item.quantity) || 0})`
            ).join(", "),
            total: saleTotal(sale),
            payment: sale.paymentMethod || "—",
            status: sale.status || "Completed"
        }));
    }

    if (type === "medicines") {
        $("reportTitle").textContent = "Medicine Report";
        $("reportSubtitle").textContent = "Registered medicine details, prices and expiry dates.";
        currentColumns = [
            ["Medicine", r => r.name],
            ["Category", r => r.category],
            ["Manufacturer", r => r.manufacturer],
            ["Unit Price", r => money(r.price), true],
            ["Current Stock", r => r.stock],
            ["Batch Number", r => r.batch],
            ["Expiry Date", r => r.expiry]
        ];
        currentRows = medicines.map(m => ({
            name: m.name || "—",
            category: m.category || "—",
            manufacturer: m.manufacturer || "—",
            price: Number(m.price) || 0,
            stock: Number(m.stock) || 0,
            batch: m.batchNumber || "—",
            expiry: m.expiryDate || "Not entered"
        }));
    }

    if (type === "inventory") {
        $("reportTitle").textContent = "Inventory Report";
        $("reportSubtitle").textContent = "Current stock levels and inventory valuation based on recorded unit prices.";
        currentColumns = [
            ["Medicine", r => r.name],
            ["Category", r => r.category],
            ["Batch Number", r => r.batch],
            ["Current Stock", r => r.stock],
            ["Unit Price", r => money(r.price), true],
            ["Estimated Stock Value", r => money(r.value), true],
            ["Stock Status", r => r.status]
        ];
        currentRows = medicines.map(m => {
            const stock = Math.max(0, Number(m.stock) || 0);
            const limit = Number(m.lowStockLimit) || 10;
            return {
                name: m.name || "—",
                category: m.category || "—",
                batch: m.batchNumber || "—",
                stock,
                price: Number(m.price) || 0,
                value: stock * (Number(m.price) || 0),
                status: stock === 0 ? "Out of Stock" : stock <= limit ? "Low Stock" : "In Stock"
            };
        });
    }

    if (type === "expiry") {
        $("reportTitle").textContent = "Expiry Report";
        $("reportSubtitle").textContent = "Medicine expiry classification based on the current date.";
        currentColumns = [
            ["Medicine", r => r.name],
            ["Batch Number", r => r.batch],
            ["Manufacturer", r => r.manufacturer],
            ["Current Stock", r => r.stock],
            ["Expiry Date", r => r.expiry],
            ["Days Remaining", r => r.days],
            ["Status", r => r.status]
        ];
        currentRows = medicines.map(m => {
            const info = expiryInfo(m);
            return {
                name: m.name || "—",
                batch: m.batchNumber || "—",
                manufacturer: m.manufacturer || "—",
                stock: Number(m.stock) || 0,
                expiry: m.expiryDate || "Not entered",
                days: info.days === null ? "Unknown" : info.days,
                status: info.label
            };
        });
    }

    if (type === "stockHistory") {
        $("reportTitle").textContent = "Stock History Report";
        $("reportSubtitle").textContent = "Stock additions, adjustments and sale-related stock changes.";
        currentColumns = [
            ["Date & Time", r => r.displayDate],
            ["Medicine", r => r.name],
            ["Operation", r => r.operation],
            ["Previous Stock", r => r.previous],
            ["Stock Change", r => r.change],
            ["New Stock", r => r.newStock],
            ["Note", r => r.note]
        ];
        currentRows = stockHistory.filter(withinDateRange).map(h => ({
            date: h.dateISO || h.date || "",
            displayDate: dateOf(h)?.toLocaleString() || "Unavailable",
            name: h.name || "—",
            operation: h.operation || "—",
            previous: h.previousStock ?? "—",
            change: h.change ?? "—",
            newStock: h.newStock ?? "—",
            note: h.note || "—"
        }));
    }

    renderReportTable();
    renderMetrics();
}

function renderMetrics() {
    const box = $("reportMetrics");
    const totalRecords = currentRows.length;

    let firstLabel = "Records";
    let firstValue = totalRecords;
    let secondLabel = "Units / Items";
    let secondValue = 0;
    let thirdLabel = "Total Value";
    let thirdValue = "—";

    if (currentType === "sales") {
        firstLabel = "Transactions";
        secondLabel = "Units Sold";
        secondValue = currentRows.reduce((sum, r) =>
            sum + saleItems(sales.find(s => String(s.id || "") === String(r.id)) || {})
                .reduce((n, item) => n + (Number(item.quantity) || 0), 0), 0);
        thirdLabel = "Sales Total";
        thirdValue = money(currentRows.reduce((sum, r) => sum + r.total, 0));
    } else if (currentType === "medicines" || currentType === "inventory") {
        secondValue = currentRows.reduce((sum, r) => sum + (Number(r.stock) || 0), 0);
        secondLabel = "Total Stock Units";
        if (currentType === "inventory") {
            thirdValue = money(currentRows.reduce((sum, r) => sum + (r.value || 0), 0));
            thirdLabel = "Estimated Stock Value";
        } else {
            thirdLabel = "Distinct Categories";
            thirdValue = new Set(currentRows.map(r => r.category).filter(c => c !== "—")).size;
        }
    } else if (currentType === "expiry") {
        secondLabel = "Expired Medicines";
        secondValue = currentRows.filter(r => r.status === "Expired").length;
        thirdLabel = "Near Expiry";
        thirdValue = currentRows.filter(r => r.status === "Near Expiry").length;
    } else if (currentType === "stockHistory") {
        secondLabel = "Stock Added";
        secondValue = currentRows.reduce((sum, r) =>
            sum + Math.max(0, Number(r.change) || 0), 0);
        thirdLabel = "Stock Reduced";
        thirdValue = currentRows.reduce((sum, r) =>
            sum + Math.max(0, -(Number(r.change) || 0)), 0);
    }

    box.innerHTML = `
        <div class="metric-card"><span>${firstLabel}</span><strong>${firstValue}</strong></div>
        <div class="metric-card"><span>${secondLabel}</span><strong>${secondValue}</strong></div>
        <div class="metric-card"><span>${thirdLabel}</span><strong>${thirdValue}</strong></div>
    `;
}

function renderReportTable() {
    const query = $("tableSearch").value.trim().toLowerCase();
    const rows = currentRows.filter(row =>
        Object.values(row).join(" ").toLowerCase().includes(query)
    );

    $("reportHead").innerHTML = `<tr>${currentColumns.map(([title]) =>
        `<th>${escapeHTML(title)}</th>`
    ).join("")}</tr>`;

    $("reportBody").innerHTML = rows.map(row => `
        <tr>${currentColumns.map(([title, getter, isAmount]) => {
            const value = getter(row);
            return `<td class="${isAmount ? "amount" : ""}">${escapeHTML(value)}</td>`;
        }).join("")}</tr>
    `).join("");

    $("emptyState").style.display = rows.length ? "none" : "block";
    $("resultCount").textContent = `Showing ${rows.length} of ${currentRows.length} records`;
}

function exportCurrentReport() {
    const query = $("tableSearch").value.trim().toLowerCase();
    const rows = currentRows.filter(row =>
        Object.values(row).join(" ").toLowerCase().includes(query)
    );

    if (!currentColumns.length) {
        alert("Generate a report first.");
        return;
    }

    const output = [
        currentColumns.map(([title]) => title),
        ...rows.map(row => currentColumns.map(([, getter]) => {
            const value = getter(row);
            return typeof value === "string" ? value : String(value ?? "");
        }))
    ];

    const csv = output.map(row => row.map(value => {
        let text = String(value ?? "");
        if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
        return `"${text.replace(/"/g, '""')}"`;
    }).join(",")).join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pharmaguard-${currentType}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

$("generateReport").addEventListener("click", makeRows);
$("tableSearch").addEventListener("input", renderReportTable);
$("exportAll").addEventListener("click", exportCurrentReport);

$("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
});

document.addEventListener("click", event => {
    if (window.innerWidth <= 900 &&
        !$("sidebar").contains(event.target) &&
        !$("menuToggle").contains(event.target)) {
        $("sidebar").classList.remove("open");
    }
});

function refresh() {
    loadData();
    renderOverview();
    makeRows();
}

window.addEventListener("storage", event => {
    if (Object.values(KEYS).includes(event.key)) refresh();
});
window.addEventListener("pharmaMedicinesUpdated", refresh);

refresh();