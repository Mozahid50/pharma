"use strict";

/* =========================================
   PHARMAGUARD PRO - HOME DASHBOARD
   Data source: localStorage
========================================= */

const MEDICINES_KEY = "pharmaMedicines";
const SALES_KEY = "pharmaSales";
const LOW_STOCK_DEFAULT = 10;
const NEAR_EXPIRY_DAYS = 30;

const dashboardNumber = new Intl.NumberFormat("en-BD");
const dashboardCurrency = new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

/* Safely read localStorage arrays */
function dashboardReadArray(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value : [];
    } catch (error) {
        console.error("Unable to read:", key, error);
        return [];
    }
}

function dashboardNumberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function dashboardSet(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

/* Medicine stock */
function dashboardStock(medicine) {
    return Math.max(0, dashboardNumberValue(medicine.stock));
}

function dashboardMinimumStock(medicine) {
    const limit = Number(medicine.lowStockLimit);

    return Number.isFinite(limit) && limit >= 0
        ? limit
        : LOW_STOCK_DEFAULT;
}

/* Expiry calculation */
function dashboardExpiry(medicine) {
    const value = String(medicine.expiryDate || "");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return "unknown";
    }

    const expiryDate = new Date(value + "T00:00:00");

    if (
        Number.isNaN(expiryDate.getTime()) ||
        expiryDate.getFullYear() !== Number(value.slice(0, 4)) ||
        expiryDate.getMonth() + 1 !== Number(value.slice(5, 7)) ||
        expiryDate.getDate() !== Number(value.slice(8, 10))
    ) {
        return "unknown";
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = Math.round(
        (expiryDate.getTime() - today.getTime()) / 86400000
    );

    if (days < 0) return "expired";
    if (days <= NEAR_EXPIRY_DAYS) return "near";

    return "safe";
}

/* Sales helpers */
function dashboardSaleItems(sale) {
    return Array.isArray(sale.items) ? sale.items : [];
}

function dashboardSaleTotal(sale) {
    const recordedTotal = Number(sale.total);

    if (Number.isFinite(recordedTotal) && recordedTotal >= 0) {
        return recordedTotal;
    }

    return dashboardSaleItems(sale).reduce((sum, item) => {
        const itemTotal = Number(item.total);

        if (Number.isFinite(itemTotal) && itemTotal >= 0) {
            return sum + itemTotal;
        }

        return sum +
            dashboardNumberValue(item.unitPrice) *
            Math.max(0, dashboardNumberValue(item.quantity));
    }, 0);
}

function dashboardSaleUnits(sale) {
    const items = dashboardSaleItems(sale);

    if (items.length > 0) {
        return items.reduce((sum, item) => {
            return sum + Math.max(
                0,
                dashboardNumberValue(item.quantity)
            );
        }, 0);
    }

    // Support older records that store quantity directly on the sale.
    return Math.max(0, dashboardNumberValue(sale.quantity));
}

/* Main dashboard update */
function updatePharmacyDashboard() {
    const medicines = dashboardReadArray(MEDICINES_KEY);
    const sales = dashboardReadArray(SALES_KEY);

    let totalStock = 0;
    let lowStock = 0;
    let outOfStock = 0;

    let expired = 0;
    let nearExpiry = 0;
    let safe = 0;
    let expiredUnits = 0;

    // Unique medicine records needing attention.
    const alertMedicineIds = new Set();

    medicines.forEach((medicine, index) => {
        const stock = dashboardStock(medicine);
        const minimum = dashboardMinimumStock(medicine);
        const expiryStatus = dashboardExpiry(medicine);

        totalStock += stock;

        const isOutOfStock = stock === 0;
        const isLowStock = stock > 0 && stock <= minimum;

        if (isOutOfStock) {
            outOfStock++;
        } else if (isLowStock) {
            lowStock++;
        }

        if (expiryStatus === "expired") {
            expired++;
            expiredUnits += stock;
        } else if (expiryStatus === "near") {
            nearExpiry++;
        } else if (expiryStatus === "safe") {
            safe++;
        }

        if (
            isOutOfStock ||
            isLowStock ||
            expiryStatus === "expired" ||
            expiryStatus === "near"
        ) {
            // Prefer the saved ID; use array position only as fallback.
            alertMedicineIds.add(
                medicine.id !== undefined && medicine.id !== null
                    ? String(medicine.id)
                    : "medicine-index-" + index
            );
        }
    });

    const totalSales = sales.reduce((sum, sale) => {
        return sum + dashboardSaleTotal(sale);
    }, 0);

    const totalTransactions = sales.length;

    const unitsSold = sales.reduce((sum, sale) => {
        return sum + dashboardSaleUnits(sale);
    }, 0);

    const averageSale = totalTransactions > 0
        ? totalSales / totalTransactions
        : 0;

    /* Inventory */
    dashboardSet("dashTotalMedicines", dashboardNumber.format(medicines.length));
    dashboardSet("dashTotalStock", dashboardNumber.format(totalStock));
    dashboardSet("dashLowStock", dashboardNumber.format(lowStock));
    dashboardSet("dashOutOfStock", dashboardNumber.format(outOfStock));

    /* Sales */
    dashboardSet("dashTotalSales", dashboardCurrency.format(totalSales));
    dashboardSet("dashTransactions", dashboardNumber.format(totalTransactions));
    dashboardSet("dashUnitsSold", dashboardNumber.format(unitsSold));
    dashboardSet("dashAverageSale", dashboardCurrency.format(averageSale));

    /* Smart alerts and expiry */
    dashboardSet("dashSmartAlerts", dashboardNumber.format(alertMedicineIds.size));
    dashboardSet("dashExpired", dashboardNumber.format(expired));
    dashboardSet("dashNearExpiry", dashboardNumber.format(nearExpiry));
    dashboardSet("dashSafe", dashboardNumber.format(safe));
    dashboardSet("dashExpiredUnits", dashboardNumber.format(expiredUnits));

    dashboardSet(
        "dashboardUpdated",
        "Last updated: " + new Date().toLocaleString()
    );
}

/* First load */
updatePharmacyDashboard();

/* Refresh when returning to the page or when another tab changes storage */
window.addEventListener("focus", updatePharmacyDashboard);
window.addEventListener("storage", updatePharmacyDashboard);

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        updatePharmacyDashboard();
    }
});

/* Support same-tab updates if another script dispatches these events */
window.addEventListener("pharmaMedicinesUpdated", updatePharmacyDashboard);
window.addEventListener("pharmaSalesUpdated", updatePharmacyDashboard);