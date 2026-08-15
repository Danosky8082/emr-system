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

  const handleSearch = async () => {
    if (!searchId.trim()) {
      toast.error('Please enter a Hospital ID or Name');
      return;
    }
    setLoading(true);
    try {
      // Pass the search query as a query parameter
      const res = await axios.get('http://localhost:3000/api/patients/history', {
        params: { search: searchId },
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecords(res.data);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to retrieve patient history');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Patient History & Medical Coding</h2>
        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
          <input 
            type="text" 
            placeholder="Enter Hospital ID" 
            value={searchId} 
            onChange={e => setSearchId(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}} 
          />
          <button onClick={handleSearch} className="btn btn-primary" disabled={loading}>
            {loading ? 'Searching...' : 'Retrieve Records'}
          </button>
        </div>
      </div>
      
      {loading && <div className="spinner" />}
      
      {records.length > 0 && (
        <div className="section">
          <h3>Medical Timeline & Coding History</h3>
          <div className="table-container">
            <table>
              <thead><tr><th>Date</th><th>Doctor</th><th>Encounter Type</th><th>Diagnosis</th><th>ICD-10 Code</th><th>Notes</th></tr></thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td>{new Date(r.date).toLocaleDateString()}</td>
                    <td>{r.doctorName}</td>
                    <td>{r.encounterType}</td>
                    <td>{r.diagnosis}</td>
                    <td><code style={{background:'#eef', padding:'2px 6px', borderRadius:'4px'}}>{r.icd10Code}</code></td>
                    <td>{r.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!loading && records.length === 0 && searchId && (
        <p className="text-center">No medical history found for this patient.</p>
      )}
    </div>
  );
};
export default PatientHistory;