// src/pages/Dashboard.jsx - COMPLETE WITH ALL SPECIALIST SUPPORT

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

  // ✅ Render Lab Dashboard for LabTechnician and LabScientist
  const renderLabDashboard = () => {
    if (!stats?.summary) return null;
    
    return (
      <div className="dashboard-content">
        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
            <div className="stat-icon">🧪</div>
            <div className="stat-info">
              <div className="stat-value">{stats.summary.totalOrders || 0}</div>
              <div className="stat-label">Total Orders</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="stat-icon">⏳</div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.summary.pendingOrders || 0}</div>
              <div className="stat-label">Pending</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
            <div className="stat-icon">🔄</div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: '#3b82f6' }}>{stats.summary.inProgressOrders || 0}</div>
              <div className="stat-label">In Progress</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="stat-icon">✅</div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: '#10b981' }}>{stats.summary.completedOrders || 0}</div>
              <div className="stat-label">Completed</div>
            </div>
          </div>
          {stats.labScientistStats && (
            <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
              <div className="stat-icon">🔬</div>
              <div className="stat-info">
                <div className="stat-value" style={{ color: '#8b5cf6' }}>{stats.labScientistStats.awaitingValidation || 0}</div>
                <div className="stat-label">Awaiting Validation</div>
              </div>
            </div>
          )}
          <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: '#8b5cf6' }}>{stats.summary.validatedOrders || 0}</div>
              <div className="stat-label">Validated</div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
          {/* Test Type Distribution */}
          {stats.chartData?.ordersByType && stats.chartData.ordersByType.length > 0 && (
            <div className="chart-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>📊 Orders by Test Type</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {stats.chartData.ordersByType.map((item, index) => {
                  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
                  const total = stats.chartData.ordersByType.reduce((sum, i) => sum + i.value, 0);
                  const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
                  return (
                    <div key={index}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                        <span>{item.name}</span>
                        <span><strong>{item.value}</strong> ({percentage}%)</span>
                      </div>
                      <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${percentage}%`, 
                          background: colors[index % colors.length],
                          borderRadius: '4px',
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Priority Distribution */}
          {stats.chartData?.ordersByPriority && stats.chartData.ordersByPriority.length > 0 && (
            <div className="chart-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>⚠️ Orders by Priority</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {stats.chartData.ordersByPriority.map((item, index) => {
                  const priorityColors = {
                    'Emergency': '#ef4444',
                    'Urgent': '#f59e0b',
                    'Routine': '#3b82f6'
                  };
                  const total = stats.chartData.ordersByPriority.reduce((sum, i) => sum + i.value, 0);
                  const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
                  return (
                    <div key={index}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                        <span>{item.name}</span>
                        <span><strong>{item.value}</strong> ({percentage}%)</span>
                      </div>
                      <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${percentage}%`, 
                          background: priorityColors[item.name] || '#6b7280',
                          borderRadius: '4px',
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Daily Orders Chart */}
          {stats.chartData?.dailyOrders && stats.chartData.dailyOrders.length > 0 && (
            <div className="chart-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', gridColumn: '1 / -1' }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>📈 Daily Lab Orders (Last 7 Days)</h4>
              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '150px', padding: '0 10px' }}>
                {stats.chartData.dailyOrders.map((item, index) => {
                  const maxValue = Math.max(...stats.chartData.dailyOrders.map(i => i.count), 1);
                  const height = (item.count / maxValue) * 130;
                  return (
                    <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div style={{ 
                        height: `${height}px`, 
                        width: '30px', 
                        background: '#3b82f6',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.5s ease',
                        position: 'relative'
                      }}>
                        <span style={{ 
                          position: 'absolute', 
                          top: '-20px', 
                          left: '50%', 
                          transform: 'translateX(-50%)',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          color: '#1e293b'
                        }}>
                          {item.count}
                        </span>
                      </div>
                      <span style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
                        {new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Recent Orders Table */}
        {stats.recentOrders && stats.recentOrders.length > 0 && (
          <div style={{ marginTop: '20px', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>📋 Recent Lab Orders</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Patient</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Test</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Type</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Status</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentOrders.map((order, index) => (
                    <tr key={order.id} style={{ borderBottom: index < stats.recentOrders.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                      <td style={{ padding: '10px 12px' }}>
                        {order.patient?.firstName} {order.patient?.lastName}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{order.testName}</td>
                      <td style={{ padding: '10px 12px' }}>{order.testType}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: order.status === 'Completed' ? '#10b981' : 
                                    order.status === 'In Progress' ? '#3b82f6' :
                                    order.status === 'Cancelled' ? '#ef4444' : '#f59e0b',
                          color: 'white'
                        }}>
                          {order.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ✅ Render Paediatrician Dashboard
  const renderPaediatricianDashboard = () => {
    if (!stats) return null;
    
    return (
      <div className="dashboard-content">
        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
            <div className="stat-icon">👶</div>
            <div className="stat-info">
              <div className="stat-value">{stats.childPatients || 0}</div>
              <div className="stat-label">Total Children</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="stat-icon">📅</div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.todayAppointments || 0}</div>
              <div className="stat-label">Today's Appointments</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: '#10b981' }}>{stats.growthRecords || 0}</div>
              <div className="stat-label">Growth Records</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <div className="stat-icon">💉</div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: '#8b5cf6' }}>{stats.vaccinationCompliance || 0}</div>
              <div className="stat-label">Vaccinations Due</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link to="/patients" className="btn btn-primary" style={{ marginRight: '10px' }}>
            👶 View All Children
          </Link>
          <Link to="/appointments" className="btn btn-secondary">
            📅 Manage Appointments
          </Link>
        </div>

        {/* Charts Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          <div className="section" style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3>👶 Child Gender Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie 
                  data={stats.genderData?.map(g => ({ name: g.gender, value: g._count })) || []} 
                  cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label
                >
                  {(stats.genderData || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="section" style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3>📈 Child Registrations (Last 6 Months)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.monthlyRegistrations?.map(m => ({ month: m.month, Registrations: Number(m.count) })) || []} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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

        {stats.recentAppointments && stats.recentAppointments.length > 0 && (
          <div style={{ marginTop: '20px', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>📋 Recent Child Appointments</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Patient</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Doctor</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Date/Time</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentAppointments.map((appt, index) => (
                    <tr key={appt.id} style={{ borderBottom: index < stats.recentAppointments.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                      <td style={{ padding: '10px 12px' }}>{appt.Patient?.firstName} {appt.Patient?.lastName}</td>
                      <td style={{ padding: '10px 12px' }}>Dr. {appt.Staff?.firstName} {appt.Staff?.lastName}</td>
                      <td style={{ padding: '10px 12px', color: '#6b7280' }}>{new Date(appt.dateTime).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: appt.status === 'Completed' ? '#10b981' : 
                                    appt.status === 'Scheduled' ? '#3b82f6' :
                                    appt.status === 'Cancelled' ? '#ef4444' : '#f59e0b',
                          color: 'white'
                        }}>
                          {appt.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ✅ Render Surgeon Dashboard
  const renderSurgeonDashboard = () => {
    if (!stats) return null;
    
    return (
      <div className="dashboard-content">
        <div className="stats-grid">
          <div className="stat-card" style={{ borderLeft: '4px solid #dc2626' }}>
            <div className="stat-icon">🏥</div>
            <div className="stat-info">
              <div className="stat-value">{stats.surgeryPatients || 0}</div>
              <div className="stat-label">Surgery Patients</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="stat-icon">📅</div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.todayAppointments || 0}</div>
              <div className="stat-label">Today's Appointments</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <div className="stat-icon">🔬</div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: '#8b5cf6' }}>{stats.pendingLabOrders || 0}</div>
              <div className="stat-label">Pending Lab Orders</div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link to="/surgery" className="btn btn-primary" style={{ marginRight: '10px' }}>
            🏥 View Surgery Patients
          </Link>
          <Link to="/appointments" className="btn btn-secondary">
            📅 Manage Appointments
          </Link>
        </div>
      </div>
    );
  };

  // ✅ Render Psychiatrist Dashboard
  const renderPsychiatristDashboard = () => {
    if (!stats) return null;
    
    return (
      <div className="dashboard-content">
        <div className="stats-grid">
          <div className="stat-card" style={{ borderLeft: '4px solid #7c3aed' }}>
            <div className="stat-icon">🧠</div>
            <div className="stat-info">
              <div className="stat-value">{stats.psychiatryPatients || 0}</div>
              <div className="stat-label">Psychiatry Patients</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="stat-icon">📅</div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.todayAppointments || 0}</div>
              <div className="stat-label">Today's Appointments</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <div className="stat-icon">📝</div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: '#8b5cf6' }}>{stats.mentalHealthNotes || 0}</div>
              <div className="stat-label">Clinical Notes</div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link to="/psychiatry" className="btn btn-primary" style={{ marginRight: '10px' }}>
            🧠 View Psychiatry Patients
          </Link>
          <Link to="/appointments" className="btn btn-secondary">
            📅 Manage Appointments
          </Link>
        </div>
      </div>
    );
  };

  // ✅ Render Dentist Dashboard
  const renderDentistDashboard = () => {
    if (!stats) return null;
    
    return (
      <div className="dashboard-content">
        <div className="stats-grid">
          <div className="stat-card" style={{ borderLeft: '4px solid #0f3460' }}>
            <div className="stat-icon">🦷</div>
            <div className="stat-info">
              <div className="stat-value">{stats.dentalPatients || 0}</div>
              <div className="stat-label">Dental Patients</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="stat-icon">📅</div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.todayAppointments || 0}</div>
              <div className="stat-label">Today's Appointments</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="stat-icon">✅</div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: '#10b981' }}>{stats.completedProcedures || 0}</div>
              <div className="stat-label">Completed Procedures</div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link to="/dental" className="btn btn-primary" style={{ marginRight: '10px' }}>
            🦷 View Dental Patients
          </Link>
          <Link to="/appointments" className="btn btn-secondary">
            📅 Manage Appointments
          </Link>
        </div>
      </div>
    );
  };

  // ✅ Render Optometrist Dashboard
  const renderOptometristDashboard = () => {
    if (!stats) return null;
    
    return (
      <div className="dashboard-content">
        <div className="stats-grid">
          <div className="stat-card" style={{ borderLeft: '4px solid #06b6d4' }}>
            <div className="stat-icon">👁️</div>
            <div className="stat-info">
              <div className="stat-value">{stats.optometryPatients || 0}</div>
              <div className="stat-label">Eye Patients</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="stat-icon">📅</div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.todayAppointments || 0}</div>
              <div className="stat-label">Today's Appointments</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="stat-icon">✅</div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: '#10b981' }}>{stats.completedExams || 0}</div>
              <div className="stat-label">Completed Exams</div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link to="/optometry" className="btn btn-primary" style={{ marginRight: '10px' }}>
            👁️ View Eye Patients
          </Link>
          <Link to="/appointments" className="btn btn-secondary">
            📅 Manage Appointments
          </Link>
        </div>
      </div>
    );
  };

  const renderStatCards = () => {
    const role = user?.role;
    if (!stats) return [];

    // ✅ Paediatrician Dashboard Stats
    if (role === 'Paediatrician') {
      return [
        { icon: '👶', label: 'Total Children', value: stats.childPatients || 0 },
        { icon: '📅', label: "Today's Appointments", value: stats.todayAppointments || 0 },
        { icon: '📊', label: 'Growth Records', value: stats.growthRecords || 0 },
        { icon: '💉', label: 'Vaccinations Due', value: stats.vaccinationCompliance || 0 },
      ];
    }

    // ✅ Surgeon Dashboard Stats
    if (role === 'Surgeon') {
      return [
        { icon: '🏥', label: 'Surgery Patients', value: stats.surgeryPatients || 0 },
        { icon: '📅', label: "Today's Appointments", value: stats.todayAppointments || 0 },
        { icon: '🔬', label: 'Pending Lab Orders', value: stats.pendingLabOrders || 0 },
      ];
    }

    // ✅ Psychiatrist Dashboard Stats
    if (role === 'Psychiatrist') {
      return [
        { icon: '🧠', label: 'Psychiatry Patients', value: stats.psychiatryPatients || 0 },
        { icon: '📅', label: "Today's Appointments", value: stats.todayAppointments || 0 },
        { icon: '📝', label: 'Clinical Notes', value: stats.mentalHealthNotes || 0 },
      ];
    }

    // ✅ Dentist Dashboard Stats
    if (role === 'Dentist') {
      return [
        { icon: '🦷', label: 'Dental Patients', value: stats.dentalPatients || 0 },
        { icon: '📅', label: "Today's Appointments", value: stats.todayAppointments || 0 },
        { icon: '✅', label: 'Completed Procedures', value: stats.completedProcedures || 0 },
      ];
    }

    // ✅ Optometrist Dashboard Stats
    if (role === 'Optometrist') {
      return [
        { icon: '👁️', label: 'Eye Patients', value: stats.optometryPatients || 0 },
        { icon: '📅', label: "Today's Appointments", value: stats.todayAppointments || 0 },
        { icon: '✅', label: 'Completed Exams', value: stats.completedExams || 0 },
      ];
    }

    // ✅ Lab Scientist Dashboard Stats
    if (role === 'LabScientist' || role === 'LabTechnician') {
      if (stats.summary) {
        const cards = [
          { icon: '🧪', label: 'Total Orders', value: stats.summary.totalOrders || 0 },
          { icon: '⏳', label: 'Pending', value: stats.summary.pendingOrders || 0 },
          { icon: '🔄', label: 'In Progress', value: stats.summary.inProgressOrders || 0 },
          { icon: '✅', label: 'Completed', value: stats.summary.completedOrders || 0 },
          { icon: '📊', label: 'Validated', value: stats.summary.validatedOrders || 0 },
        ];
        if (stats.labScientistStats) {
          cards.push({ icon: '🔬', label: 'Awaiting Validation', value: stats.labScientistStats.awaitingValidation || 0 });
        }
        return cards;
      }
      return [];
    }

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

    // Clinical Dashboard (Doctor, Obstetrician)
    if (['Doctor', 'Obstetrician'].includes(role)) {
      return [
        { icon: '👤', label: 'My Patients', value: stats.myPatientsCount || 0 },
        { icon: '📅', label: 'My Appointments', value: stats.myAppointmentsCount || 0 },
        { icon: '💊', label: 'Prescriptions Written', value: stats.myPrescriptionsCount || 0 },
      ];
    }

    // Clinical Dashboard (Nurse, Midwife)
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

    // Radiologist Dashboard
    if (role === 'Radiologist') {
      return [
        { icon: '📷', label: 'Total Orders', value: stats.totalImagingOrders || 0 },
        { icon: '⏳', label: 'Pending Reviews', value: stats.pendingImagingOrders || 0 },
        { icon: '✅', label: 'Completed Reports', value: stats.completedImagingOrders || 0 },
      ];
    }

    // Receptionist Dashboard
    if (role === 'Receptionist') {
      return [
        { icon: '👤', label: 'Total Patients', value: stats.totalPatients || 0 },
        { icon: '📅', label: "Today's Appointments", value: stats.todayAppointments || 0 },
        { icon: '📋', label: 'Pending Intake', value: stats.pendingIntake || 0 },
      ];
    }

    return [];
  };

  const statCards = renderStatCards();

  const genderChartData = stats?.genderData?.map(g => ({ name: g.gender, value: g._count })) || [];
  const monthlyChartData = stats?.monthlyRegistrations?.map(m => ({ month: m.month, Registrations: Number(m.count) })) || [];
  const showPatientCharts = ['Admin', 'Records', 'ITAdmin', 'Doctor', 'Nurse', 'Obstetrician', 'Midwife', 'Paediatrician'].includes(user?.role);

  const revenueChartData = stats?.revenueTrend?.map(m => ({ month: m.month, Revenue: m.revenue })) || [];
  const showRevenueChart = ['Accountant', 'BillingOfficer'].includes(user?.role);

  // ✅ Check roles
  const isLabRole = ['LabTechnician', 'LabScientist'].includes(user?.role);
  const isPaediatrician = user?.role === 'Paediatrician';
  const isSurgeon = user?.role === 'Surgeon';
  const isPsychiatrist = user?.role === 'Psychiatrist';
  const isDentist = user?.role === 'Dentist';
  const isOptometrist = user?.role === 'Optometrist';

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Welcome back, {user?.firstName} {user?.lastName}!</p>
      </div>

      {/* ✅ Render Specialist Dashboards */}
      {isPaediatrician && stats ? (
        renderPaediatricianDashboard()
      ) : isSurgeon && stats ? (
        renderSurgeonDashboard()
      ) : isPsychiatrist && stats ? (
        renderPsychiatristDashboard()
      ) : isDentist && stats ? (
        renderDentistDashboard()
      ) : isOptometrist && stats ? (
        renderOptometristDashboard()
      ) : isLabRole && stats?.summary ? (
        renderLabDashboard()
      ) : (
        <>
          {/* Regular Stats Cards */}
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

          {/* Quick Action Button for Clinical Roles */}
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

          {/* Quick Action Button for Specialist Roles */}
          {isSurgeon && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link to="/surgery" className="btn btn-primary" style={{ marginRight: '10px' }}>
                🏥 View Surgery Patients
              </Link>
              <Link to="/appointments" className="btn btn-secondary">
                📅 Manage Appointments
              </Link>
            </div>
          )}

          {isPsychiatrist && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link to="/psychiatry" className="btn btn-primary" style={{ marginRight: '10px' }}>
                🧠 View Psychiatry Patients
              </Link>
              <Link to="/appointments" className="btn btn-secondary">
                📅 Manage Appointments
              </Link>
            </div>
          )}

          {isDentist && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link to="/dental" className="btn btn-primary" style={{ marginRight: '10px' }}>
                🦷 View Dental Patients
              </Link>
              <Link to="/appointments" className="btn btn-secondary">
                📅 Manage Appointments
              </Link>
            </div>
          )}

          {isOptometrist && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link to="/optometry" className="btn btn-primary" style={{ marginRight: '10px' }}>
                👁️ View Eye Patients
              </Link>
              <Link to="/appointments" className="btn btn-secondary">
                📅 Manage Appointments
              </Link>
            </div>
          )}

          {/* Charts Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>

            {/* HR Department Distribution Chart */}
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

            {/* HR Leave Summary Chart */}
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
        </>
      )}
    </div>
  );
};

export default Dashboard;