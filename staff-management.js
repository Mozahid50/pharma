const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "pharmaStaff";

let staffList = [];

// ========================================
// STORAGE
// ========================================

function readStaff() {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Unable to read staff records:", error);
        return [];
    }
}

function saveStaff() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(staffList));

        // Notify other PharmaGuard pages.
        window.dispatchEvent(new CustomEvent("pharmaStaffUpdated"));

        return true;
    } catch (error) {
        alert("Unable to save staff records. Please check browser storage.");
        console.error(error);
        return false;
    }
}

function generateStaffId() {
    let id;

    do {
        id = "STF-" + Date.now().toString().slice(-8)
            + Math.floor(Math.random() * 90 + 10);
    } while (staffList.some(staff => staff.id === id));

    return id;
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function todayDate() {
    const date = new Date();

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

function normalizeStatus(status) {
    return String(status || "Active").toLowerCase() === "inactive"
        ? "Inactive"
        : "Active";
}

// ========================================
// STATISTICS
// ========================================

function renderStatistics() {
    const total = staffList.length;

    const active = staffList.filter(
        staff => normalizeStatus(staff.status) === "Active"
    ).length;

    const inactive = total - active;

    $("totalStaff").textContent = total;
    $("activeStaff").textContent = active;
    $("inactiveStaff").textContent = inactive;
}

// ========================================
// DISPLAY STAFF
// ========================================

function renderStaff() {
    const tbody = $("staffTableBody");
    const emptyState = $("emptyState");

    const query = $("staffSearch").value.trim().toLowerCase();
    const statusFilter = $("statusFilter").value;

    const filteredStaff = staffList.filter(staff => {
        const searchableText = [
            staff.id,
            staff.name,
            staff.phone,
            staff.email,
            staff.role,
            staff.joiningDate
        ].join(" ").toLowerCase();

        const matchesSearch = searchableText.includes(query);

        const matchesStatus =
            statusFilter === "all" ||
            normalizeStatus(staff.status) === statusFilter;

        return matchesSearch && matchesStatus;
    });

    tbody.innerHTML = filteredStaff.map(staff => {
        const status = normalizeStatus(staff.status);
        const isActive = status === "Active";

        return `
            <tr>
                <td>
                    <span class="staff-id">
                        ${escapeHTML(staff.id)}
                    </span>
                </td>

                <td>${escapeHTML(staff.name)}</td>
                <td>${escapeHTML(staff.phone)}</td>
                <td>${escapeHTML(staff.email)}</td>
                <td>${escapeHTML(staff.role)}</td>
                <td>${escapeHTML(staff.joiningDate)}</td>

                <td>
                    <span class="badge ${isActive ? "active" : "inactive"}">
                        <i class="fa-solid ${
                            isActive ? "fa-circle-check" : "fa-circle-pause"
                        }"></i>
                        ${status}
                    </span>
                </td>

                <td>
                    <div class="actions">
                        <button type="button"
                            class="action-btn edit"
                            data-action="edit"
                            data-id="${escapeHTML(staff.id)}"
                            title="Edit Staff"
                            aria-label="Edit ${escapeHTML(staff.name)}">
                            <i class="fa-solid fa-pen"></i>
                        </button>

                        <button type="button"
                            class="action-btn toggle"
                            data-action="toggle"
                            data-id="${escapeHTML(staff.id)}"
                            title="${isActive ? "Deactivate" : "Activate"} Staff"
                            aria-label="${isActive ? "Deactivate" : "Activate"} ${escapeHTML(staff.name)}">
                            <i class="fa-solid ${
                                isActive ? "fa-user-slash" : "fa-user-check"
                            }"></i>
                        </button>

                        <button type="button"
                            class="action-btn delete"
                            data-action="delete"
                            data-id="${escapeHTML(staff.id)}"
                            title="Delete Staff"
                            aria-label="Delete ${escapeHTML(staff.name)}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    emptyState.style.display = filteredStaff.length ? "none" : "block";

    if (filteredStaff.length === 0) {
        emptyState.querySelector("h3").textContent =
            staffList.length === 0
                ? "No Staff Records Found"
                : "No Matching Staff Found";

        emptyState.querySelector("p").textContent =
            staffList.length === 0
                ? "Add a staff member to get started."
                : "Try changing your search or status filter.";
    }

    $("resultCount").textContent =
        `Showing ${filteredStaff.length} of ${staffList.length} staff members`;

    renderStatistics();
}

// ========================================
// MODAL
// ========================================

function openModal(staff = null) {
    $("staffForm").reset();

    $("editStaffId").value = staff ? staff.id : "";

    $("modalTitle").textContent = staff
        ? "Edit Staff Details"
        : "Add New Staff";

    $("saveStaffBtn").innerHTML = staff
        ? '<i class="fa-solid fa-floppy-disk"></i> Update Staff'
        : '<i class="fa-solid fa-floppy-disk"></i> Save Staff';

    $("staffName").value = staff ? staff.name : "";
    $("staffPhone").value = staff ? staff.phone : "";
    $("staffEmail").value = staff ? staff.email : "";
    $("staffRole").value = staff ? staff.role : "";
    $("joiningDate").value = staff ? staff.joiningDate : todayDate();
    $("staffStatus").value = staff
        ? normalizeStatus(staff.status)
        : "Active";

    $("staffModal").classList.add("show");

    document.body.style.overflow = "hidden";

    $("staffName").focus();
}

function closeModal() {
    $("staffModal").classList.remove("show");
    document.body.style.overflow = "";
    $("staffForm").reset();
    $("editStaffId").value = "";
}

// ========================================
// ADD / EDIT STAFF
// ========================================

function handleStaffSubmit(event) {
    event.preventDefault();

    const editId = $("editStaffId").value;

    const name = $("staffName").value.trim();
    const phone = $("staffPhone").value.trim();
    const email = $("staffEmail").value.trim().toLowerCase();
    const role = $("staffRole").value;
    const joiningDate = $("joiningDate").value;
    const status = $("staffStatus").value;

    if (!name || !phone || !email || !role || !joiningDate) {
        alert("Please complete all required fields.");
        return;
    }

    if (joiningDate > todayDate()) {
        alert("Joining date cannot be in the future.");
        return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
        alert("Please enter a valid email address.");
        return;
    }

    const duplicateEmail = staffList.some(staff =>
        staff.email.toLowerCase() === email &&
        staff.id !== editId
    );

    if (duplicateEmail) {
        alert("This email address is already registered.");
        return;
    }

    const duplicatePhone = staffList.some(staff =>
        staff.phone.trim() === phone &&
        staff.id !== editId
    );

    if (duplicatePhone) {
        alert("This phone number is already registered.");
        return;
    }

    if (editId) {
        const index = staffList.findIndex(
            staff => staff.id === editId
        );

        if (index === -1) {
            alert("Staff record not found.");
            return;
        }

        staffList[index] = {
            ...staffList[index],
            name,
            phone,
            email,
            role,
            joiningDate,
            status
        };
    } else {
        staffList.push({
            id: generateStaffId(),
            name,
            phone,
            email,
            role,
            joiningDate,
            status,
            createdAt: new Date().toISOString()
        });
    }

    if (saveStaff()) {
        closeModal();
        renderStaff();
    }
}

// ========================================
// EDIT STAFF
// ========================================

function editStaff(id) {
    const staff = staffList.find(
        item => String(item.id) === String(id)
    );

    if (!staff) {
        alert("Staff record not found.");
        return;
    }

    openModal(staff);
}

// ========================================
// ACTIVE / INACTIVE
// ========================================

function toggleStaffStatus(id) {
    const staff = staffList.find(
        item => String(item.id) === String(id)
    );

    if (!staff) {
        alert("Staff record not found.");
        return;
    }

    const currentStatus = normalizeStatus(staff.status);
    const newStatus = currentStatus === "Active"
        ? "Inactive"
        : "Active";

    const confirmed = confirm(
        `Are you sure you want to change ${staff.name}'s status to ${newStatus}?`
    );

    if (!confirmed) return;

    staff.status = newStatus;

    if (saveStaff()) {
        renderStaff();
    }
}

// ========================================
// DELETE STAFF
// ========================================

function deleteStaff(id) {
    const staff = staffList.find(
        item => String(item.id) === String(id)
    );

    if (!staff) {
        alert("Staff record not found.");
        return;
    }

    const confirmed = confirm(
        `Delete staff member "${staff.name}" (${staff.id})?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    const previousList = staffList;

    staffList = staffList.filter(
        item => String(item.id) !== String(id)
    );

    if (saveStaff()) {
        renderStaff();
    } else {
        staffList = previousList;
        renderStaff();
    }
}

// ========================================
// TABLE ACTIONS
// ========================================

$("staffTableBody").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;

    if (action === "edit") {
        editStaff(id);
    } else if (action === "toggle") {
        toggleStaffStatus(id);
    } else if (action === "delete") {
        deleteStaff(id);
    }
});

// ========================================
// SEARCH AND FILTER
// ========================================

$("staffSearch").addEventListener("input", renderStaff);
$("statusFilter").addEventListener("change", renderStaff);

// ========================================
// MODAL EVENTS
// ========================================

$("addStaffBtn").addEventListener("click", () => {
    openModal();
});

$("closeModal").addEventListener("click", closeModal);
$("cancelBtn").addEventListener("click", closeModal);

$("staffForm").addEventListener("submit", handleStaffSubmit);

$("staffModal").addEventListener("click", event => {
    if (event.target === $("staffModal")) {
        closeModal();
    }
});

document.addEventListener("keydown", event => {
    if (
        event.key === "Escape" &&
        $("staffModal").classList.contains("show")
    ) {
        closeModal();
    }
});

// ========================================
// MOBILE SIDEBAR
// ========================================

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

// ========================================
// INITIAL LOAD AND SYNC
// ========================================

function refreshStaff() {
    staffList = readStaff();
    renderStaff();
}

window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY || event.key === null) {
        refreshStaff();
    }
});

window.addEventListener("pharmaStaffUpdated", refreshStaff);

refreshStaff();