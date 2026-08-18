// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import { useSearch } from '../components/Layout';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Tooltip, Legend, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
  const { token, user } = useAuth();
  const { searchTerm } = useSearch();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [patientsError, setPatientsError] = useState(false);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  useEffect(() => {
    if (user && token) fetchDashboardData();
  }, [user, token]);

  const fetchDashboardData = async () => {
    try {
      const statsRes = await axios.get('http://localhost:3000/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(statsRes.data);
      setPatientsError(false);
    } catch (error) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="spinner" />;

  const renderStatCards = () => {
    const role = user?.role;
    if (!stats) return [];

    // Global Hospital Dashboard
    if (['Admin', 'Records', 'ITAdmin'].includes(role)) {
      return [
        { icon: '👤', label: 'Total Patients', value: stats.totalPatients || 0 },
        { icon: '👨‍⚕️', label: 'Total Staff', value: stats.totalStaff || 0 },
        { icon: '📅', label: 'Scheduled Appts', value: stats.totalAppointments || 0 },
        { icon: '💰', label: 'Total Revenue', value: `₦${(stats.totalRevenue || 0).toLocaleString()}` },
        { icon: '💊', label: 'Low Stock Items', value: stats.lowStockCount || 0 },
        { icon: '📋', label: 'Pending Bills', value: stats.pendingBills || 0 },
      ];
    }

    // Clinical Dashboard (Doctor, Nurse, Obstetrician, Midwife)
    if (['Doctor', 'Nurse', 'Obstetrician', 'Midwife'].includes(role)) {
      return [
        { icon: '👤', label: 'My Patients', value: stats.myPatientsCount || 0 },
        { icon: '📅', label: 'My Appointments', value: stats.myAppointmentsCount || 0 },
        { icon: '❤️', label: 'Vitals Recorded', value: stats.myVitalsCount || 0 },
      ];
    }

    // Pharmacy Dashboard
    if (role === 'Pharmacist') {
      return [
        { icon: '💊', label: 'Total Medications', value: stats.totalMedications || 0 },
        { icon: '⚠️', label: 'Low Stock Alerts', value: stats.lowStockCount || 0 },
        { icon: '📤', label: 'Dispensed (7d)', value: stats.recentDispensedCount || 0 },
      ];
    }

    // Billing Officer & Accountant Dashboard (Finance)
    if (['Accountant', 'BillingOfficer'].includes(role)) {
      return [
        { icon: '📋', label: 'Pending Bills', value: stats.pendingBills || 0 },
        { icon: '💰', label: 'Total Revenue', value: `₦${(stats.totalRevenue || 0).toLocaleString()}` },
        { icon: '✅', label: 'Paid Invoices', value: stats.paidBillsCount || 0 },
      ];
    }

    // Lab Technician Dashboard
    if (role === 'LabTechnician') {
      return [
        { icon: '🔬', label: 'Pending Tests', value: stats.pendingLabOrders || 0 },
        { icon: '✅', label: 'Completed Tests', value: stats.completedLabOrders || 0 },
      ];
    }

    return [];
  };

  const statCards = renderStatCards();

  const genderChartData = stats?.genderData?.map(g => ({ name: g.gender, value: g._count })) || [];
  const monthlyChartData = stats?.monthlyRegistrations?.map(m => ({ month: m.month, Registrations: Number(m.count) })) || [];
  const showPatientCharts = ['Admin', 'Records', 'ITAdmin', 'Doctor', 'Nurse', 'Obstetrician', 'Midwife'].includes(user?.role);

  const revenueChartData = stats?.revenueTrend?.map(m => ({ month: m.month, Revenue: m.revenue })) || [];
  const showRevenueChart = ['Accountant', 'BillingOfficer'].includes(user?.role);

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Welcome back, {user?.firstName} {user?.lastName}!</p>
      </div>

      {statCards.length > 0 ? (
        <div className="stats-grid">
          {statCards.map((stat, index) => (
            <div key={index} className="stat-card">
              <div className="stat-icon">{stat.icon}</div>
              <div className="stat-info">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>No stats available for this role.</p>
      )}

      {/* --- Quick Action Button for Clinical Roles --- */}
      {['Doctor', 'Nurse', 'Obstetrician', 'Midwife'].includes(user?.role) && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link 
            to={['Doctor', 'Obstetrician'].includes(user?.role) ? '/doctor-dashboard' : '/nurse-dashboard'} 
            className="btn btn-primary"
          >
            👨‍⚕️ View My Full Patient List
          </Link>
        </div>
      )}

      {/* --- CHARTS SECTION --- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginTop: '20px' }}>

        {showPatientCharts && (
          <>
            <div className="section" style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h3>Patient Gender Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={genderChartData} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label>
                    {genderChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="section" style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h3>Patient Registrations (Last 6 Months)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Registrations" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {showRevenueChart && revenueChartData.length > 0 && (
          <div className="section" style={{ gridColumn: '1 / -1', background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3>Revenue Trend (Last 6 Months)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `₦${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="Revenue" fill="#00d4ff" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
export default Dashboard;