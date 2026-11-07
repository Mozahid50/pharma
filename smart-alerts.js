const MEDICINES_KEY = "pharmaMedicines";
const LOW_STOCK_DEFAULT = 10;

const $ = id => document.getElementById(id);

let medicines = [];
let activeAlert = null;
let alertSearch = "";
let alertViewActive = false;
let previousSectionDisplays = new Map();

/* =========================
   STORAGE
========================= */

function readMedicines() {
    try {
        const data = JSON.parse(
            localStorage.getItem(MEDICINES_KEY) || "[]"
        );

        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Unable to read medicines:", error);
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

/* =========================
   STOCK HELPERS
========================= */

function getStock(medicine) {
    const stock = Number(medicine.stock);

    return Number.isFinite(stock) && stock > 0 ? stock : 0;
}

function getMinimumStock(medicine) {
    const fields = [
        "minStock",
        "minimumStock",
        "reorderLevel",
        "lowStockLimit"
    ];

    for (const field of fields) {
        const value = medicine[field];

        if (
            value !== undefined &&
            value !== null &&
            value !== "" &&
            Number.isFinite(Number(value)) &&
            Number(value) >= 0
        ) {
            return Number(value);
        }
    }

    return LOW_STOCK_DEFAULT;
}

function getStockStatus(medicine) {
    const stock = getStock(medicine);
    const minimum = getMinimumStock(medicine);

    if (stock === 0) return "out";
    if (stock <= minimum) return "low";

    return "available";
}

/* =========================
   EXPIRY HELPERS
========================= */

function getTodayDate() {
    const now = new Date();

    return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );
}

function getExpiryInfo(medicine) {
    const value = String(medicine.expiryDate ?? "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return {
            status: "unknown",
            days: null,
            label: "No Expiry Date"
        };
    }

    const [year, month, day] = value.split("-").map(Number);
    const expiry = new Date(year, month - 1, day);

    if (
        expiry.getFullYear() !== year ||
        expiry.getMonth() !== month - 1 ||
        expiry.getDate() !== day
    ) {
        return {
            status: "unknown",
            days: null,
            label: "Invalid Date"
        };
    }

    const days = Math.round(
        (expiry.getTime() - getTodayDate().getTime()) / 86400000
    );

    if (days < 0) {
        return { status: "expired", days, label: "Expired" };
    }

    if (days <= 30) {
        return { status: "near", days, label: "Near Expiry" };
    }

    return { status: "safe", days, label: "Safe" };
}

function formatDate(value) {
    if (!value) return "Not entered";

    const info = getExpiryInfo({ expiryDate: value });

    if (info.status === "unknown") return value;

    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day).toLocaleDateString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}

/* =========================
   ALERT CATEGORIES
========================= */

function getAlertMedicines(type) {
    return medicines.filter(medicine => {
        if (type === "low") {
            return getStockStatus(medicine) === "low";
        }

        if (type === "out") {
            return getStockStatus(medicine) === "out";
        }

        if (type === "near") {
            return getExpiryInfo(medicine).status === "near";
        }

        if (type === "expired") {
            return getExpiryInfo(medicine).status === "expired";
        }

        return false;
    });
}

const ALERT_INFO = {
    expired: {
        title: "Expired Medicines",
        description: "Medicines whose expiry dates have passed.",
        icon: "fa-triangle-exclamation",
        color: "#dc3545"
    },
    near: {
        title: "Near Expiry Medicines",
        description: "Medicines expiring within the next 30 days.",
        icon: "fa-clock",
        color: "#d88900"
    },
    low: {
        title: "Low Stock Medicines",
        description: "Medicines at or below their minimum stock level.",
        icon: "fa-arrow-trend-down",
        color: "#c47a00"
    },
    out: {
        title: "Out of Stock Medicines",
        description: "Medicines with zero available stock.",
        icon: "fa-box-open",
        color: "#dc3545"
    }
};

/* =========================
   SUMMARY COUNTS
========================= */

