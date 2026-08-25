// src/pages/HRDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const HRDashboard = () => {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    departments: 0,
    pendingLeaves: 0,
    employeesOnLeave: 0,
    clockedInToday: 0,
    totalTrainings: 0
  });
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [recentEmployees, setRecentEmployees] = useState([]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3000/api/hr/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setStats(res.data.statistics);
      setRecentLeaves(res.data.recentLeaves || []);
      setRecentEmployees(res.data.recentEmployees || []);
    } catch (error) {
      console.error('HR dashboard error:', error);
      toast.error('Failed to load HR dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>👔 HR Dashboard</h2>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          Welcome, {user?.firstName} {user?.lastName}!
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '4px solid #0f3460' }}>
          <div className="stat-icon">👤</div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalEmployees}</div>
            <div className="stat-label">Total Employees</div>
            <div style={{ fontSize: '12px', color: '#10b981' }}>
              {stats.activeEmployees} active
            </div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-icon">🏢</div>
          <div className="stat-info">
            <div className="stat-value">{stats.departments}</div>
            <div className="stat-label">Departments</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon">📋</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.pendingLeaves}</div>
            <div className="stat-label">Pending Leave Requests</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="stat-icon">🏖️</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#8b5cf6' }}>{stats.employeesOnLeave}</div>
            <div className="stat-label">On Leave Today</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-icon">⏰</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#10b981' }}>{stats.clockedInToday}</div>
            <div className="stat-label">Clocked In Today</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="stat-icon">📚</div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalTrainings}</div>
            <div className="stat-label">Trainings This Month</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Recent Leave Requests */}
        <div className="section" style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>📋 Pending Leave Requests</h3>
            <Link 
              to="/hr/leaves" 
              style={{
                background: '#0f3460',
                color: 'white',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                textDecoration: 'none',
                display: 'inline-block'
              }}
            >
              View All
            </Link>
          </div>
          {recentLeaves.length > 0 ? (
            <div>
              {recentLeaves.map(leave => (
                <div key={leave.id} style={{ 
                  padding: '12px', 
                  borderBottom: '1px solid #f0f2f5',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <strong>{leave.staff?.firstName} {leave.staff?.lastName}</strong>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      {leave.leaveType} • {leave.days} days
                    </div>
                  </div>
                  <span style={{
                    background: '#fef3c7',
                    color: '#92400e',
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    Pending
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#6b7280', textAlign: 'center' }}>No pending leave requests</p>
          )}
        </div>

        {/* Recent Employees */}
        <div className="section" style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>👤 Recent Hires</h3>
            <Link 
              to="/hr/employees" 
              style={{
                background: '#0f3460',
                color: 'white',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                textDecoration: 'none',
                display: 'inline-block'
              }}
            >
              View All
            </Link>
          </div>
          {recentEmployees.length > 0 ? (
            <div>
              {recentEmployees.map(emp => (
                <div key={emp.id} style={{ 
                  padding: '12px', 
                  borderBottom: '1px solid #f0f2f5',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <strong>{emp.firstName} {emp.lastName}</strong>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      {emp.role} • {emp.department?.name || 'No Department'}
                    </div>
                  </div>
                  <span style={{
                    background: '#d1fae5',
                    color: '#065f46',
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    Active
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#6b7280', textAlign: 'center' }}>No recent hires</p>
          )}
        </div>
      </div>

      {/* Quick Actions - ALL buttons with DARK backgrounds */}
      <div style={{ 
        marginTop: '24px', 
        padding: '24px', 
        background: '#ffffff', 
        borderRadius: '12px',
        border: '2px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '14px',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        {/* Manage Employees - Dark Blue */}
        <Link 
          to="/hr/employees" 
          style={{
            background: '#0f3460',
            color: '#ffffff',
            border: 'none',
            padding: '12px 28px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '15px',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(15, 52, 96, 0.3)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#1a4a7a';
            e.target.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#0f3460';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          👤 Manage Employees
        </Link>

        {/* Manage Departments - Dark Purple */}
        <Link 
          to="/hr/departments" 
          style={{
            background: '#5b21b6',
            color: '#ffffff',
            border: 'none',
            padding: '12px 28px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '15px',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(91, 33, 182, 0.3)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#6d28d9';
            e.target.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#5b21b6';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          🏢 Manage Departments
        </Link>

        {/* Manage Leaves - Dark Green */}
        <Link 
          to="/hr/leaves" 
          style={{
            background: '#047857',
            color: '#ffffff',
            border: 'none',
            padding: '12px 28px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '15px',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(4, 120, 87, 0.3)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#059669';
            e.target.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#047857';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          📋 Manage Leaves
        </Link>

        {/* Refresh - Dark Gray */}
        <button 
          onClick={fetchDashboard}
          style={{
            background: '#374151',
            color: '#ffffff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '15px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(55, 65, 81, 0.3)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#4b5563';
            e.target.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = '#374151';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          🔄 Refresh
        </button>
      </div>
    </div>
  );
};

export default HRDashboard;