// src/pages/QueueDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';
import QuickCheckin from '../components/QuickCheckin';

const QueueDashboard = () => {
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
  const [destinationFilter, setDestinationFilter] = useState('CLINIC');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const isAdmin = ['Admin', 'ITAdmin', 'Records'].includes(user?.role);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await axios.get(
        `http://localhost:3000/api/patient/queue?destinationType=${destinationFilter}`,
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
      toast.error('Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, [token, destinationFilter]);

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
        { destinationType: destinationFilter },
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
        toast.info('No patients waiting');
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

  const handlePatientCheckin = (data) => {
    toast.success(`✅ ${data.patient.firstName} ${data.patient.lastName} checked in`);
    fetchQueue();
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
        <h2>🏥 Patient Queue Management</h2>
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

      {/* Quick Check-in */}
      <QuickCheckin onPatientCheckedIn={handlePatientCheckin} />

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

        <select
          value={destinationFilter}
          onChange={(e) => setDestinationFilter(e.target.value)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            fontSize: '14px'
          }}
        >
          <option value="CLINIC">🏥 Clinic</option>
          <option value="WARD">🛏️ Ward</option>
          <option value="LAB">🔬 Lab</option>
          <option value="PHARMACY">💊 Pharmacy</option>
          <option value="RADIOLOGY">📷 Radiology</option>
        </select>
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
                        onClick={() => {
                          setSelectedPatient(item);
                          setShowPatientModal(true);
                        }}
                      >
                        👤 View
                      </button>
                      {item.status === 'in_progress' && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleCompleteVisit(item.id)}
                        >
                          ✅ Complete
                        </button>
                      )}
                      {item.status === 'waiting' && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            // Open patient file
                            window.open(`/patient-profile/${item.patient.id}`, '_blank');
                          }}
                        >
                          📂 Open File
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="8" className="text-center">No patients in queue</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Patient Detail Modal */}
      {showPatientModal && selectedPatient && (
        <div className="modal-overlay" onClick={() => setShowPatientModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>👤 Patient Details</h3>
              <button className="modal-close" onClick={() => setShowPatientModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><strong>Hospital ID:</strong> {selectedPatient.patient?.hospitalId}</div>
                <div><strong>Name:</strong> {selectedPatient.patient?.firstName} {selectedPatient.patient?.lastName}</div>
                <div><strong>Phone:</strong> {selectedPatient.patient?.phone || 'N/A'}</div>
                <div><strong>Gender:</strong> {selectedPatient.patient?.gender || 'N/A'}</div>
                <div><strong>Category:</strong> {selectedPatient.patient?.patientCategory || 'FPP'}</div>
                <div><strong>Check-in Time:</strong> {new Date(selectedPatient.checkInTime).toLocaleString()}</div>
                <div><strong>Status:</strong> {getStatusLabel(selectedPatient.status)}</div>
                <div><strong>Priority:</strong> {selectedPatient.priority || 'Normal'}</div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <strong>Appointment:</strong> {selectedPatient.appointment ? 
                    `${selectedPatient.appointment.type || 'Consultation'} with Dr. ${selectedPatient.appointment.staff?.firstName || ''} ${selectedPatient.appointment.staff?.lastName || ''}` 
                    : 'Walk-in'}
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <strong>Notes:</strong> {selectedPatient.notes || 'None'}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowPatientModal(false)}
              >
                Close
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  window.open(`/patient-profile/${selectedPatient.patient.id}`, '_blank');
                  setShowPatientModal(false);
                }}
              >
                📂 Open Full File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QueueDashboard;