function updateSummary() {
    const counts = {
        expiredCount: getAlertMedicines("expired").length,
        nearCount: getAlertMedicines("near").length,

        safeCount: medicines.filter(
            medicine => getExpiryInfo(medicine).status === "safe"
        ).length,

        expiredUnits: getAlertMedicines("expired").reduce(
            (sum, medicine) => sum + getStock(medicine),
            0
        ),

        lowStockCount: getAlertMedicines("low").length,
        outOfStockCount: getAlertMedicines("out").length
    };

    Object.entries(counts).forEach(([id, value]) => {
        const element = $(id);

        if (element) {
            element.textContent = value;
        }
    });
}

/* =========================
   STOCK ALERT TABLE
========================= */

function renderStockAlerts() {
    const tbody = $("stockAlertTableBody");

    if (!tbody) return;

    const warnings = medicines.filter(medicine => {
        const status = getStockStatus(medicine);

        return status === "low" || status === "out";
    });

    if (!warnings.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4">No stock alerts found.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = warnings.map(medicine => {
        const status = getStockStatus(medicine);

        const label = status === "out"
            ? "Out of Stock"
            : "Low Stock";

        const className = status === "out"
            ? "status-out"
            : "status-low";

        return `
            <tr>
                <td>${escapeHTML(medicine.name || "Unnamed medicine")}</td>
                <td>${getStock(medicine)}</td>
                <td>${getMinimumStock(medicine)}</td>
                <td>
                    <span class="status-badge ${className}">
                        ${label}
                    </span>
                </td>
            </tr>
        `;
    }).join("");
}

/* =========================
   CREATE DETAILS PANEL
========================= */

function createAlertResultsPanel() {
    if ($("alertResultsPanel")) return;

    const panel = document.createElement("section");

    panel.id = "alertResultsPanel";
    panel.className = "panel";
    panel.style.display = "none";

    panel.innerHTML = `
        <div class="panel-header">
            <div>
                <h2 id="alertResultsTitle">Alert Medicines</h2>
                <p id="alertResultsDescription"></p>
            </div>

            <button type="button" class="outline-btn" id="backToAlerts">
                <i class="fa-solid fa-arrow-left"></i>
                Back to Alerts
            </button>
        </div>

        <div class="filters alert-results-filters">
            <input
                type="search"
                id="alertResultsSearch"
                placeholder="Search medicine, batch or manufacturer..."
                aria-label="Search alert medicines"
            >
        </div>

        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Medicine Name</th>
                        <th>Batch Number</th>
                        <th>Manufacturer</th>
                        <th>Current Stock</th>
                        <th>Minimum Stock</th>
                        <th>Expiry Date</th>
                        <th>Status</th>
                    </tr>
                </thead>

                <tbody id="alertResultsBody"></tbody>
            </table>
        </div>

        <div class="table-footer" id="alertResultsCount">
            Showing 0 medicines
        </div>
    `;

    const stockPanel = $("stockAlertsPanel");
    const expiryPanel = $("expiryTableBody")?.closest(".panel");

    if (stockPanel && expiryPanel) {
        expiryPanel.parentElement.insertBefore(panel, expiryPanel);
    } else if (stockPanel) {
        stockPanel.after(panel);
    } else {
        document.querySelector("main")?.appendChild(panel);
    }

    $("backToAlerts").addEventListener("click", closeAlertResults);

    $("alertResultsSearch").addEventListener("input", event => {
        alertSearch = event.target.value.toLowerCase().trim();
        renderAlertResults();
    });

    addAlertPanelStyles();
}

/* =========================
   DETAILS PANEL CSS
========================= */

function addAlertPanelStyles() {
    if ($("alertPanelStyles")) return;

    const style = document.createElement("style");
    style.id = "alertPanelStyles";

    style.textContent = `
        .alert-clickable {
            cursor: pointer;
            position: relative;
            transition: transform .2s, box-shadow .2s;
        }

        .alert-clickable:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 22px rgba(8, 70, 90, .12);
        }

        .alert-clickable:focus-visible {
            outline: 3px solid #087f8c;
            outline-offset: 3px;
        }

        #alertResultsPanel {
            display: none;
            scroll-margin-top: 20px;
        }

        #alertResultsPanel .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 15px;
            flex-wrap: wrap;
        }

        #alertResultsPanel .panel-header h2 {
            margin-bottom: 6px;
        }

        #alertResultsPanel .panel-header p {
            margin-top: 0;
        }

        #alertResultsPanel table {
            min-width: 850px;
        }

        #alertResultsPanel .alert-results-filters {
            grid-template-columns: 1fr;
        }

        #alertResultsPanel .status-badge {
            white-space: nowrap;
        }
    `;

    document.head.appendChild(style);
}

