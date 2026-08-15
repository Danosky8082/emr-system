import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';

const Prescriptions = () => {
  const { token } = useAuth();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Declare fetch function FIRST
  const fetchPrescriptions = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/prescriptions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrescriptions(res.data);
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Then use it in useEffect
  useEffect(() => {
    fetchPrescriptions();
  }, []);

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Prescriptions</h2>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Medication</th>
              <th>Dosage</th>
              <th>Frequency</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {prescriptions.map((p) => (
              <tr key={p.id}>
                <td>{p.patient?.firstName} {p.patient?.lastName || 'N/A'}</td>
                <td>{p.medication}</td>
                <td>{p.dosage}</td>
                <td>{p.frequency}</td>
                <td><span className={`status-badge status-${p.status.toLowerCase()}`}>{p.status}</span></td>
              </tr>
            ))}
            {prescriptions.length === 0 && (
              <tr><td colSpan="5" className="text-center">No prescriptions found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Prescriptions;