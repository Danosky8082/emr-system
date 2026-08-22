// src/pages/DoctorQueue.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const DoctorQueue = () => {
  const { token, user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    waiting: 0,
    inProgress: 0,
    completed: 0
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await axios.get(
        `http://localhost:3000/api/patient/queue`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setQueue(res.data.queue || []);
      setStats({
        total: res.data.total || 0,
        waiting: res.data.waiting || 0,
        inProgress: res.data.inProgress || 0,
        completed: res.data.completed || 0
      });
    } catch (error) {
      console.error('Fetch queue error:', error);
      toast.error('Failed to load your queue');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchQueue]);

  const handleCallNext = async () => {
    try {
      const res = await axios.post(
        'http://localhost:3000/api/patient/queue/next',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`📢 Called: ${res.data.patient.patient.firstName} ${res.data.patient.patient.lastName}`);
      fetchQueue();
      
      // Auto-open patient file
      if (res.data.autoFile) {
        window.open(res.data.autoFile.profileUrl, '_blank');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        toast.info('No patients waiting in your queue');
      } else {
        toast.error('Failed to call next patient');
      }
    }
  };

  const handleCompleteVisit = async (queueId) => {
    try {
      await axios.patch(
        `http://localhost:3000/api/patient/queue/${queueId}/complete`,
        { notes: 'Visit completed' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Visit completed');
      fetchQueue();
    } catch (error) {
      toast.error('Failed to complete visit');
    }
  };

  const handleOpenFile = (patientId) => {
    window.open(`/patient-profile/${patientId}`, '_blank');
  };

  const getStatusColor = (status) => {
    const colors = {
      waiting: '#f59e0b',
      in_progress: '#3b82f6',
      completed: '#10b981',
      cancelled: '#ef4444',
      no_show: '#6b7280'
    };
    return colors[status] || '#6b7280';
  };

  const getStatusLabel = (status) => {
    const labels = {
      waiting: '⏳ Waiting',
      in_progress: '🔄 In Progress',
      completed: '✅ Completed',
      cancelled: '❌ Cancelled',
      no_show: '🚫 No Show'
    };
    return labels[status] || status;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      emergency: '#dc2626',
      urgent: '#f59e0b',
      normal: '#3b82f6'
    };
    return colors[priority] || '#3b82f6';
  };

  const filteredQueue = queue.filter(item => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h2>🏥 My Patient Queue</h2>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            👨‍⚕️ {user?.firstName} {user?.lastName} - {user?.role}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            className="btn btn-primary"
            onClick={handleCallNext}
            disabled={stats.waiting === 0}
          >
            📢 Call Next Patient ({stats.waiting} waiting)
          </button>
          <button 
            className="btn btn-secondary"
            onClick={fetchQueue}
          >
            🔄 Refresh
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (30s)
          </label>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Today</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.waiting}</div>
            <div className="stat-label">Waiting</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-icon">🔄</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#3b82f6' }}>{stats.inProgress}</div>
            <div className="stat-label">In Progress</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#10b981' }}>{stats.completed}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '16px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`btn btn-sm ${filter === 'waiting' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('waiting')}
          >
            ⏳ Waiting
          </button>
          <button
            className={`btn btn-sm ${filter === 'in_progress' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('in_progress')}
          >
            🔄 In Progress
          </button>
          <button
            className={`btn btn-sm ${filter === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('completed')}
          >
            ✅ Completed
          </button>
        </div>

        <span style={{ fontSize: '13px', color: '#6b7280' }}>
          {filteredQueue.length} patients
        </span>
      </div>

      {/* Queue Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Hospital ID</th>
              <th>Patient</th>
              <th>Check-in Time</th>
              <th>Wait Time</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredQueue.length > 0 ? (
              filteredQueue.map((item, index) => (
                <tr key={item.id} style={{
                  background: item.status === 'in_progress' ? '#eff6ff' : 'white',
                  borderLeft: item.status === 'waiting' ? `3px solid ${getPriorityColor(item.priority)}` : 'none'
                }}>
                  <td><strong>{item.position || index + 1}</strong></td>
                  <td><strong>{item.patient?.hospitalId}</strong></td>
                  <td>
                    <div>
                      <strong>{item.patient?.firstName} {item.patient?.lastName}</strong>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>
                        📞 {item.patient?.phone || 'N/A'} • {item.patient?.patientCategory || 'FPP'}
                      </div>
                      {item.appointment && (
                        <div style={{ fontSize: '10px', color: '#3b82f6' }}>
                          📅 Appt: {new Date(item.appointment.dateTime).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>{new Date(item.checkInTime).toLocaleTimeString()}</td>
                  <td>
                    {item.waitTimeMinutes > 0 ? (
                      <span style={{
                        color: item.waitTimeMinutes > 30 ? '#ef4444' : item.waitTimeMinutes > 15 ? '#f59e0b' : '#10b981'
                      }}>
                        {item.waitTimeMinutes} min
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    <span style={{
                      background: getPriorityColor(item.priority),
                      color: 'white',
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      {item.priority || 'Normal'}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      background: getStatusColor(item.status),
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {getStatusLabel(item.status)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleOpenFile(item.patient.id)}
                      >
                        📂 Open File
                      </button>
                      {item.status === 'in_progress' && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleCompleteVisit(item.id)}
                        >
                          ✅ Complete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center">
                  <div style={{ padding: '20px' }}>
                    <p style={{ fontSize: '16px', color: '#6b7280' }}>
                      📋 No patients in your queue
                    </p>
                    <p style={{ fontSize: '13px', color: '#9ca3af' }}>
                      Patients will appear here when they check in for their appointments.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Quick Actions */}
      <div style={{
        marginTop: '16px',
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <button
          className="btn btn-secondary"
          onClick={() => window.open('/appointments', '_blank')}
        >
          📅 View Appointments
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => window.open('/patients', '_blank')}
        >
          👤 View All Patients
        </button>
      </div>
    </div>
  );
};

export default DoctorQueue;