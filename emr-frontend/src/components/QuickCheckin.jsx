// src/components/QuickCheckin.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const QuickCheckin = ({ onPatientCheckedIn }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef(null);
  const token = localStorage.getItem('emr_token');

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl+F to focus search
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Escape to clear
      if (e.key === 'Escape') {
        setSearchQuery('');
        setPatients([]);
        setSelectedPatient(null);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Search patients
  useEffect(() => {
    const searchPatients = async () => {
      if (!searchQuery || searchQuery.length < 2) {
        setPatients([]);
        return;
      }

      setLoading(true);
      try {
        const res = await axios.get(
          `http://localhost:3000/api/patient/search/quick?query=${encodeURIComponent(searchQuery)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setPatients(res.data);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    };

    const delayDebounce = setTimeout(searchPatients, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery, token]);

  // Handle check-in
  const handleCheckin = async (patient) => {
    setLoading(true);
    try {
      const res = await axios.post(
        'http://localhost:3000/api/patient/checkin',
        {
          patientId: patient.id,
          checkInMethod: 'manual_entry'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(`✅ ${patient.firstName} ${patient.lastName} checked in successfully!`);
      setSelectedPatient(null);
      setSearchQuery('');
      setPatients([]);
      
      if (onPatientCheckedIn) {
        onPatientCheckedIn(res.data);
      }

      // Auto-open patient file
      if (res.data.autoFile) {
        window.open(res.data.autoFile.profileUrl, '_blank');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Check-in failed');
    } finally {
      setLoading(false);
    }
  };

  // Simulate card scan
  const handleCardScan = () => {
    setScanning(true);
    // Simulate scanning delay
    setTimeout(() => {
      setScanning(false);
      // In production, this would trigger the actual card reader
      toast.info('📇 Please scan patient card...');
    }, 1000);
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      marginBottom: '20px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '250px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="🔍 Search by Hospital ID, Phone, or Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                border: '2px solid #e2e8f0',
                fontSize: '16px',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#0f3460'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
            <button
              onClick={handleCardScan}
              className="btn btn-secondary"
              style={{ whiteSpace: 'nowrap' }}
              disabled={scanning}
            >
              {scanning ? '📇 Scanning...' : '📇 Scan Card'}
            </button>
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            💡 Type to search • Press Ctrl+F to focus • Esc to clear
          </div>
        </div>
      </div>

      {/* Search Results */}
      {patients.length > 0 && (
        <div style={{
          marginTop: '16px',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          <div style={{ padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <strong>Found {patients.length} patient(s)</strong>
          </div>
          {patients.map(patient => (
            <div
              key={patient.id}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #f0f2f5',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              onClick={() => setSelectedPatient(patient)}
            >
              <div>
                <div>
                  <strong>{patient.hospitalId}</strong> - {patient.firstName} {patient.lastName}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  📞 {patient.phone || 'No phone'} • {patient.gender || 'N/A'}
                  {patient.patientCategory && ` • ${patient.patientCategory}`}
                </div>
              </div>
              <button
                className="btn btn-sm btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCheckin(patient);
                }}
                disabled={loading}
              >
                ✅ Check In
              </button>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div className="spinner-sm" />
        </div>
      )}

      {searchQuery && patients.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
          No patients found matching "{searchQuery}"
        </div>
      )}

      {/* Selected Patient Preview */}
      {selectedPatient && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          background: '#f0f7ff',
          borderRadius: '8px',
          border: '1px solid #dbeafe'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ margin: 0 }}>{selectedPatient.firstName} {selectedPatient.lastName}</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                ID: {selectedPatient.hospitalId} • {selectedPatient.phone || 'No phone'}
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => handleCheckin(selectedPatient)}
              disabled={loading}
            >
              ✅ Confirm Check-in
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickCheckin;