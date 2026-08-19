// src/pages/AntenatalDashboard.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './Dashboard.css';
import toast from 'react-hot-toast';

const AntenatalDashboard = () => {
  const { token, user } = useAuth();
  const [pregnancies, setPregnancies] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPatientSelector, setShowPatientSelector] = useState(false);
  const [fetchAttempts, setFetchAttempts] = useState(0);
  
  // ✅ Refs for preventing loops
  const isMounted = useRef(true);
  const isFetching = useRef(false);
  const hasFetched = useRef(false);
  const fetchTimer = useRef(null);

  const isNurseOrMidwife = ['Nurse', 'Midwife'].includes(user?.role);
  const isDoctorOrObstetrician = ['Doctor', 'Obstetrician'].includes(user?.role);
  const canRecordVitals = isNurseOrMidwife;
  
  const canViewPatients = ['Admin', 'Records', 'ITAdmin', 'Doctor', 'Obstetrician', 'Nurse', 'Midwife', 'BillingOfficer'].includes(user?.role);

  // ✅ Memoized fetch function
  const fetchData = useCallback(async () => {
    // ✅ Multiple guards
    if (isFetching.current) {
      console.log('⏭️ Already fetching...');
      return;
    }
    
    if (hasFetched.current) {
      console.log('⏭️ Already fetched successfully');
      // Still ensure loading is false
      if (isMounted.current) {
        setLoading(false);
      }
      return;
    }
    
    if (!token) {
      console.log('⏭️ No token');
      if (isMounted.current) {
        setLoading(false);
      }
      return;
    }

    console.log('🔄 Starting fetch...');
    isFetching.current = true;
    
    if (isMounted.current) {
      setLoading(true);
    }
    
    try {
      console.log('📡 Fetching pregnancies...');
      const pregnancyRes = await axios.get('http://localhost:3000/api/pregnancies', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
      });
      
      const pregnancyData = pregnancyRes.data || [];
      console.log(`✅ Fetched ${pregnancyData.length} pregnancies`);
      
      if (isMounted.current) {
        setPregnancies(pregnancyData);
      }

      console.log('📡 Fetching patients...');
      if (canViewPatients && isMounted.current) {
        let patientsData = [];
        
        try {
          let url = 'http://localhost:3000/api/patients';
          
          if (user?.role === 'Midwife' || user?.role === 'Nurse') {
            url = 'http://localhost:3000/api/nurse/patients';
          } else if (user?.role === 'Doctor' || user?.role === 'Obstetrician') {
            url = 'http://localhost:3000/api/doctor/patients';
          }
          
          const patientRes = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15000
          });
          
          if (user?.role === 'Midwife' || user?.role === 'Nurse' || 
              user?.role === 'Doctor' || user?.role === 'Obstetrician') {
            patientsData = (patientRes.data || [])
              .map(journey => journey?.patient)
              .filter(patient => patient !== null && patient !== undefined);
          } else {
            patientsData = patientRes.data || [];
          }
          
          console.log(`👤 Fetched ${patientsData.length} patients`);
          if (isMounted.current) {
            setPatients(patientsData);
          }
        } catch (patientError) {
          console.error('❌ Error fetching patients:', patientError);
          if (isMounted.current) {
            setPatients([]);
          }
        }
      }
      
      // ✅ Mark as fetched ONLY after successful completion
      if (isMounted.current) {
        hasFetched.current = true;
        console.log('✅ Fetch completed successfully');
      }
    } catch (error) {
      console.error('❌ Fetch error:', error);
      if (isMounted.current) {
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          toast.error('Request timed out. Please refresh the page.');
        } else if (error.response) {
          toast.error(error.response.data?.error || 'Failed to load data');
        } else if (error.request) {
          toast.error('Cannot connect to server. Please check your connection.');
        } else {
          toast.error('An error occurred while fetching data');
        }
        // Keep existing data if any
        if (pregnancies.length === 0) {
          setPregnancies([]);
        }
        if (patients.length === 0) {
          setPatients([]);
        }
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      isFetching.current = false;
      if (fetchTimer.current) {
        clearTimeout(fetchTimer.current);
        fetchTimer.current = null;
      }
    }
  }, [token, user?.role, canViewPatients, pregnancies.length, patients.length]);

  // ✅ useEffect with cleanup
  useEffect(() => {
    console.log('📌 AntenatalDashboard mounted');
    isMounted.current = true;
    
    // ✅ Fetch only if not fetched yet
    if (token && !hasFetched.current && !isFetching.current) {
      // Small delay to ensure everything is ready
      fetchTimer.current = setTimeout(() => {
        fetchData();
      }, 100);
    } else if (hasFetched.current) {
      // If already fetched, just turn off loading
      if (isMounted.current) {
        setLoading(false);
      }
    }
    
    // ✅ Cleanup
    return () => {
      console.log('📌 AntenatalDashboard unmounting');
      isMounted.current = false;
      if (fetchTimer.current) {
        clearTimeout(fetchTimer.current);
        fetchTimer.current = null;
      }
    };
  }, [token, fetchData]);

  // ✅ Filter pregnancies
  const activePregnancies = pregnancies.filter(p => p?.status === 'Active');
  const deliveredPregnancies = pregnancies.filter(p => p?.status === 'Delivered');

  // ✅ Log the counts for debugging
  console.log(`📊 Active: ${activePregnancies.length}, Delivered: ${deliveredPregnancies.length}`);

  // Filter: Female patients who are NOT currently pregnant (Active)
  const availablePatients = patients.filter(patient => {
    if (!patient) return false;
    const genderLower = (patient.gender || '').toLowerCase().trim();
    const isFemale = genderLower === 'female' || genderLower === 'f';
    
    if (!isFemale) return false;
    
    const hasActivePregnancy = pregnancies.some(p => 
      p?.patient?.id === patient.id && p?.status === 'Active'
    );
    if (hasActivePregnancy) return false;
    
    return true;
  });

  const filteredPatients = availablePatients.filter(patient =>
    `${patient.firstName} ${patient.lastName} ${patient.hospitalId}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  // Show loading spinner
  if (loading) {
    return (
      <div className="dashboard" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div className="spinner" />
        <p style={{ marginTop: '20px', color: '#6b7280' }}>Loading antenatal data...</p>
        <p style={{ fontSize: '12px', color: '#9ca3af' }}>This may take a moment</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>🤰 Antenatal Care</h2>
        {canViewPatients && (
          <button 
            className="btn btn-primary" 
            onClick={() => setShowPatientSelector(!showPatientSelector)}
          >
            {showPatientSelector ? '✕ Close' : '➕ Register New Pregnancy'}
          </button>
        )}
      </div>

      {/* Patient Selector */}
      {showPatientSelector && canViewPatients && (
        <div className="card" style={{ marginBottom: '24px', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h4 style={{ marginTop: 0 }}>👤 Select Patient for New Pregnancy</h4>
          <p className="text-muted" style={{ fontSize: '14px', marginBottom: '16px' }}>
            Choose a female patient who is not currently pregnant.
            <br />
            <span style={{ fontSize: '12px', color: '#10b981' }}>
              ✅ {availablePatients.length} patients available for registration
            </span>
          </p>
          
          <input
            type="text"
            placeholder="🔍 Search by name or Hospital ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              marginBottom: '16px',
              boxSizing: 'border-box'
            }}
          />

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Hospital ID</th>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>DOB</th>
                  <th>Phone</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.length > 0 ? (
                  filteredPatients.map(patient => (
                    <tr key={patient.id}>
                      <td><strong>{patient.hospitalId}</strong></td>
                      <td>{patient.firstName} {patient.lastName}</td>
                      <td>{patient.gender}</td>
                      <td>{new Date(patient.dateOfBirth).toLocaleDateString()}</td>
                      <td>{patient.phone || '—'}</td>
                      <td>
                        <Link
                          to={`/pregnancy/new?patientId=${patient.hospitalId}`}
                          className="btn btn-sm btn-primary"
                        >
                          📝 Register Pregnancy
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center">
                      {searchTerm ? 'No patients found matching your search.' : 'No eligible female patients available for pregnancy registration.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ✅ Active Pregnancies List */}
      <div className="table-container" style={{ marginBottom: '20px' }}>
        <h4 style={{ padding: '16px 16px 0 16px', margin: 0, color: '#065f46' }}>
          🤰 Currently Pregnant ({activePregnancies.length})
        </h4>
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Hospital ID</th>
              <th>Expected Delivery</th>
              <th>Last Visit</th>
              <th>Weeks</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {activePregnancies.length > 0 ? (
              activePregnancies.map(p => {
                const latestVisit = p?.visits?.[0];
                const weeks = latestVisit?.gestationalWeeks || '—';
                
                return (
                  <tr key={p.id}>
                    <td>{p?.patient?.firstName} {p?.patient?.lastName}</td>
                    <td><strong>{p?.patient?.hospitalId}</strong></td>
                    <td>{p?.expectedDelivery ? new Date(p.expectedDelivery).toLocaleDateString() : '—'}</td>
                    <td>
                      {latestVisit ? new Date(latestVisit.visitDate).toLocaleDateString() : '—'}
                    </td>
                    <td>{weeks !== '—' ? `${weeks} weeks` : '—'}</td>
                    <td>
                      <span className={`role-badge status-active`}>
                        {p?.status || 'Active'}
                      </span>
                    </td>
                    <td>
                      <Link to={`/pregnancy/${p.id}`} className="btn btn-sm btn-secondary">
                        📂 Open
                      </Link>
                      {canRecordVitals && (
                        <Link to={`/pregnancy/${p.id}?tab=visits`} className="btn btn-sm btn-primary" style={{ marginLeft: '5px' }}>
                          📋 Vitals
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan="7" className="text-center">No active pregnancies.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ Delivered Pregnancies List - Always visible */}
      <div className="table-container" style={{ marginBottom: '20px' }}>
        <h4 style={{ padding: '16px 16px 0 16px', margin: 0, color: '#6b7280' }}>
          📋 Completed / Delivered ({deliveredPregnancies.length})
        </h4>
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Hospital ID</th>
              <th>Delivery Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {deliveredPregnancies.length > 0 ? (
              deliveredPregnancies.map(p => {
                // ✅ Get delivery date from delivery record or fallback
                let deliveryDate = '—';
                if (p?.delivery?.deliveryDate) {
                  deliveryDate = new Date(p.delivery.deliveryDate).toLocaleDateString();
                } else if (p?.updatedAt) {
                  deliveryDate = new Date(p.updatedAt).toLocaleDateString();
                }
                
                return (
                  <tr key={p.id}>
                    <td>{p?.patient?.firstName} {p?.patient?.lastName}</td>
                    <td><strong>{p?.patient?.hospitalId}</strong></td>
                    <td>{deliveryDate}</td>
                    <td>
                      <span className={`role-badge status-inactive`}>
                        {p?.status || 'Delivered'}
                      </span>
                    </td>
                    <td>
                      <Link to={`/pregnancy/${p.id}`} className="btn btn-sm btn-secondary">
                        📂 View
                      </Link>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan="5" className="text-center" style={{ color: '#9ca3af' }}>
                No completed/delivered pregnancies yet.
                <br />
                <span style={{ fontSize: '12px' }}>
                  💡 To mark a pregnancy as delivered, go to the pregnancy profile and click "Record Delivery".
                </span>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Role-based info banner */}
      <div style={{ 
        marginTop: '20px', 
        padding: '12px 16px', 
        background: '#f8fafc', 
        borderRadius: '8px',
        fontSize: '13px',
        color: '#6b7280',
        border: '1px solid #e8ecf1'
      }}>
        <strong>ℹ️ Role Info:</strong>
        {isNurseOrMidwife && ' 👩‍⚕️ You have permission to record vitals for patients.'}
        {isDoctorOrObstetrician && ' 👨‍⚕️ You have permission to review patient records and manage pregnancies.'}
        {user?.role === 'BillingOfficer' && ' 💰 You have view-only access to patient records.'}
        {!canRecordVitals && ' 📋 Vitals should be recorded by nursing staff.'}
      </div>
    </div>
  );
};

export default AntenatalDashboard;