// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import { useSearch } from '../components/Layout';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Tooltip, Legend, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

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
      // If HR role, fetch HR dashboard stats
      if (user?.role === 'HR') {
        const hrRes = await axios.get('http://localhost:3000/api/hr/dashboard', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStats(hrRes.data.statistics);
        setPatientsError(false);
        setLoading(false);
        return;
      }

      // If Radiologist, fetch imaging stats specifically
      if (user?.role === 'Radiologist') {
        const [imagingRes, statsRes] = await Promise.all([
          axios.get('http://localhost:3000/api/imaging-orders', {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get('http://localhost:3000/api/dashboard/stats', {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        
        const orders = imagingRes.data || [];
        setStats({
          ...statsRes.data,
          totalImagingOrders: orders.length,
          pendingImagingOrders: orders.filter(o => o.status === 'Ordered' || o.status === 'Scheduled').length,
          completedImagingOrders: orders.filter(o => o.status === 'Completed').length
        });
      } else {
        const statsRes = await axios.get('http://localhost:3000/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStats(statsRes.data);
      }
      setPatientsError(false);
    } catch (error) {
      console.error('Dashboard error:', error);
      // Don't show error toast for HR if endpoint doesn't exist yet
      if (user?.role !== 'HR') {
        toast.error('Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="spinner" />;

  const renderStatCards = () => {
    const role = user?.role;
    if (!stats) return [];

    // ✅ HR Dashboard Stats
    if (role === 'HR') {
      return [
        { icon: '👤', label: 'Total Employees', value: stats.totalEmployees || 0 },
        { icon: '✅', label: 'Active Staff', value: stats.activeEmployees || 0 },
        { icon: '🏢', label: 'Departments', value: stats.departments || 0 },
        { icon: '📋', label: 'Pending Leaves', value: stats.pendingLeaves || 0 },
        { icon: '🏖️', label: 'On Leave Today', value: stats.employeesOnLeave || 0 },
        { icon: '⏰', label: 'Clocked In', value: stats.clockedInToday || 0 },
      ];
    }

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

    // ✅ Clinical Dashboard (Doctor, Obstetrician)
    if (['Doctor', 'Obstetrician'].includes(role)) {
      return [
        { icon: '👤', label: 'My Patients', value: stats.myPatientsCount || 0 },
        { icon: '📅', label: 'My Appointments', value: stats.myAppointmentsCount || 0 },
        { icon: '💊', label: 'Prescriptions Written', value: stats.myPrescriptionsCount || 0 },
      ];
    }

    // ✅ Clinical Dashboard (Nurse, Midwife)
    if (['Nurse', 'Midwife'].includes(role)) {
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

    // Radiologist Dashboard
    if (role === 'Radiologist') {
      return [
        { icon: '📷', label: 'Total Orders', value: stats.totalImagingOrders || 0 },
        { icon: '⏳', label: 'Pending Reviews', value: stats.pendingImagingOrders || 0 },
        { icon: '✅', label: 'Completed Reports', value: stats.completedImagingOrders || 0 },
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>

        {/* ✅ HR Department Distribution Chart */}
        {user?.role === 'HR' && stats?.departments > 0 && (
          <div className="section" style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3>🏢 Department Overview</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px' }}>
                <span><strong>Total Departments</strong></span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f3460' }}>{stats.departments || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f0fdf4', borderRadius: '6px' }}>
                <span><strong>👤 Total Employees</strong></span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{stats.totalEmployees || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#dbeafe', borderRadius: '6px' }}>
                <span><strong>✅ Active Staff</strong></span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e40af' }}>{stats.activeEmployees || 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* ✅ HR Leave Summary Chart */}
        {user?.role === 'HR' && (
          <div className="section" style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3>📋 Leave Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#fef3c7', borderRadius: '6px' }}>
                <span><strong>⏳ Pending Leaves</strong></span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#92400e' }}>{stats.pendingLeaves || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#fce4ec', borderRadius: '6px' }}>
                <span><strong>🏖️ On Leave Today</strong></span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#c62828' }}>{stats.employeesOnLeave || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#e8f5e9', borderRadius: '6px' }}>
                <span><strong>⏰ Clocked In Today</strong></span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#2e7d32' }}>{stats.clockedInToday || 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* Original charts for other roles */}
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

        {/* Revenue Chart for Finance roles */}
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

      {/* HR Quick Actions */}
      {user?.role === 'HR' && (
        <div style={{ 
          marginTop: '24px', 
          padding: '16px 20px', 
          background: '#f8fafc', 
          borderRadius: '8px',
          border: '1px solid #e8ecf1',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          justifyContent: 'center'
        }}>
          <Link to="/hr/employees" className="btn btn-primary">👤 Manage Employees</Link>
          <Link to="/hr/departments" className="btn btn-secondary">🏢 Manage Departments</Link>
          <Link to="/hr/leaves" className="btn btn-secondary">📋 Manage Leaves</Link>
        </div>
      )}
    </div>
  );
};

export default Dashboard;