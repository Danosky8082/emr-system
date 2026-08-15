import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';

const Billing = () => {
  const { token } = useAuth();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Declare fetch function FIRST
  const fetchBills = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/billing', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBills(res.data);
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Then use it in useEffect
  useEffect(() => {
    fetchBills();
  }, []);

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Billing</h2>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Patient</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Payment Method</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => (
              <tr key={b.id}>
                <td><strong>{b.invoiceNumber}</strong></td>
                <td>{b.patient?.firstName} {b.patient?.lastName || 'N/A'}</td>
                <td>{b.description}</td>
                <td>₦{b.totalAmount.toLocaleString()}</td>
                <td><span className={`status-badge status-${b.status.toLowerCase()}`}>{b.status}</span></td>
                <td>{b.paymentMethod || '-'}</td>
              </tr>
            ))}
            {bills.length === 0 && (
              <tr><td colSpan="6" className="text-center">No bills found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Billing;