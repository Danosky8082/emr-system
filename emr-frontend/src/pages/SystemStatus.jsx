// src/pages/SystemStatus.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import './Dashboard.css';

const SystemStatus = () => {
  const { token } = useAuth();
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystemStatus();
  }, []);

  const fetchSystemStatus = async () => {
    setLoading(true); // ✅ FIX: Set loading true
    try {
      const res = await axios.get('http://localhost:3000/api/system/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSystemInfo(res.data);
    } catch (error) {
      console.error('Error fetching system status:', error);
      toast.error('Failed to load system status');
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIX: Show loading state
  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>🖥️ System Status</h2>
        <button className="btn btn-primary" onClick={fetchSystemStatus}>
          Refresh
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🟢</div>
          <div className="stat-info">
            <div className="stat-value">{systemInfo?.status || 'Unknown'}</div>
            <div className="stat-label">System Status</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🗄️</div>
          <div className="stat-info">
            <div className="stat-value">{systemInfo?.database || 'Unknown'}</div>
            <div className="stat-label">Database</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-info">
            <div className="stat-value">{Math.round(systemInfo?.uptime / 60)} min</div>
            <div className="stat-label">Uptime</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🧠</div>
          <div className="stat-info">
            <div className="stat-value">{systemInfo?.memory?.heapUsed || '0MB'}</div>
            <div className="stat-label">Memory Used</div>
          </div>
        </div>
      </div>

      <div className="section">
        <h3>System Details</h3>
        <div className="table-container">
          <table>
            <tbody>
              <tr>
                <td><strong>Node Version</strong></td>
                <td>{systemInfo?.nodeVersion}</td>
              </tr>
              <tr>
                <td><strong>Platform</strong></td>
                <td>{systemInfo?.platform}</td>
              </tr>
              <tr>
                <td><strong>Memory (RSS)</strong></td>
                <td>{systemInfo?.memory?.rss}</td>
              </tr>
              <tr>
                <td><strong>Heap Total</strong></td>
                <td>{systemInfo?.memory?.heapTotal}</td>
              </tr>
              <tr>
                <td><strong>Last Updated</strong></td>
                <td>{new Date(systemInfo?.timestamp).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SystemStatus;