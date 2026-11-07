document.addEventListener("DOMContentLoaded", function () {

    // ===============================
    // 1. DASHBOARD SUMMARY
    // ===============================

    const totalMedicinesElement =
        document.getElementById("totalMedicines");

    const totalStockElement =
        document.getElementById("totalStock");

    const lowStockElement =
        document.getElementById("lowStock");

    const expiryAlertsElement =
        document.getElementById("expiryAlerts");

    function loadDashboardSummary() {

        const medicines = JSON.parse(
            localStorage.getItem("pharmaMedicines") || "[]"
        );

        const totalMedicines = medicines.length;

        const totalStock = medicines.reduce(function (total, medicine) {
            return total + (Number(medicine.stock) || 0);
        }, 0);

        const lowStock = medicines.filter(function (medicine) {
            const stock = Number(medicine.stock) || 0;
            const threshold = Number(medicine.lowStockLimit ?? 10);

            return stock > 0 && stock <= threshold;
        }).length;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const alertLimit = new Date(today);
        alertLimit.setDate(alertLimit.getDate() + 30);

        const expiryAlerts = medicines.filter(function (medicine) {

            if (!medicine.expiryDate) {
                return false;
            }

            const expiryDate = new Date(medicine.expiryDate);

            if (Number.isNaN(expiryDate.getTime())) {
                return false;
            }

            expiryDate.setHours(0, 0, 0, 0);

            return expiryDate <= alertLimit;

        }).length;

        if (totalMedicinesElement) {
            totalMedicinesElement.textContent = totalMedicines;
        }

        if (totalStockElement) {
            totalStockElement.textContent = totalStock;
        }

        if (lowStockElement) {
            lowStockElement.textContent = lowStock;
        }

        if (expiryAlertsElement) {
            expiryAlertsElement.textContent = expiryAlerts;
        }
    }

    loadDashboardSummary();

    window.addEventListener("storage", function (event) {
        if (event.key === "pharmaMedicines") {
            loadDashboardSummary();
        }
    });

    window.addEventListener(
        "pharmaMedicinesUpdated",
        loadDashboardSummary
    );


    // ===============================
    // 2. MOBILE SIDEBAR
    // ===============================

    const sidebar = document.querySelector(".sidebar");
    const menuToggle = document.getElementById("menuToggle");

    if (sidebar && menuToggle) {

        menuToggle.addEventListener("click", function (event) {
            event.stopPropagation();
            sidebar.classList.toggle("open");
        });

        document.addEventListener("click", function (event) {

            if (
                window.innerWidth <= 768 &&
                !sidebar.contains(event.target) &&
                !menuToggle.contains(event.target)
            ) {
                sidebar.classList.remove("open");
            }

        });

        // Close mobile sidebar after selecting a menu link
        sidebar.querySelectorAll(".sidebar-menu a").forEach(function (link) {

            link.addEventListener("click", function () {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove("open");
                }
            });

        });

    }

});