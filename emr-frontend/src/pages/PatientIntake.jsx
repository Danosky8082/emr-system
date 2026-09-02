// src/pages/PatientIntake.jsx - COMPLETE WITH FIXED ACTION BUTTON LOGIC

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';
import PatientCard from '../components/PatientCard';
import { Link } from 'react-router-dom';

const PatientIntake = () => {
  const { token } = useAuth();
  const [journeys, setJourneys] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [wards, setWards] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardPatient, setCardPatient] = useState(null);
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [reverseReason, setReverseReason] = useState('');
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnToStage, setReturnToStage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // ✅ DESTINATION MODAL STATE
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [destinationForm, setDestinationForm] = useState({
    destinationType: 'CLINIC',
    clinicId: '',
    wardId: ''
  });

  // Wallet state
  const [walletBalances, setWalletBalances] = useState({});
  const [showWalletInfo, setShowWalletInfo] = useState({});
  const [loadingWallet, setLoadingWallet] = useState({});

  const [newJourney, setNewJourney] = useState({
    patientId: '',
    destinationType: 'CLINIC',
    clinicId: '',
    wardId: ''
  });

  // Get category info
  const getCategoryInfo = (category) => {
    const map = {
      'FPP': { label: '💰 FPP', className: 'category-fpp', tooltip: 'Free Paying Patient - Full Payment' },
      'NHIS': { label: '🏥 NHIS', className: 'category-nhis', tooltip: 'National Health Insurance - 10% Payment' },
      'CORPORATE': { label: '🏢 Corporate', className: 'category-corporate', tooltip: 'Corporate/Company - Double Rate' },
    };
    return map[category] || map['FPP'];
  };

  // Fetch wallet balance for a patient
  const fetchWalletBalance = async (patientId) => {
    if (loadingWallet[patientId]) return;

    setLoadingWallet(prev => ({ ...prev, [patientId]: true }));
    try {
      const res = await axios.get(`http://localhost:3000/api/patients/${patientId}/wallet`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWalletBalances(prev => ({ ...prev, [patientId]: res.data.balance || 0 }));
      return res.data.balance;
    } catch (error) {
      console.error('Failed to fetch wallet:', error);
      return null;
    } finally {
      setLoadingWallet(prev => ({ ...prev, [patientId]: false }));
    }
  };

  // Toggle wallet info display
  const toggleWalletInfo = (patientId) => {
    setShowWalletInfo(prev => ({
      ...prev,
      [patientId]: !prev[patientId]
    }));
    if (!walletBalances[patientId]) {
      fetchWalletBalance(patientId);
    }
  };

  // ✅ FETCH TODAY'S APPOINTMENTS
  const fetchTodayAppointments = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const res = await axios.get(
        `http://localhost:3000/api/appointments?dateFrom=${today.toISOString()}&dateTo=${tomorrow.toISOString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Only show Scheduled appointments
      const filtered = res.data.filter(a =>
        a.status === 'Scheduled' && a.status !== 'Cancelled'
      );

      filtered.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
      setTodayAppointments(filtered);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [journeyRes, clinicRes, wardRes] = await Promise.all([
        axios.get('http://localhost:3000/api/patient-journeys', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:3000/api/clinics', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:3000/api/wards', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const journeysWithDetails = journeyRes.data.map((journey) => {
        return {
          ...journey,
          patient: {
            ...journey.patient,
            isArchived: journey.patient?.isArchived || false,
            patientCategory: journey.patient?.patientCategory || 'FPP',
            insuranceProvider: journey.patient?.insuranceProvider || '',
            insuranceId: journey.patient?.insuranceId || '',
            corporateCompany: journey.patient?.corporateCompany || '',
          }
        };
      });

      setJourneys(journeysWithDetails);
      setClinics(clinicRes.data);
      setWards(wardRes.data);

      // ✅ Fetch appointments
      await fetchTodayAppointments();

    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to load intake data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, refreshKey]);

  const getStatusColor = (status) => {
    const map = {
      'REGISTERED': '#3b4a5a',
      'PENDING_BILLING': '#b45309',
      'BILLING_CLEARED': '#047857',
      'CARD_PRINTED': '#6d28d9',
      'SENT_TO_DESTINATION': '#0e7490',
      'COMPLETED': '#1d4ed8'
    };
    return map[status] || '#6b7280';
  };

  const getStatusLabel = (status) => {
    const map = {
      'REGISTERED': '📝 Registered',
      'PENDING_BILLING': '💰 Pending Billing',
      'BILLING_CLEARED': '✅ Billing Cleared',
      'CARD_PRINTED': '🖨️ Card Printed',
      'SENT_TO_DESTINATION': '🚑 Sent to Dest.',
      'COMPLETED': '🎉 Completed'
    };
    return map[status] || status;
  };

  const handleStartJourney = async (e) => {
    e.preventDefault();
    if (!newJourney.patientId) {
      toast.error('Please enter a Patient Hospital ID');
      return;
    }
    if (newJourney.destinationType === 'CLINIC' && !newJourney.clinicId) {
      toast.error('Please select a Clinic');
      return;
    }
    if (newJourney.destinationType === 'WARD' && !newJourney.wardId) {
      toast.error('Please select a Ward');
      return;
    }

    try {
      const payload = {
        patientId: newJourney.patientId,
        destinationType: newJourney.destinationType,
        clinicId: newJourney.destinationType === 'CLINIC' ? newJourney.clinicId : null,
        wardId: newJourney.destinationType === 'WARD' ? newJourney.wardId : null
      };

      await axios.post('http://localhost:3000/api/patient-journeys', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Patient intake started successfully!');
      setShowModal(false);
      setNewJourney({ patientId: '', destinationType: 'CLINIC', clinicId: '', wardId: '' });
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to start intake');
    }
  };

  const handleStatusUpdate = async (journeyId, status) => {
    if (!journeyId) {
      toast.error('Invalid journey ID');
      return;
    }
    
    try {
      console.log(`📤 Updating journey ${journeyId} to status: ${status}`);
      
      const response = await axios.patch(
        `http://localhost:3000/api/patient-journeys/${journeyId}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('✅ Status update response:', response.data);
      toast.success(`Status updated to ${status.replace(/_/g, ' ')}`);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('❌ Status update error:', error);
      console.error('❌ Error response:', error.response?.data);
      
      if (error.response?.status === 404) {
        toast.error('Journey not found. Please refresh the page.');
      } else if (error.response?.status === 403) {
        toast.error('You do not have permission to update this journey.');
      } else {
        toast.error(error.response?.data?.error || 'Failed to update status');
      }
    }
  };

  const handleReverseJourney = async () => {
    if (!selectedJourney) return;
    if (!reverseReason) {
      toast.error('Please provide a reason for reversing');
      return;
    }

    try {
      await axios.patch(`http://localhost:3000/api/patient-journeys/${selectedJourney.id}/reverse`,
        { reason: reverseReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Journey reversed successfully!');
      setShowReverseModal(false);
      setReverseReason('');
      setSelectedJourney(null);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reverse journey');
    }
  };

  const handleReturnToStage = async () => {
    if (!selectedJourney || !returnToStage) {
      toast.error('Please select a target stage');
      return;
    }

    const reason = prompt('Please provide a reason for returning to this stage:');
    if (!reason) return;

    try {
      await axios.patch(`http://localhost:3000/api/patient-journeys/${selectedJourney.id}/return-to-stage`,
        { targetStatus: returnToStage, reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Patient returned to ${returnToStage} successfully!`);
      setShowReturnModal(false);
      setReturnToStage('');
      setSelectedJourney(null);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to return to stage');
    }
  };

  // ✅ HANDLE UPDATE DESTINATION
  const handleUpdateDestination = async (e) => {
    e.preventDefault();
    if (!selectedJourney) return;
    
    try {
      await axios.patch(
        `http://localhost:3000/api/patient-journeys/${selectedJourney.id}`,
        {
          destinationType: destinationForm.destinationType,
          clinicId: destinationForm.destinationType === 'CLINIC' ? destinationForm.clinicId : null,
          wardId: destinationForm.destinationType === 'WARD' ? destinationForm.wardId : null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Destination updated successfully!');
      setShowDestinationModal(false);
      setSelectedJourney(null);
      setDestinationForm({
        destinationType: 'CLINIC',
        clinicId: '',
        wardId: ''
      });
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update destination');
    }
  };

  const handleArchivePatient = async (patient) => {
    if (!patient || !patient.id) {
      toast.error('Patient data is incomplete. Please refresh the page and try again.');
      console.error('Archive error: Patient data is missing ID', patient);
      return;
    }

    const reason = prompt(`Reason for archiving ${patient.firstName} ${patient.lastName} (optional):`);

    try {
      await axios.post(`http://localhost:3000/api/patients/${patient.id}/archive`,
        { reason: reason || 'Manual archive' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${patient.firstName} ${patient.lastName} archived successfully!`);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Archive error:', error);
      toast.error(error.response?.data?.error || 'Failed to archive patient');
    }
  };

  const handleUnarchivePatient = async (patient) => {
    if (!patient || !patient.id) {
      toast.error('Invalid patient data. Please refresh and try again.');
      return;
    }

    if (!window.confirm(`Are you sure you want to unarchive ${patient.firstName} ${patient.lastName}?`)) return;

    try {
      await axios.post(`http://localhost:3000/api/patients/${patient.id}/unarchive`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${patient.firstName} ${patient.lastName} unarchived successfully!`);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to unarchive patient');
    }
  };

  const handleReprintCard = async (journey) => {
    try {
      const res = await axios.post(`http://localhost:3000/api/patient-journeys/${journey.id}/reprint-card`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCardPatient(res.data.patient);
      setShowCardModal(true);
      toast.success('Card reprint recorded');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reprint card');
    }
  };

  const handlePrintCard = (patient) => {
    setCardPatient(patient);
    setShowCardModal(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const getAvailableStages = (currentStatus) => {
    const stages = ['REGISTERED', 'PENDING_BILLING', 'BILLING_CLEARED', 'CARD_PRINTED', 'SENT_TO_DESTINATION', 'COMPLETED'];
    const currentIndex = stages.indexOf(currentStatus);
    return stages.slice(0, currentIndex);
  };

  // ✅ Check if patient has appointment today
  const hasAppointmentToday = (patientId) => {
    return todayAppointments.some(a => a.patientId === patientId && a.status !== 'Cancelled');
  };

  // ✅ Get appointment details for patient
  const getAppointmentForPatient = (patientId) => {
    return todayAppointments.find(a => a.patientId === patientId && a.status !== 'Cancelled');
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Patient Intake Pipeline</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              toast.success('Refreshing data...');
              setRefreshKey(prev => prev + 1);
            }}
            style={{
              background: '#0f3460',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Start New Patient Intake
          </button>
        </div>
      </div>

      {/* ✅ TODAY'S APPOINTMENTS BANNER */}
      {todayAppointments.length > 0 && (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '16px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '20px' }}>📅</span>
            <div>
              <strong style={{ fontSize: '15px' }}>Today's Appointments</strong>
              <span style={{ marginLeft: '8px', fontSize: '14px', color: '#6b7280' }}>
                {todayAppointments.length} patient(s) have appointments today
              </span>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {todayAppointments.slice(0, 3).map(a => {
                const patient = a.Patient || a.patient;
                const staff = a.Staff || a.staff;
                return (
                  <span key={a.id} style={{
                    padding: '4px 12px',
                    borderRadius: '16px',
                    background: '#dbeafe',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#1e40af',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    👤 {patient?.firstName} {patient?.lastName}
                    <span style={{ fontWeight: '400', color: '#6b7280' }}>
                      {new Date(a.dateTime).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                );
              })}
              {todayAppointments.length > 3 && (
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  background: '#f3f4f6',
                  fontSize: '12px',
                  color: '#6b7280'
                }}>
                  +{todayAppointments.length - 3} more
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Hospital ID</th>
              <th>Patient Name</th>
              <th>Category</th>
              <th>📅 Appt</th>
              <th>Destination</th>
              <th>Status</th>
              <th>💳 Wallet</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {journeys.map(j => {
              // ✅ DEFINE ACTION BASED ON STATUS
              let action = null;
              const isCompleted = j.status === 'COMPLETED';
              const patient = j.patient;
              const categoryInfo = getCategoryInfo(patient?.patientCategory);
              const walletBalance = walletBalances[patient?.id];
              const showWallet = showWalletInfo[patient?.id];
              const isLoadingWallet = loadingWallet[patient?.id];
              const hasAppt = hasAppointmentToday(patient?.id);
              const appt = getAppointmentForPatient(patient?.id);

              // ✅ Define actions based on status
              if (j.status === 'REGISTERED') {
                action = { label: '💰 Send to Billing', status: 'PENDING_BILLING' };
              } else if (j.status === 'BILLING_CLEARED') {
                action = { label: '🖨️ Mark Card Printed', status: 'CARD_PRINTED' };
              } else if (j.status === 'CARD_PRINTED') {
                action = { label: '🚑 Send to Destination', status: 'SENT_TO_DESTINATION' };
              } else if (j.status === 'SENT_TO_DESTINATION') {
                action = { label: '🎉 Mark Completed', status: 'COMPLETED' };
              }

              const destinationName = j.destinationType === 'WARD'
                ? j.ward?.name
                : j.clinic?.name;

              const showCardButton = ['BILLING_CLEARED', 'CARD_PRINTED', 'SENT_TO_DESTINATION', 'COMPLETED'].includes(j.status);
              const showReprintButton = j.status === 'COMPLETED' && j.cardGeneratedAt;
              const showReverseButton = j.status === 'COMPLETED' || j.status === 'SENT_TO_DESTINATION';
              const showReturnButton = j.status !== 'REGISTERED';

              return (
                <tr key={j.id} style={hasAppt ? { background: '#eff6ff' } : {}}>
                  <td><strong>{patient?.hospitalId}</strong></td>
                  <td>
                    {patient?.firstName} {patient?.lastName}
                    {hasAppt && (
                      <span style={{
                        marginLeft: '8px',
                        padding: '2px 8px',
                        background: '#3b82f6',
                        color: 'white',
                        fontSize: '10px',
                        borderRadius: '10px',
                        fontWeight: '600'
                      }}>
                        📅 Appt
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`category-badge ${categoryInfo.className}`}
                      title={categoryInfo.tooltip}
                      style={{
                        display: 'inline-block',
                        padding: '3px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {categoryInfo.label}
                    </span>
                    {patient?.patientCategory === 'NHIS' && patient?.insuranceProvider && (
                      <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                        {patient.insuranceProvider}
                      </div>
                    )}
                    {patient?.patientCategory === 'CORPORATE' && patient?.corporateCompany && (
                      <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                        {patient.corporateCompany}
                      </div>
                    )}
                  </td>
                  <td>
                    {hasAppt && appt ? (
                      <div style={{ fontSize: '12px' }}>
                        <span style={{ fontWeight: '600', color: '#0f3460' }}>
                          🕐 {new Date(appt.dateTime).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div style={{ fontSize: '10px', color: '#6b7280' }}>
                          Dr. {appt.Staff?.firstName} {appt.Staff?.lastName}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: '#6b7280', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td>
                    {destinationName || '—'}
                    <span style={{ fontSize: '0.75rem', color: '#ccc', marginLeft: '5px' }}>
                      ({j.destinationType})
                    </span>
                  </td>
                  <td>
                    <span
                      className="role-badge"
                      style={{ backgroundColor: getStatusColor(j.status), color: '#ffffff', fontWeight: 600, border: 'none' }}
                    >
                      {getStatusLabel(j.status)}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm"
                      onClick={() => toggleWalletInfo(patient?.id)}
                      style={{
                        background: walletBalance > 0 ? '#10b981' : '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 10px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: '600',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        minWidth: '60px',
                        justifyContent: 'center'
                      }}
                    >
                      {isLoadingWallet ? '⏳' : `💳 ₦${(walletBalance || 0).toLocaleString()}`}
                    </button>

                    {showWallet && patient && walletBalance !== undefined && (
                      <div style={{
                        position: 'absolute',
                        background: '#1a1a2e',
                        color: 'white',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        zIndex: 100,
                        marginTop: '4px',
                        maxWidth: '280px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                      }}
                        onMouseLeave={() => toggleWalletInfo(patient?.id)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <strong>💰 Wallet Balance</strong>
                          <span style={{ color: '#10b981', fontSize: '16px' }}>
                            ₦{walletBalance.toLocaleString()}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', opacity: 0.7, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
                          <div>🖨️ Card Fee: ₦500</div>
                          <div>💊 Consultation: ₦{j.clinicId ? '5,000' : '3,000'}</div>
                          <div style={{ marginTop: '4px', color: walletBalance >= 500 ? '#10b981' : '#ef4444' }}>
                            {walletBalance >= 500 ? '✅ Sufficient for card' : '⚠️ Insufficient for card'}
                          </div>
                        </div>
                      </div>
                    )}
                  </td>
                  <td style={{ minWidth: '450px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                    {showCardButton && (
                      <button
                        className="btn btn-sm"
                        style={{
                          marginRight: '4px',
                          background: '#0f3460',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600',
                          whiteSpace: 'nowrap'
                        }}
                        onClick={() => handlePrintCard(patient)}
                      >
                        🖨️ Print Card
                      </button>
                    )}

                    {showReprintButton && (
                      <button
                        className="btn btn-sm"
                        style={{
                          marginRight: '4px',
                          background: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600',
                          whiteSpace: 'nowrap'
                        }}
                        onClick={() => handleReprintCard(j)}
                      >
                        🔄 Reprint
                      </button>
                    )}

                    {showReverseButton && (
                      <button
                        className="btn btn-sm"
                        style={{
                          marginRight: '4px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600',
                          whiteSpace: 'nowrap'
                        }}
                        onClick={() => {
                          setSelectedJourney(j);
                          setShowReverseModal(true);
                        }}
                      >
                        ↩️ Reverse
                      </button>
                    )}

                    {showReturnButton && !isCompleted && (
                      <button
                        className="btn btn-sm"
                        style={{
                          marginRight: '4px',
                          background: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600',
                          whiteSpace: 'nowrap'
                        }}
                        onClick={() => {
                          setSelectedJourney(j);
                          setReturnToStage('');
                          setShowReturnModal(true);
                        }}
                      >
                        🔄 Return
                      </button>
                    )}

                    {isCompleted && patient && patient.id ? (
                      <button
                        className="btn btn-sm"
                        style={{
                          marginRight: '4px',
                          background: '#6b7280',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600',
                          whiteSpace: 'nowrap'
                        }}
                        onClick={() => handleArchivePatient(patient)}
                      >
                        📦 Archive
                      </button>
                    ) : isCompleted && (
                      <span style={{ fontSize: '11px', color: '#ef4444' }}>
                        ⚠️ No ID
                      </span>
                    )}

                    {/* ✅ UPDATED ACTION BUTTON WITH DESTINATION VALIDATION */}
                    {action ? (
                      action.status === 'PENDING_BILLING' ? (
                        // ✅ Check if destination exists before allowing billing
                        (() => {
                          const hasDestination = j.destinationType === 'CLINIC' 
                            ? j.clinicId 
                            : j.destinationType === 'WARD' 
                              ? j.wardId 
                              : false;
                          
                          return hasDestination ? (
                            <button
                              className="btn btn-sm"
                              style={{
                                background: '#0f3460',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 10px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: '600',
                                whiteSpace: 'nowrap'
                              }}
                              onClick={() => {
                                console.log(`🔄 Updating journey ${j.id} to ${action.status}`);
                                handleStatusUpdate(j.id, action.status);
                              }}
                            >
                              {action.label}
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm"
                              style={{
                                background: '#f59e0b',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 10px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: '600',
                                whiteSpace: 'nowrap'
                              }}
                              onClick={() => {
                                toast.error(
                                  '⚠️ Please set a Clinic or Ward first before sending to billing.',
                                  { duration: 5000 }
                                );
                                setShowDestinationModal(true);
                                setSelectedJourney(j);
                                setDestinationForm({
                                  destinationType: j.destinationType || 'CLINIC',
                                  clinicId: j.clinicId || '',
                                  wardId: j.wardId || ''
                                });
                              }}
                              title="Click to set destination"
                            >
                              ⚠️ Set Destination First
                            </button>
                          );
                        })()
                      ) : (
                        <button
                          className="btn btn-sm"
                          style={{
                            background: '#0f3460',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '600',
                            whiteSpace: 'nowrap'
                          }}
                          onClick={() => {
                            console.log(`🔄 Updating journey ${j.id} to ${action.status}`);
                            handleStatusUpdate(j.id, action.status);
                          }}
                        >
                          {action.label}
                        </button>
                      )
                    ) : (
                      <span style={{ opacity: 0.6, fontSize: '12px', color: '#6b7280' }}>End of process</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {journeys.length === 0 && <tr><td colSpan="8" className="text-center">No active patient intakes. Start a new one!</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Reverse Modal */}
      {showReverseModal && selectedJourney && (
        <div className="modal-overlay" onClick={() => setShowReverseModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>↩️ Reverse Journey</h3>
              <button className="modal-close" onClick={() => setShowReverseModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p><strong>Patient:</strong> {selectedJourney.patient?.firstName} {selectedJourney.patient?.lastName}</p>
              <p><strong>Current Status:</strong> {getStatusLabel(selectedJourney.status)}</p>
              <p><strong>Destination:</strong> {selectedJourney.clinic?.name || selectedJourney.ward?.name || 'N/A'}</p>

              <div className="form-group">
                <label>Reason for Reversing <span style={{ color: 'red' }}>*</span></label>
                <textarea
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  className="form-control"
                  rows="3"
                  placeholder="Please explain why this journey needs to be reversed..."
                  required
                />
                <small style={{ color: '#ef4444' }}>
                  ⚠️ This will undo the completion and move the patient back to SENT_TO_DESTINATION.
                </small>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowReverseModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleReverseJourney}>Confirm Reverse</button>
            </div>
          </div>
        </div>
      )}

      {/* Return to Stage Modal */}
      {showReturnModal && selectedJourney && (
        <div className="modal-overlay" onClick={() => setShowReturnModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>🔄 Return to Previous Stage</h3>
              <button className="modal-close" onClick={() => setShowReturnModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p><strong>Patient:</strong> {selectedJourney.patient?.firstName} {selectedJourney.patient?.lastName}</p>
              <p><strong>Current Status:</strong> {getStatusLabel(selectedJourney.status)}</p>

              <div className="form-group">
                <label>Return to Stage <span style={{ color: 'red' }}>*</span></label>
                <select
                  value={returnToStage}
                  onChange={(e) => setReturnToStage(e.target.value)}
                  className="form-control"
                  required
                >
                  <option value="">Select a stage...</option>
                  {getAvailableStages(selectedJourney.status).map(stage => (
                    <option key={stage} value={stage}>{getStatusLabel(stage)}</option>
                  ))}
                </select>
                <small style={{ color: '#ef4444' }}>
                  ⚠️ This will move the patient backward in the pipeline. Some data may be cleared.
                </small>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowReturnModal(false)}>Cancel</button>
              <button className="btn btn-warning" onClick={handleReturnToStage}>Confirm Return</button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ DESTINATION MODAL */}
      {showDestinationModal && selectedJourney && (
        <div className="modal-overlay" onClick={() => setShowDestinationModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>📍 Set Destination</h3>
              <button className="modal-close" onClick={() => setShowDestinationModal(false)}>×</button>
            </div>
            <form onSubmit={handleUpdateDestination}>
              <div className="modal-body">
                <div style={{
                  background: '#fef3c7',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <p style={{ margin: 0, color: '#92400e' }}>
                    ⚠️ A destination (Clinic or Ward) is required before sending to billing.
                  </p>
                </div>
                
                <div style={{
                  background: '#f8fafc',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <p style={{ margin: 0 }}>
                    <strong>Patient:</strong> {selectedJourney.patient?.firstName} {selectedJourney.patient?.lastName}
                  </p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                    ID: {selectedJourney.patient?.hospitalId}
                  </p>
                </div>
                
                <div className="form-group">
                  <label>Destination Type *</label>
                  <select
                    value={destinationForm.destinationType}
                    onChange={(e) => setDestinationForm({
                      ...destinationForm,
                      destinationType: e.target.value,
                      clinicId: '',
                      wardId: ''
                    })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="CLINIC">🏥 Clinic (Outpatient)</option>
                    <option value="WARD">🛏️ Ward (Inpatient)</option>
                  </select>
                </div>
                
                {destinationForm.destinationType === 'CLINIC' && (
                  <div className="form-group">
                    <label>Select Clinic *</label>
                    <select
                      value={destinationForm.clinicId}
                      onChange={(e) => setDestinationForm({...destinationForm, clinicId: e.target.value})}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="">Select Clinic...</option>
                      {clinics.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {destinationForm.destinationType === 'WARD' && (
                  <div className="form-group">
                    <label>Select Ward *</label>
                    <select
                      value={destinationForm.wardId}
                      onChange={(e) => setDestinationForm({...destinationForm, wardId: e.target.value})}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="">Select Ward...</option>
                      {wards.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div style={{
                  background: '#eff6ff',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginTop: '16px'
                }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#1e3a5f' }}>
                    💡 The billing amount may vary based on the selected destination.
                  </p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDestinationModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  ✅ Set Destination
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient Card Modal */}
      {showCardModal && cardPatient && (
        <div className="modal-overlay" onClick={() => setShowCardModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px', padding: '30px', backgroundColor: '#f8f9fa' }}>
            <div className="modal-header">
              <h3>🖨️ Print Patient Card</h3>
              <button className="modal-close" onClick={() => setShowCardModal(false)}>×</button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
              <PatientCard patient={cardPatient} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowCardModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={handlePrint}>🖨️ Print Card</button>
            </div>
          </div>
        </div>
      )}

      {/* Start Intake Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Start Patient Intake</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleStartJourney}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Patient Hospital ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 000007"
                    value={newJourney.patientId}
                    onChange={e => setNewJourney({ ...newJourney, patientId: e.target.value })}
                  />
                  <small>Ensure the patient is already registered in the system.</small>
                </div>
                <div className="form-group">
                  <label>Destination Type *</label>
                  <select
                    required
                    value={newJourney.destinationType}
                    onChange={e => {
                      setNewJourney({
                        ...newJourney,
                        destinationType: e.target.value,
                        clinicId: '',
                        wardId: ''
                      });
                    }}
                  >
                    <option value="CLINIC">Clinic (Outpatient)</option>
                    <option value="WARD">Ward (Inpatient / ADT)</option>
                  </select>
                </div>
                {newJourney.destinationType === 'CLINIC' && (
                  <div className="form-group">
                    <label>Select Clinic *</label>
                    <select
                      required
                      value={newJourney.clinicId}
                      onChange={e => setNewJourney({ ...newJourney, clinicId: e.target.value })}
                    >
                      <option value="">-- Choose a Clinic --</option>
                      {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                {newJourney.destinationType === 'WARD' && (
                  <div className="form-group">
                    <label>Select Ward *</label>
                    <select
                      required
                      value={newJourney.wardId}
                      onChange={e => setNewJourney({ ...newJourney, wardId: e.target.value })}
                    >
                      <option value="">-- Choose a Ward --</option>
                      {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Start Intake</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientIntake;