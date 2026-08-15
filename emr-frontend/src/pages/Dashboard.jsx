import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import { useSearch } from '../components/Layout';
import { PieChart, Pie, Tooltip, Legend, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
  const { token, user } = useAuth();
  const { searchTerm } = useSearch();
  const [stats, setStats] = useState(null);
  const [recentPatients, setRecentPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, patientsRes] = await Promise.all([
        axios.get('http://localhost:3000/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:3000/api/patients', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setStats(statsRes.data);
      setRecentPatients(patientsRes.data.slice(0, 5));
    } catch (error) { console.error('Dashboard error:', error); } finally { setLoading(false); }
  };

  if (loading) return <div className="spinner" />;

  // Prepare Chart Data
  const genderChartData = stats?.genderData?.map(g => ({ name: g.gender, value: g._count })) || [];
  const monthlyChartData = stats?.monthlyRegistrations?.map(m => ({ month: m.month, Registrations: Number(m.count) })) || [];

  const statCards = [
    { icon: '👤', label: 'Total Patients', value: stats?.totalPatients || 0 },
    { icon: '👨‍⚕️', label: 'Total Staff', value: stats?.totalStaff || 0 },
    { icon: '📅', label: 'Scheduled Appts', value: stats?.totalAppointments || 0 },
    { icon: '💰', label: 'Total Revenue', value: `₦${(stats?.totalRevenue || 0).toLocaleString()}` },
    { icon: '💊', label: 'Low Stock Items', value: stats?.lowStockCount || 0 },
    { icon: '📋', label: 'Pending Bills', value: stats?.pendingBills || 0 },
  ];

  const filteredRecentPatients = recentPatients.filter(p => 
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Welcome back, {user?.firstName} {user?.lastName}!</p>
      </div>

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

      {/* --- CHARTS SECTION --- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginTop: '20px' }}>
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
      </div>

      <div className="section" style={{ marginTop: '20px' }}>
        <h3>Recent Patients</h3>
        <div className="table-container">
          <table>
            <thead><tr><th>Hospital ID</th><th>Name</th><th>Gender</th><th>Phone</th><th>Created</th></tr></thead>
            <tbody>
              {filteredRecentPatients.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.hospitalId}</strong></td>
                  <td>{p.firstName} {p.lastName}</td>
                  <td>{p.gender}</td>
                  <td>{p.phone || '-'}</td>
                  <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {filteredRecentPatients.length === 0 && <tr><td colSpan="5" className="text-center">No recent patients found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;