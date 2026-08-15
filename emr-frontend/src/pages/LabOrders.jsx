import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';

const LabOrders = () => {
  const { token } = useAuth();
  const [labOrders, setLabOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Declare fetch function FIRST
  const fetchLabOrders = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/lab-orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLabOrders(res.data);
    } catch (error) {
      console.error('Error fetching lab orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Then use it in useEffect
  useEffect(() => {
    fetchLabOrders();
  }, []);

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Lab Orders</h2>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Test Name</th>
              <th>Type</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {labOrders.map((l) => (
              <tr key={l.id}>
                <td>{l.patient?.firstName} {l.patient?.lastName || 'N/A'}</td>
                <td>{l.testName}</td>
                <td>{l.testType}</td>
                <td>{l.priority}</td>
                <td><span className={`status-badge status-${l.status.toLowerCase()}`}>{l.status}</span></td>
                <td>{l.result || '-'}</td>
              </tr>
            ))}
            {labOrders.length === 0 && (
              <tr><td colSpan="6" className="text-center">No lab orders found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LabOrders;