/* =========================
   SHOW ONLY SELECTED ALERT
========================= */

function getAlertSectionsToHide() {
    const sections = new Set();

    document.querySelectorAll(".stats-grid").forEach(section => {
        sections.add(section);
    });

    const stockPanel = $("stockAlertsPanel");
    const expiryPanel = $("expiryTableBody")?.closest(".panel");

    if (stockPanel) {
        sections.add(stockPanel);
    }

    if (expiryPanel) {
        sections.add(expiryPanel);
    }

    sections.delete($("alertResultsPanel"));

    return [...sections].filter(Boolean);
}

function showOnlyAlertResults() {
    if (!alertViewActive) {
        previousSectionDisplays.clear();

        getAlertSectionsToHide().forEach(section => {
            previousSectionDisplays.set(
                section,
                section.style.display
            );
        });
    }

    alertViewActive = true;

    getAlertSectionsToHide().forEach(section => {
        section.style.display = "none";
    });

    const panel = $("alertResultsPanel");

    if (panel) {
        panel.style.display = "block";
    }
}

function restoreAlertSections() {
    previousSectionDisplays.forEach((displayValue, section) => {
        if (section && section.isConnected) {
            section.style.display = displayValue;
        }
    });

    previousSectionDisplays.clear();
    alertViewActive = false;
}

/* =========================
   OPEN SELECTED ALERT
========================= */

function openAlertResults(type) {
    const info = ALERT_INFO[type];

    if (!info) return;

    activeAlert = type;
    alertSearch = "";

    createAlertResultsPanel();
    showOnlyAlertResults();

    $("alertResultsTitle").innerHTML = `
        <i class="fa-solid ${info.icon}"
           style="color:${info.color}"></i>
        ${info.title}
    `;

    $("alertResultsDescription").textContent = info.description;
    $("alertResultsSearch").value = "";

    renderAlertResults();

    $("alertResultsPanel").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

/* =========================
   RENDER SELECTED MEDICINES
========================= */

function renderAlertResults() {
    const tbody = $("alertResultsBody");

    if (!tbody || !activeAlert) return;

    const allAlertMedicines = getAlertMedicines(activeAlert);

    const list = allAlertMedicines.filter(medicine => {
        const searchable = [
            medicine.name,
            medicine.batchNumber,
            medicine.manufacturer,
            medicine.category
        ].join(" ").toLowerCase();

        return searchable.includes(alertSearch);
    });

    if (!list.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">No medicines found.</td>
            </tr>
        `;
    } else {
        tbody.innerHTML = list.map(medicine => {
            const stockStatus = getStockStatus(medicine);

            let status;
            let statusClass;

            if (activeAlert === "expired") {
                status = "Expired";
                statusClass = "status-expired";
            } else if (activeAlert === "near") {
                status = "Near Expiry";
                statusClass = "status-near";
            } else if (stockStatus === "out") {
                status = "Out of Stock";
                statusClass = "status-out";
            } else {
                status = "Low Stock";
                statusClass = "status-low";
            }

            return `
                <tr>
                    <td>${escapeHTML(medicine.name || "Unnamed medicine")}</td>
                    <td>${escapeHTML(medicine.batchNumber || "—")}</td>
                    <td>${escapeHTML(medicine.manufacturer || "—")}</td>
                    <td>${getStock(medicine)}</td>
                    <td>${getMinimumStock(medicine)}</td>
                    <td>${escapeHTML(formatDate(medicine.expiryDate))}</td>
                    <td>
                        <span class="status-badge ${statusClass}">
                            ${status}
                        </span>
                    </td>
                </tr>
            `;
        }).join("");
    }

    const counter = $("alertResultsCount");

    if (counter) {
        counter.textContent =
            `Showing ${list.length} of ${allAlertMedicines.length} medicines`;
    }
}

/* =========================
   CLOSE DETAILS / BACK
========================= */

function closeAlertResults() {
    activeAlert = null;
    alertSearch = "";

    const panel = $("alertResultsPanel");

    if (panel) {
        panel.style.display = "none";
    }

    restoreAlertSections();

    $("stockAlertsPanel")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

/* =========================
   DETECT ALERT TYPE FROM CARD
========================= */

function getAlertTypeFromCard(card) {
    if (!card) return null;

    const label = card.querySelector("p")?.textContent
        .trim()
        .toLowerCase();

    if (label === "expired medicines") return "expired";
    if (label === "near expiry") return "near";
    if (label === "low stock") return "low";
    if (label === "out of stock") return "out";

    return null;
}

/* =========================
   MAKE ALERT CARDS CLICKABLE
========================= */

function setupAlertCards() {
    document.querySelectorAll(".stat-card").forEach(card => {
        const type = getAlertTypeFromCard(card);

        if (!type) return;

        card.classList.add("alert-clickable");
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        card.setAttribute(
            "aria-label",
            `View ${ALERT_INFO[type].title}`
        );

        if (card.dataset.alertBound === "true") return;

        card.dataset.alertBound = "true";

        card.addEventListener("click", event => {
            // Allow real buttons and links to handle their own click.
            if (event.target.closest("a, button")) return;

            openAlertResults(type);
        });

        card.addEventListener("keydown", event => {
            if (
                event.target !== card ||
                (event.key !== "Enter" && event.key !== " ")
            ) {
                return;
            }

            event.preventDefault();
            openAlertResults(type);
        });
    });
}

/* =========================
   VIEW DETAILS LINK FIX
   Prevent accidental dashboard navigation
========================= */

document.addEventListener("click", event => {
    const control = event.target.closest("a, button");

    if (!control) return;

    const label = control.textContent.trim().toLowerCase();

    const isViewDetails =
        label.includes("view details") ||
        control.classList.contains("alert-view-btn");

    if (!isViewDetails) return;

    const card = control.closest(".stat-card");
    const type = getAlertTypeFromCard(card);

    if (!type) return;

    event.preventDefault();
    event.stopPropagation();

    openAlertResults(type);
}, true);

/* =========================
   EXPIRY TABLE
========================= */

function renderTable() {
    const tbody = $("expiryTableBody");

    if (!tbody) return;

    const query = $("expirySearch")?.value
        .trim()
        .toLowerCase() || "";

    const statusFilter = $("statusFilter")?.value || "all";
    const sort = $("sortFilter")?.value || "soonest";

    let filtered = medicines.map(medicine => ({
        medicine,
        expiry: getExpiryInfo(medicine)
    }));

    filtered = filtered.filter(({ medicine, expiry }) => {
        const searchable = [
            medicine.name,
            medicine.batchNumber,
            medicine.manufacturer,
            medicine.category
        ].join(" ").toLowerCase();

        return searchable.includes(query) &&
            (statusFilter === "all" || expiry.status === statusFilter);
    });

    filtered.sort((a, b) => {
        if (sort === "name") {
            return String(a.medicine.name || "").localeCompare(
                String(b.medicine.name || "")
            );
        }

        if (sort === "stock") {
            return getStock(b.medicine) - getStock(a.medicine);
        }

        if (a.expiry.days === null) return 1;
        if (b.expiry.days === null) return -1;

        return sort === "latest"
            ? b.expiry.days - a.expiry.days
            : a.expiry.days - b.expiry.days;
    });

    tbody.innerHTML = "";

    const empty = $("emptyState");

    if (empty) {
        empty.style.display = filtered.length ? "none" : "block";

        empty.textContent = medicines.length
            ? "No medicines match your search or filter."
            : "No medicines added yet.";
    }

    const resultCount = $("resultCount");

    if (resultCount) {
        resultCount.textContent =
            `Showing ${filtered.length} of ${medicines.length} medicines`;
    }

    filtered.forEach(({ medicine, expiry }) => {
        let daysText = "Not available";

        if (expiry.days !== null) {
            if (expiry.days < 0) {
                daysText = `${Math.abs(expiry.days)} day(s) overdue`;
            } else if (expiry.days === 0) {
                daysText = "Expires today";
            } else {
                daysText = `${expiry.days} day(s)`;
            }
        }

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>
                <div class="medicine-name">
                    ${escapeHTML(medicine.name || "Unnamed medicine")}
                </div>
                <div class="subtext">
                    ${escapeHTML(medicine.category || "Uncategorized")}
                </div>
            </td>
            <td>${escapeHTML(medicine.batchNumber || "—")}</td>
            <td>${escapeHTML(medicine.manufacturer || "—")}</td>
            <td>${getStock(medicine)}</td>
            <td>${escapeHTML(formatDate(medicine.expiryDate))}</td>
            <td>${escapeHTML(daysText)}</td>
            <td>
                <span class="status-badge status-${expiry.status}">
                    ${escapeHTML(expiry.label)}
                </span>
            </td>
        `;

        tbody.appendChild(row);
    });
}

/* =========================
   CSV EXPORT
========================= */

function exportCSV() {
    const query = $("expirySearch")?.value
        .trim()
        .toLowerCase() || "";

    const statusFilter = $("statusFilter")?.value || "all";

    const rows = [[
        "Medicine",
        "Category",
        "Batch Number",
        "Manufacturer",
        "Stock",
        "Expiry Date",
        "Days Remaining",
        "Status"
    ]];

    medicines.forEach(medicine => {
        const expiry = getExpiryInfo(medicine);

        const searchable = [
            medicine.name,
            medicine.batchNumber,
            medicine.manufacturer,
            medicine.category
        ].join(" ").toLowerCase();

        if (!searchable.includes(query)) return;

        if (
            statusFilter !== "all" &&
            expiry.status !== statusFilter
        ) {
            return;
        }

        rows.push([
            medicine.name || "",
            medicine.category || "",
            medicine.batchNumber || "",
            medicine.manufacturer || "",
            getStock(medicine),
            medicine.expiryDate || "",
            expiry.days ?? "",
            expiry.label
        ]);
    });

    const csv = rows.map(row =>
        row.map(value => {
            let text = String(value ?? "");

            if (/^[\s]*[=+\-@]/.test(text)) {
                text = "'" + text;
            }

            return `"${text.replace(/"/g, '""')}"`;
        }).join(",")
    ).join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "pharmaguard-smart-alerts-expiry-report.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* =========================
   REFRESH
========================= */

function refresh() {
    medicines = readMedicines();

    updateSummary();
    renderStockAlerts();
    renderTable();
    setupAlertCards();

    if (activeAlert) {
        renderAlertResults();
    }
}

/* =========================
   EVENT LISTENERS
========================= */

$("expirySearch")?.addEventListener("input", renderTable);
$("statusFilter")?.addEventListener("change", renderTable);
$("sortFilter")?.addEventListener("change", renderTable);
$("downloadExpiry")?.addEventListener("click", exportCSV);

$("menuToggle")?.addEventListener("click", () => {
    $("sidebar")?.classList.toggle("open");
});

document.addEventListener("click", event => {
    const sidebar = $("sidebar");
    const toggle = $("menuToggle");

    if (
        window.innerWidth <= 900 &&
        sidebar &&
        toggle &&
        !sidebar.contains(event.target) &&
        !toggle.contains(event.target)
    ) {
        sidebar.classList.remove("open");
    }
});

window.addEventListener("storage", event => {
    if (event.key === MEDICINES_KEY || event.key === null) {
        refresh();
    }
});

window.addEventListener("pharmaMedicinesUpdated", refresh);
window.addEventListener("focus", refresh);

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
});

/* =========================
   INITIAL LOAD
========================= */

function initializeSmartAlerts() {
    refresh();

    const params = new URLSearchParams(window.location.search);
    const alertType = params.get("alert");

    if (Object.prototype.hasOwnProperty.call(ALERT_INFO, alertType)) {
        openAlertResults(alertType);
    }
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeSmartAlerts,
        { once: true }
    );
} else {
    initializeSmartAlerts();
}