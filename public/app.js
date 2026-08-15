// public/app.js

// ============ CONFIGURATION ============
const API_URL = 'http://localhost:3000/api';
let token = null;
let currentUser = null;

// ============ DOM REFERENCES ============
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

const loginScreen = $('loginScreen');
const dashboardScreen = $('dashboardScreen');
const loginForm = $('loginForm');
const loginEmail = $('loginEmail');
const loginPassword = $('loginPassword');
const loginError = $('loginError');
const logoutBtn = $('logoutBtn');
const userName = $('userName');
const userRole = $('userRole');
const welcomeUser = $('welcomeUser');

// ============ AUTHENTICATION ============

// Check if user is already logged in
const savedToken = localStorage.getItem('emr_token');
const savedUser = localStorage.getItem('emr_user');

if (savedToken && savedUser) {
    token = savedToken;
    currentUser = JSON.parse(savedUser);
    showDashboard();
} else {
    showLogin();
}

// Login handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: loginEmail.value,
                password: loginPassword.value
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        token = data.token;
        currentUser = data.staff;

        localStorage.setItem('emr_token', token);
        localStorage.setItem('emr_user', JSON.stringify(currentUser));

        showDashboard();
    } catch (error) {
        loginError.textContent = error.message;
        loginError.style.display = 'block';
    }
});

// Logout handler
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('emr_token');
    localStorage.removeItem('emr_user');
    token = null;
    currentUser = null;
    showLogin();
});

// Navigation tabs
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        const tab = link.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        $('tab-' + tab).classList.add('active');

        // Load data for the tab
        loadTabData(tab);
    });
});

function showLogin() {
    loginScreen.classList.add('active');
    dashboardScreen.classList.remove('active');
}

function showDashboard() {
    loginScreen.classList.remove('active');
    dashboardScreen.classList.add('active');
    userName.textContent = currentUser.firstName + ' ' + currentUser.lastName;
    userRole.textContent = currentUser.role;
    welcomeUser.textContent = currentUser.firstName + ' ' + currentUser.lastName;
    loadDashboard();
}

// ============ API HELPERS ============

async function apiFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'API request failed');
    }

    return data;
}

// ============ DASHBOARD ============

async function loadDashboard() {
    try {
        const stats = await apiFetch('/dashboard/stats');
        $('totalPatients').textContent = stats.totalPatients;
        $('totalStaff').textContent = stats.totalStaff;
        $('totalAppointments').textContent = stats.totalAppointments;
        $('pendingBills').textContent = stats.pendingBills;
        $('totalRevenue').textContent = '₦' + stats.totalRevenue.toLocaleString();
        $('lowStockCount').textContent = stats.lowStockCount;

        // Load recent patients
        const patients = await apiFetch('/patients');
        renderRecentPatients(patients);
    } catch (error) {
        console.error('Dashboard error:', error);
    }
}

function renderRecentPatients(patients) {
    const container = $('recentPatients');
    if (!patients || patients.length === 0) {
        container.innerHTML = '<p style="padding: 16px; color: #666;">No patients found.</p>';
        return;
    }

    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Hospital ID</th>
                <th>Name</th>
                <th>Gender</th>
                <th>Phone</th>
                <th>Created</th>
            </tr>
        </thead>
        <tbody>
            ${patients.slice(0, 5).map(p => `
                <tr>
                    <td><strong>${p.hospitalId}</strong></td>
                    <td>${p.firstName} ${p.lastName}</td>
                    <td>${p.gender}</td>
                    <td>${p.phone || '-'}</td>
                    <td>${new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
            `).join('')}
        </tbody>
    `;
    container.innerHTML = '';
    container.appendChild(table);
}

// ============ LOAD TAB DATA ============

async function loadTabData(tab) {
    try {
        switch (tab) {
            case 'patients':
                await loadPatients();
                break;
            case 'appointments':
                await loadAppointments();
                break;
            case 'prescriptions':
                await loadPrescriptions();
                break;
            case 'lab':
                await loadLabOrders();
                break;
            case 'billing':
                await loadBilling();
                break;
            case 'pharmacy':
                await loadMedications();
                break;
            case 'staff':
                await loadStaff();
                break;
        }
    } catch (error) {
        console.error(`Load ${tab} error:`, error);
    }
}

// ============ PATIENTS ============

async function loadPatients() {
    const patients = await apiFetch('/patients');
    const container = $('patientList');
    renderTable(container, patients, [
        { key: 'hospitalId', label: 'Hospital ID' },
        { key: 'firstName', label: 'First Name' },
        { key: 'lastName', label: 'Last Name' },
        { key: 'gender', label: 'Gender' },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email' }
    ]);
}

// ============ APPOINTMENTS ============

async function loadAppointments() {
    const appointments = await apiFetch('/appointments');
    const container = $('appointmentList');
    renderTable(container, appointments, [
        { key: 'id', label: 'ID' },
        { key: 'patient', label: 'Patient', render: (v) => v ? `${v.firstName} ${v.lastName}` : '-' },
        { key: 'staff', label: 'Doctor', render: (v) => v ? `${v.firstName} ${v.lastName}` : '-' },
        { key: 'dateTime', label: 'Date/Time', render: (v) => new Date(v).toLocaleString() },
        { key: 'status', label: 'Status', render: (v) => `<span class="status-badge status-${v.toLowerCase()}">${v}</span>` },
        { key: 'type', label: 'Type' }
    ]);
}

// ============ PRESCRIPTIONS ============

async function loadPrescriptions() {
    const prescriptions = await apiFetch('/prescriptions');
    const container = $('prescriptionList');
    renderTable(container, prescriptions, [
        { key: 'id', label: 'ID' },
        { key: 'patient', label: 'Patient', render: (v) => v ? `${v.firstName} ${v.lastName}` : '-' },
        { key: 'medication', label: 'Medication' },
        { key: 'dosage', label: 'Dosage' },
        { key: 'frequency', label: 'Frequency' },
        { key: 'status', label: 'Status', render: (v) => `<span class="status-badge status-${v.toLowerCase()}">${v}</span>` }
    ]);
}

// ============ LAB ORDERS ============

async function loadLabOrders() {
    const labOrders = await apiFetch('/lab-orders');
    const container = $('labOrderList');
    renderTable(container, labOrders, [
        { key: 'id', label: 'ID' },
        { key: 'patient', label: 'Patient', render: (v) => v ? `${v.firstName} ${v.lastName}` : '-' },
        { key: 'testName', label: 'Test Name' },
        { key: 'testType', label: 'Type' },
        { key: 'priority', label: 'Priority' },
        { key: 'status', label: 'Status', render: (v) => `<span class="status-badge status-${v.toLowerCase()}">${v}</span>` },
        { key: 'result', label: 'Result', render: (v) => v || '-' }
    ]);
}

// ============ BILLING ============

async function loadBilling() {
    const billing = await apiFetch('/billing');
    const container = $('billingList');
    renderTable(container, billing, [
        { key: 'invoiceNumber', label: 'Invoice' },
        { key: 'patient', label: 'Patient', render: (v) => v ? `${v.firstName} ${v.lastName}` : '-' },
        { key: 'description', label: 'Description' },
        { key: 'totalAmount', label: 'Amount', render: (v) => '₦' + v.toLocaleString() },
        { key: 'status', label: 'Status', render: (v) => `<span class="status-badge status-${v.toLowerCase()}">${v}</span>` },
        { key: 'paymentMethod', label: 'Payment Method', render: (v) => v || '-' }
    ]);
}

// ============ MEDICATIONS ============

async function loadMedications() {
    const medications = await apiFetch('/medications');
    const container = $('medicationList');
    renderTable(container, medications, [
        { key: 'name', label: 'Name' },
        { key: 'genericName', label: 'Generic' },
        { key: 'category', label: 'Category' },
        { key: 'stockQuantity', label: 'Stock' },
        { key: 'unitPrice', label: 'Unit Price', render: (v) => '₦' + v.toLocaleString() },
        { key: 'expiryDate', label: 'Expiry', render: (v) => new Date(v).toLocaleDateString() }
    ]);
}

// ============ STAFF ============

async function loadStaff() {
    const staff = await apiFetch('/staff');
    const container = $('staffList');
    renderTable(container, staff, [
        { key: 'employeeId', label: 'Employee ID' },
        { key: 'firstName', label: 'First Name' },
        { key: 'lastName', label: 'Last Name' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role' },
        { key: 'department', label: 'Department' },
        { key: 'isActive', label: 'Active', render: (v) => v ? '✅ Yes' : '❌ No' }
    ]);
}

// ============ TABLE RENDERER ============

function renderTable(container, data, columns) {
    if (!data || data.length === 0) {
        container.innerHTML = '<p style="padding: 16px; color: #666;">No records found.</p>';
        return;
    }

    const table = document.createElement('table');
    let headerHtml = '<thead><tr>';
    columns.forEach(col => {
        headerHtml += `<th>${col.label}</th>`;
    });
    headerHtml += '<th>Actions</th></tr></thead>';

    let bodyHtml = '<tbody>';
    data.forEach(item => {
        bodyHtml += '<tr>';
        columns.forEach(col => {
            let value = item[col.key];
            if (col.render) {
                value = col.render(value);
            } else if (value === null || value === undefined) {
                value = '-';
            }
            bodyHtml += `<td>${value}</td>`;
        });
        bodyHtml += `<td>
            <button class="btn btn-sm btn-secondary" onclick="viewRecord('${item.id}')">View</button>
            <button class="btn btn-sm btn-primary" onclick="editRecord('${item.id}')">Edit</button>
        </td>`;
        bodyHtml += '</tr>';
    });
    bodyHtml += '</tbody>';

    table.innerHTML = headerHtml + bodyHtml;
    container.innerHTML = '';
    container.appendChild(table);
}

// ============ SEARCH ============

$('searchPatientBtn')?.addEventListener('click', async () => {
    const query = $('patientSearch').value.trim();
    if (!query) {
        await loadPatients();
        return;
    }
    try {
        const patients = await apiFetch(`/patients/search/${encodeURIComponent(query)}`);
        const container = $('patientList');
        renderTable(container, patients, [
            { key: 'hospitalId', label: 'Hospital ID' },
            { key: 'firstName', label: 'First Name' },
            { key: 'lastName', label: 'Last Name' },
            { key: 'gender', label: 'Gender' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' }
        ]);
    } catch (error) {
        console.error('Search error:', error);
    }
});

$('patientSearch')?.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        $('searchPatientBtn').click();
    }
});

// ============ MODAL FUNCTIONS ============

// Placeholder for modal functions
window.viewRecord = (id) => {
    alert('View record: ' + id);
};

window.editRecord = (id) => {
    alert('Edit record: ' + id);
};

// Modal close handlers
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
        $('modal').style.display = 'none';
    });
});

window.addEventListener('click', (e) => {
    if (e.target === $('modal')) {
        $('modal').style.display = 'none';
    }
});

// ============ INIT ============

console.log('🏥 FMC EMR System loaded successfully!');