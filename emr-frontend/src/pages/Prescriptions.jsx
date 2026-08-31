// src/pages/Prescriptions.jsx - ADD THIS

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import { useSearch } from '../components/Layout';
import toast from 'react-hot-toast';

const Prescriptions = () => {
  const { token, user } = useAuth();
  const { searchTerm } = useSearch();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const isPharmacist = user?.role === 'Pharmacist';
  const isDoctor = ['Doctor', 'Obstetrician'].includes(user?.role);

  const fetchPrescriptions = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/prescriptions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrescriptions(res.data);
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
      toast.error('Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  // ✅ HANDLE DISPENSE (Pharmacist only)
  const handleDispense = async (prescriptionId) => {
    if (!window.confirm('Dispense this prescription?')) return;
    
    try {
      await axios.patch(
        `http://localhost:3000/api/prescriptions/${prescriptionId}/dispense`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('✅ Prescription dispensed successfully!');
      fetchPrescriptions();
    } catch (error) {
      toast.error('Failed to dispense prescription');
    }
  };

  const getStatusClass = (status) => {
    const map = {
      'Prescribed': 'status-pending',
      'Dispensed': 'status-active',
      'Cancelled': 'status-cancelled'
    };
    return map[status] || 'status-pending';
  };

  // Filter by search
  const filteredPrescriptions = prescriptions.filter(p => {
    const patientName = `${p.patient?.firstName || ''} ${p.patient?.lastName || ''}`.toLowerCase();
    const doctorName = `${p.prescribedBy?.firstName || ''} ${p.prescribedBy?.lastName || ''}`.toLowerCase();
    const searchString = `${patientName} ${doctorName} ${p.medication || ''} ${p.status || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Prescriptions</h2>
        {isDoctor && (
          <button className="btn btn-primary" onClick={() => {/* open create modal */}}>
            + New Prescription
          </button>
        )}
        {isPharmacist && (
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            💊 {filteredPrescriptions.filter(p => p.status === 'Prescribed').length} pending to dispense
          </span>
        )}
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
              <th>Prescribed By</th>
              <th>Dispensed By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPrescriptions.map((p) => (
              <tr key={p.id}>
                <td>{p.patient?.firstName} {p.patient?.lastName || 'N/A'}</td>
                <td><strong>{p.medication}</strong></td>
                <td>{p.dosage}</td>
                <td>{p.frequency}</td>
                <td>
                  <span className={`status-badge ${getStatusClass(p.status)}`}>
                    {p.status}
                  </span>
                </td>
                <td>
                  {p.prescribedBy?.firstName} {p.prescribedBy?.lastName}
                </td>
                <td>
                  {p.dispensedBy?.firstName} {p.dispensedBy?.lastName || '-'}
                </td>
                <td>
                  {/* ✅ PHARMACIST CAN DISPENSE */}
                  {isPharmacist && p.status === 'Prescribed' && (
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleDispense(p.id)}
                      style={{
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}
                    >
                      💊 Dispense
                    </button>
                  )}
                  {p.status === 'Dispensed' && (
                    <span style={{ color: '#10b981', fontSize: '12px', fontWeight: '600' }}>
                      ✅ Dispensed
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filteredPrescriptions.length === 0 && (
              <tr><td colSpan="8" className="text-center">No prescriptions found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Prescriptions;