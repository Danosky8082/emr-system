// src/pages/AuditLogs.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';

const AuditLogs = () => {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/system/logs?limit=100', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(res.data.data);
      setTotal(res.data.total);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>📋 Audit Logs</h2>
        <span>Total: {total} entries</span>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Staff</th>
              <th>Role</th>
              <th>Action</th>
              <th>Module</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>
                  {log.staff?.firstName} {log.staff?.lastName}
                </td>
                <td><span className="role-badge">{log.staff?.role}</span></td>
                <td><span className="status-badge status-scheduled">{log.action}</span></td>
                <td>{log.module}</td>
                <td>{log.details || '-'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan="6" className="text-center">No logs found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogs;