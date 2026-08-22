// src/pages/PatientHistory.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const PatientHistory = () => {
  const { token } = useAuth();
  const [searchId, setSearchId] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [patientInfo, setPatientInfo] = useState(null);

  const handleSearch = async () => {
    if (!searchId.trim()) {
      toast.error('Please enter a Hospital ID or Name');
      return;
    }
    setLoading(true);
    try {
      // Use the search endpoint
      const res = await axios.get(`http://localhost:3000/api/patients/history?search=${encodeURIComponent(searchId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.length === 0) {
        toast.error('No medical history found for this patient.');
        setRecords([]);
        setPatientInfo(null);
        setLoading(false);
        return;
      }

      // Get patient info from the first record
      const patient = res.data[0]?.patient;
      if (patient) {
        setPatientInfo(patient);
      }
      
      setRecords(res.data);
      toast.success(`Found ${res.data.length} record(s)`);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to retrieve patient history');
      setRecords([]);
      setPatientInfo(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Patient History & Medical Coding</h2>
        <div style={{display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap'}}>
          <input 
            type="text" 
            placeholder="Enter Hospital ID or Patient Name" 
            value={searchId} 
            onChange={e => setSearchId(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{padding:'10px 14px', borderRadius:'8px', border:'1px solid #ccc', minWidth:'250px', fontSize:'14px'}} 
          />
          <button onClick={handleSearch} className="btn btn-primary" disabled={loading}>
            {loading ? 'Searching...' : 'Retrieve Records'}
          </button>
        </div>
      </div>
      
      {loading && <div className="spinner" />}
      
      {patientInfo && (
        <div style={{
          background: '#f0f7ff',
          padding: '16px 20px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #dbeafe'
        }}>
          <h4 style={{ margin: 0, color: '#1a1a2e' }}>
            👤 Patient: {patientInfo.firstName} {patientInfo.lastName}
          </h4>
          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
            Hospital ID: <strong>{patientInfo.hospitalId}</strong>
          </p>
        </div>
      )}
      
      {records.length > 0 && (
        <div className="section">
          <h3>Medical Timeline & Coding History</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Doctor</th>
                  <th>Encounter Type</th>
                  <th>Diagnosis</th>
                  <th>ICD-10 Code</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td>{new Date(r.encounterDate).toLocaleDateString()}</td>
                    <td>{r.doctorName}</td>
                    <td>{r.encounterType}</td>
                    <td>{r.diagnosis}</td>
                    <td><code style={{background:'#eef', padding:'2px 6px', borderRadius:'4px'}}>{r.icd10Code || '-'}</code></td>
                    <td>{r.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {!loading && records.length === 0 && searchId && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: '16px', color: '#6b7280' }}>
            📋 No medical history found for this patient.
          </p>
          <p style={{ fontSize: '14px', color: '#9ca3af' }}>
            History records will appear here when added by medical staff.
          </p>
        </div>
      )}
      
      {!loading && records.length === 0 && !searchId && (
        <p className="text-center" style={{ color: '#6b7280', padding: '40px' }}>
          🔍 Enter a Hospital ID or patient name to search for medical history.
        </p>
      )}
    </div>
  );
};

export default PatientHistory;