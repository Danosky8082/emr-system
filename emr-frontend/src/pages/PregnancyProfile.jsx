// src/pages/PregnancyProfile.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import './Dashboard.css';
import './PregnancyProfile.css'; // ✅ Import new styles

const PregnancyProfile = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { token, user } = useAuth();

  // Check if we're on the 'new' route
  const isNew = location.pathname.includes('/pregnancy/new') || id === 'new' || !id;
  
  // Get patientId from URL query params
  const queryParams = new URLSearchParams(location.search);
  const patientIdFromUrl = queryParams.get('patientId');

  // Role-based permissions
  const isNurseOrMidwife = ['Nurse', 'Midwife'].includes(user?.role);
  const canRecordVitals = isNurseOrMidwife;
  const canManagePregnancy = ['Doctor', 'Obstetrician', 'Admin', 'Records'].includes(user?.role);

  // Check if we should show the visits tab (for vitals)
  const showVisitsTab = canRecordVitals || canManagePregnancy;

  // Get tab from URL (for vitals quick link)
  const tabFromUrl = queryParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'overview');

  const [pregnancy, setPregnancy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- Normal ranges for pregnant women ---
  const VITAL_RANGES = {
    bloodPressureSystolic: { min: 100, max: 130, warning: 'BP too low or too high' },
    bloodPressureDiastolic: { min: 60, max: 85, warning: 'BP too low or too high' },
    heartRate: { min: 60, max: 120, warning: 'Heart rate abnormal' },
    temperature: { min: 36.0, max: 37.5, warning: 'Temperature abnormal' },
    respiratoryRate: { min: 16, max: 24, warning: 'Respiratory rate abnormal' },
    oxygenSaturation: { min: 95, max: 100, warning: 'Oxygen saturation low' },
    fetalHeartRate: { min: 110, max: 160, warning: 'Fetal heart rate abnormal' },
  };

  // --- State for creating a new pregnancy ---
  const [newPregnancy, setNewPregnancy] = useState({
    patientId: patientIdFromUrl || '',
    expectedDelivery: '',
    gravida: '',
    para: '',
    lastMenstrualPeriod: '',
    estimatedDueDate: '',
    riskLevel: 'Low',
    notes: '',
  });

  // --- Modal states ---
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [newVisit, setNewVisit] = useState({
    visitDate: new Date().toISOString().slice(0, 16),
    gestationalWeeks: '',
    bloodPressure: '',
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    heartRate: '',
    fetalHeartRate: '',
    temperature: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    weight: '',
    fundalHeight: '',
    notes: '',
  });

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [newDelivery, setNewDelivery] = useState({
    deliveryDate: new Date().toISOString().slice(0, 16),
    type: 'Vaginal',
    durationHours: '',
    babyGender: 'Male',
    babyWeight: '',
    babyApgar: '',
    outcome: 'Live birth',
    notes: '',
  });

  // --- Validation function ---
  const validateVitals = (field, value) => {
  const range = VITAL_RANGES[field];
  if (!range) return null;
  if (value === '' || value === null || value === undefined) return null;
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return null;
  if (numValue < range.min || numValue > range.max) {
    return range.warning;
  }
  return null;
};


  // --- Check all vitals for warnings ---
  const getVitalWarnings = (vitals) => {
    const warnings = [];
    Object.keys(VITAL_RANGES).forEach(field => {
      const value = vitals[field];
      if (value !== undefined && value !== '' && value !== null) {
        const warning = validateVitals(field, value);
        if (warning) {
          warnings.push({ field, value, warning });
        }
      }
    });
    return warnings;
  };

  // --- Fetch pregnancy ---
  const fetchPregnancy = async () => {
    if (isNew || !id) {
      setLoading(false);
      return;
    }

    try {
      const res = await axios.get(`http://localhost:3000/api/pregnancies/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPregnancy(res.data);
    } catch (error) {
      console.error('Fetch pregnancy error:', error);
      if (!isNew) {
        toast.error('Failed to load pregnancy details');
        navigate('/antenatal');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPregnancy();
  }, [id, location.pathname]);

  // --- Handlers for creating a new pregnancy ---
  const handleNewPregnancyChange = (e) => {
    const { name, value } = e.target;
    setNewPregnancy((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreatePregnancy = async (e) => {
    e.preventDefault();
    if (!newPregnancy.patientId) {
      toast.error('Patient ID is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        patientId: newPregnancy.patientId,
        expectedDelivery: newPregnancy.expectedDelivery,
        gravida: parseInt(newPregnancy.gravida) || 0,
        para: parseInt(newPregnancy.para) || 0,
        lastMenstrualPeriod: newPregnancy.lastMenstrualPeriod || undefined,
        estimatedDueDate: newPregnancy.estimatedDueDate || undefined,
        riskLevel: newPregnancy.riskLevel,
        notes: newPregnancy.notes,
      };
      await axios.post('http://localhost:3000/api/pregnancies', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Pregnancy registered successfully!');
      navigate('/antenatal');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create pregnancy');
    } finally {
      setSaving(false);
    }
  };

  // --- Visit handlers ---
  const handleVisitInputChange = (e) => {
    const { name, value } = e.target;
    setNewVisit((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddVisit = async (e) => {
    e.preventDefault();
    if (!canRecordVitals) {
      toast.error('You do not have permission to record vitals');
      return;
    }
    setSaving(true);
    try {
      const bpSystolic = parseInt(newVisit.bloodPressureSystolic);
      const bpDiastolic = parseInt(newVisit.bloodPressureDiastolic);
      const bloodPressure = bpSystolic && bpDiastolic ? `${bpSystolic}/${bpDiastolic}` : null;

      const warnings = getVitalWarnings(newVisit);
      if (warnings.length > 0) {
        const warningMessages = warnings.map(w => `${w.field}: ${w.warning}`).join(', ');
        if (!window.confirm(`⚠️ The following vitals are outside normal ranges:\n${warningMessages}\n\nDo you want to continue?`)) {
          setSaving(false);
          return;
        }
      }

      await axios.post(
        `http://localhost:3000/api/pregnancies/${id}/visits`,
        {
          visitDate: newVisit.visitDate,
          gestationalWeeks: parseInt(newVisit.gestationalWeeks) || null,
          bloodPressure,
          heartRate: parseInt(newVisit.heartRate) || null,
          weight: parseFloat(newVisit.weight) || null,
          fundalHeight: parseFloat(newVisit.fundalHeight) || null,
          notes: newVisit.fetalHeartRate ? `FHR: ${newVisit.fetalHeartRate} bpm. ${newVisit.notes || ''}` : newVisit.notes,
          staffId: user?.id,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Visit recorded successfully!');
      setShowVisitModal(false);
      setNewVisit({
        visitDate: new Date().toISOString().slice(0, 16),
        gestationalWeeks: '',
        bloodPressure: '',
        bloodPressureSystolic: '',
        bloodPressureDiastolic: '',
        heartRate: '',
        fetalHeartRate: '',
        temperature: '',
        respiratoryRate: '',
        oxygenSaturation: '',
        weight: '',
        fundalHeight: '',
        notes: '',
      });
      fetchPregnancy();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add visit');
    } finally {
      setSaving(false);
    }
  };

  // --- Delivery handlers ---
  const handleDeliveryInputChange = (e) => {
    const { name, value } = e.target;
    setNewDelivery((prev) => ({ ...prev, [name]: value }));
  };

  const handleRecordDelivery = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post(
        'http://localhost:3000/api/deliveries',
        {
          pregnancyId: id,
          ...newDelivery,
          durationHours: parseFloat(newDelivery.durationHours) || null,
          babyWeight: parseFloat(newDelivery.babyWeight) || null,
          babyApgar: parseInt(newDelivery.babyApgar) || null,
          staffId: user?.id,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Delivery recorded successfully');
      setShowDeliveryModal(false);
      setNewDelivery({
        deliveryDate: new Date().toISOString().slice(0, 16),
        type: 'Vaginal',
        durationHours: '',
        babyGender: 'Male',
        babyWeight: '',
        babyApgar: '',
        outcome: 'Live birth',
        notes: '',
      });
      fetchPregnancy();
    } catch (error) {
      console.error('Delivery error:', error);
      toast.error(error.response?.data?.message || 'Failed to record delivery');
    } finally {
      setSaving(false);
    }
  };

  // --- Update pregnancy status ---
  const updatePregnancyStatus = async (newStatus) => {
    if (!id || id === 'new' || id === 'new/') {
      toast.error('Invalid pregnancy ID');
      return;
    }
    try {
      await axios.put(
        `http://localhost:3000/api/pregnancies/${id}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Status updated successfully!');
      fetchPregnancy();
    } catch (error) {
      console.error('Update pregnancy error:', error);
      toast.error(error.response?.data?.error || 'Failed to update status');
    }
  };

  // --- Loading state ---
  if (loading) return <div className="spinner" />;

  // ============================================================
  // RENDER FOR EXISTING PREGNANCY
  // ============================================================
  if (!pregnancy && !isNew) {
    return (
      <div className="dashboard">
        <div className="alert alert-danger">Pregnancy not found</div>
      </div>
    );
  }

  const { patient, visits, delivery } = pregnancy || {};
  const sortedVisits = visits?.slice().sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate)) || [];

  // ============================================================
  // RENDER FOR NEW PREGNANCY (with upgraded form)
  // ============================================================
  if (isNew) {
    return (
      <div className="dashboard" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div className="page-header">
          <div>
            <Link to="/antenatal" className="btn btn-secondary btn-sm" style={{ marginBottom: '16px', display: 'inline-block' }}>
              ← Back to Antenatal List
            </Link>
            <h2 style={{ fontSize: '28px', fontWeight: '700', margin: '8px 0 0 0', color: '#1a1a2e' }}>
              🤰 Register New Pregnancy
            </h2>
            {patientIdFromUrl && (
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
                👤 Patient ID: <strong>{patientIdFromUrl}</strong>
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleCreatePregnancy} className="modern-form">
          {/* Patient Section */}
          <div className="form-section">
            <div className="form-section-title">
              <span className="icon">👤</span> Patient Information
            </div>
            <div className="form-group">
              <label>Patient Hospital ID <span className="required">*</span></label>
              <input
                type="text"
                name="patientId"
                value={newPregnancy.patientId}
                onChange={handleNewPregnancyChange}
                required
                className="form-control"
                placeholder="e.g., 000001"
                readOnly={!!patientIdFromUrl}
              />
              {patientIdFromUrl && (
                <span className="vital-success">Patient ID pre-filled from selection</span>
              )}
            </div>
          </div>

          {/* Pregnancy Details Section */}
          <div className="form-section">
            <div className="form-section-title">
              <span className="icon">📋</span> Pregnancy Details
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Expected Delivery Date <span className="required">*</span></label>
                <input
                  type="date"
                  name="expectedDelivery"
                  value={newPregnancy.expectedDelivery}
                  onChange={handleNewPregnancyChange}
                  required
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label>Estimated Due Date</label>
                <input
                  type="date"
                  name="estimatedDueDate"
                  value={newPregnancy.estimatedDueDate}
                  onChange={handleNewPregnancyChange}
                  className="form-control"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Gravida (Number of Pregnancies)</label>
                <input
                  type="number"
                  name="gravida"
                  value={newPregnancy.gravida}
                  onChange={handleNewPregnancyChange}
                  className="form-control"
                  placeholder="e.g., 2"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label>Para (Number of Deliveries)</label>
                <input
                  type="number"
                  name="para"
                  value={newPregnancy.para}
                  onChange={handleNewPregnancyChange}
                  className="form-control"
                  placeholder="e.g., 1"
                  min="0"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Last Menstrual Period</label>
                <input
                  type="date"
                  name="lastMenstrualPeriod"
                  value={newPregnancy.lastMenstrualPeriod}
                  onChange={handleNewPregnancyChange}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label>Risk Level</label>
                <select
                  name="riskLevel"
                  value={newPregnancy.riskLevel}
                  onChange={handleNewPregnancyChange}
                  className="form-control"
                >
                  <option value="Low">🟢 Low Risk</option>
                  <option value="Medium">🟡 Medium Risk</option>
                  <option value="High">🔴 High Risk</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                name="notes"
                value={newPregnancy.notes}
                onChange={handleNewPregnancyChange}
                className="form-control"
                rows="3"
                placeholder="Any additional notes or observations..."
              />
            </div>
          </div>

          {/* Form Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: '1px solid #e8ecf1'
          }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/antenatal')}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '⏳ Saving...' : '✅ Register Pregnancy'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ============================================================
  // MAIN PREGNANCY PROFILE VIEW
  // ============================================================
  return (
    <div className="dashboard" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <Link to="/antenatal" className="btn btn-secondary btn-sm" style={{ marginBottom: '16px', display: 'inline-block' }}>
            ← Back to Antenatal List
          </Link>
          <h2 style={{ fontSize: '28px', fontWeight: '700', margin: '8px 0 0 0', color: '#1a1a2e' }}>
            🤰 Pregnancy Profile
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
            👤 {patient?.firstName} {patient?.lastName} (ID: {patient?.hospitalId})
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {pregnancy.status === 'Active' && !delivery && (
            <button className="btn btn-success" onClick={() => setShowDeliveryModal(true)}>
              🩺 Record Delivery
            </button>
          )}
          {pregnancy.status === 'Active' && delivery && (
            <button className="btn btn-warning" onClick={() => updatePregnancyStatus('Delivered')}>
              Mark as Delivered
            </button>
          )}
        </div>
      </div>

      {/* Patient Summary Card */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        marginBottom: '24px',
        flexWrap: 'wrap'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          background: 'linear-gradient(135deg, #0f3460, #1a4a7a)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <span style={{ fontSize: '28px' }}>👤</span>
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '600', color: '#1a1a2e' }}>
            {patient?.firstName} {patient?.lastName}
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 24px', marginTop: '4px' }}>
            <span style={{ fontSize: '14px', color: '#374151' }}>
              <strong style={{ color: '#6b7280', fontWeight: '500' }}>Hospital ID:</strong> {patient?.hospitalId}
            </span>
            <span style={{ fontSize: '14px', color: '#374151' }}>
              <strong style={{ color: '#6b7280', fontWeight: '500' }}>DOB:</strong> {new Date(patient?.dateOfBirth).toLocaleDateString()}
            </span>
            <span style={{ fontSize: '14px', color: '#374151' }}>
              <strong style={{ color: '#6b7280', fontWeight: '500' }}>Gender:</strong> {patient?.gender}
            </span>
            <span style={{ fontSize: '14px', color: '#374151' }}>
              <strong style={{ color: '#6b7280', fontWeight: '500' }}>Phone:</strong> {patient?.phone || 'N/A'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
          <span style={{
            padding: '4px 16px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: '600',
            textTransform: 'uppercase',
            background: pregnancy.status === 'Active' ? '#d1fae5' : pregnancy.status === 'Delivered' ? '#dbeafe' : '#fee2e2',
            color: pregnancy.status === 'Active' ? '#065f46' : pregnancy.status === 'Delivered' ? '#1e40af' : '#991b1b'
          }}>
            {pregnancy.status}
          </span>
          <span style={{
            padding: '4px 16px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: '600',
            background: pregnancy.riskLevel === 'Low' ? '#d1fae5' : pregnancy.riskLevel === 'Medium' ? '#fef3c7' : '#fee2e2',
            color: pregnancy.riskLevel === 'Low' ? '#065f46' : pregnancy.riskLevel === 'Medium' ? '#92400e' : '#991b1b'
          }}>
            {pregnancy.riskLevel || 'Not specified'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        overflow: 'hidden'
      }}>
        {/* ... Tab navigation and content remains the same ... */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e8ecf1',
          background: '#f8fafc',
          padding: '0 24px'
        }}>
          <button
            style={{
              padding: '16px 24px',
              background: 'transparent',
              border: 'none',
              fontSize: '15px',
              fontWeight: '500',
              color: activeTab === 'overview' ? '#0f3460' : '#6b7280',
              cursor: 'pointer',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: activeTab === 'overview' ? '3px solid #0f3460' : '3px solid transparent'
            }}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
          </button>
          {showVisitsTab && (
            <button
              style={{
                padding: '16px 24px',
                background: 'transparent',
                border: 'none',
                fontSize: '15px',
                fontWeight: '500',
                color: activeTab === 'visits' ? '#0f3460' : '#6b7280',
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderBottom: activeTab === 'visits' ? '3px solid #0f3460' : '3px solid transparent'
              }}
              onClick={() => setActiveTab('visits')}
            >
              📋 Visits <span style={{
                background: '#e8ecf1',
                color: '#374151',
                padding: '2px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600'
              }}>{visits?.length || 0}</span>
            </button>
          )}
          <button
            style={{
              padding: '16px 24px',
              background: 'transparent',
              border: 'none',
              fontSize: '15px',
              fontWeight: '500',
              color: activeTab === 'delivery' ? '#0f3460' : '#6b7280',
              cursor: 'pointer',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: activeTab === 'delivery' ? '3px solid #0f3460' : '3px solid transparent'
            }}
            onClick={() => setActiveTab('delivery')}
          >
            🏥 Delivery {delivery ? '✅' : '⏳'}
          </button>
        </div>

        <div style={{ padding: '24px 32px' }}>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '20px 24px' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>
                    Pregnancy Details
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Expected Delivery</span>
                      <span style={{ fontSize: '15px', color: '#1a1a2e', marginTop: '2px' }}>{new Date(pregnancy.expectedDelivery).toLocaleDateString()}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Estimated Due Date</span>
                      <span style={{ fontSize: '15px', color: '#1a1a2e', marginTop: '2px' }}>{pregnancy.estimatedDueDate ? new Date(pregnancy.estimatedDueDate).toLocaleDateString() : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gravida</span>
                      <span style={{ fontSize: '15px', color: '#1a1a2e', marginTop: '2px' }}>{pregnancy.gravida !== null && pregnancy.gravida !== undefined ? pregnancy.gravida : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Para</span>
                      <span style={{ fontSize: '15px', color: '#1a1a2e', marginTop: '2px' }}>{pregnancy.para ?? '—'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Risk Level</span>
                      <span style={{
                        padding: '2px 12px',
                        borderRadius: '12px',
                        fontWeight: '600',
                        fontSize: '13px',
                        display: 'inline-block',
                        width: 'fit-content',
                        background: pregnancy.riskLevel === 'Low' ? '#d1fae5' : pregnancy.riskLevel === 'Medium' ? '#fef3c7' : '#fee2e2',
                        color: pregnancy.riskLevel === 'Low' ? '#065f46' : pregnancy.riskLevel === 'Medium' ? '#92400e' : '#991b1b'
                      }}>
                        {pregnancy.riskLevel || 'Not specified'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</span>
                      <span style={{
                        padding: '2px 12px',
                        borderRadius: '12px',
                        fontWeight: '600',
                        fontSize: '13px',
                        display: 'inline-block',
                        width: 'fit-content',
                        background: pregnancy.status === 'Active' ? '#d1fae5' : pregnancy.status === 'Delivered' ? '#dbeafe' : '#fee2e2',
                        color: pregnancy.status === 'Active' ? '#065f46' : pregnancy.status === 'Delivered' ? '#1e40af' : '#991b1b'
                      }}>
                        {pregnancy.status}
                      </span>
                    </div>
                  </div>
                  {pregnancy.notes && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e8ecf1' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</span>
                      <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#374151', whiteSpace: 'pre-wrap' }}>{pregnancy.notes}</p>
                    </div>
                  )}
                </div>

                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '20px 24px' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>
                    Medical Summary
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Allergies</span>
                      <span style={{ fontSize: '15px', color: '#1a1a2e', marginTop: '2px' }}>{patient?.allergies || 'None'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Emergency Contact</span>
                      <span style={{ fontSize: '15px', color: '#1a1a2e', marginTop: '2px' }}>{patient?.emergencyContact || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Next of Kin</span>
                      <span style={{ fontSize: '15px', color: '#1a1a2e', marginTop: '2px' }}>{patient?.nextOfKinName || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Relationship</span>
                      <span style={{ fontSize: '15px', color: '#1a1a2e', marginTop: '2px' }}>{patient?.nextOfKinRelationship || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Next of Kin Phone</span>
                      <span style={{ fontSize: '15px', color: '#1a1a2e', marginTop: '2px' }}>{patient?.nextOfKinPhone || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Visits Tab - Keep existing content */}
          {/* ... */}
        </div>
      </div>

      {/* ===== UPGRADED VISIT MODAL ===== */}
      {showVisitModal && canRecordVitals && (
        <div className="modal-overlay modern-modal" onClick={() => setShowVisitModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Record Antenatal Visit</h3>
              <button className="modal-close" onClick={() => setShowVisitModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddVisit} className="modern-form">
                {/* Visit Date */}
                <div className="form-section">
                  <div className="form-section-title">
                    <span className="icon">📅</span> Visit Information
                  </div>
                  <div className="form-group">
                    <label>Visit Date &amp; Time <span className="required">*</span></label>
                    <input
                      type="datetime-local"
                      name="visitDate"
                      value={newVisit.visitDate}
                      onChange={handleVisitInputChange}
                      required
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Gestational Weeks</label>
                    <input
                      type="number"
                      name="gestationalWeeks"
                      value={newVisit.gestationalWeeks}
                      onChange={handleVisitInputChange}
                      className="form-control"
                      placeholder="e.g., 28"
                      min="0"
                      max="42"
                    />
                    {newVisit.gestationalWeeks && (
                      <span className="helper-text">
                        💡 Fundal height should be ~{newVisit.gestationalWeeks} cm (±2 cm)
                      </span>
                    )}
                  </div>
                </div>

                {/* Vital Signs */}
                <div className="form-section">
                  <div className="form-section-title">
                    <span className="icon">❤️</span> Vital Signs
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Systolic BP (mmHg)</label>
                      <input
                        type="number"
                        name="bloodPressureSystolic"
                        value={newVisit.bloodPressureSystolic}
                        onChange={handleVisitInputChange}
                        className={`form-control ${validateVitals('bloodPressureSystolic', newVisit.bloodPressureSystolic) ? 'has-warning' : ''}`}
                        placeholder="e.g., 120"
                        min="80"
                        max="200"
                      />
                      {validateVitals('bloodPressureSystolic', newVisit.bloodPressureSystolic) && (
                        <span className="vital-warning">{validateVitals('bloodPressureSystolic', newVisit.bloodPressureSystolic)}</span>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Diastolic BP (mmHg)</label>
                      <input
                        type="number"
                        name="bloodPressureDiastolic"
                        value={newVisit.bloodPressureDiastolic}
                        onChange={handleVisitInputChange}
                        className={`form-control ${validateVitals('bloodPressureDiastolic', newVisit.bloodPressureDiastolic) ? 'has-warning' : ''}`}
                        placeholder="e.g., 80"
                        min="40"
                        max="140"
                      />
                      {validateVitals('bloodPressureDiastolic', newVisit.bloodPressureDiastolic) && (
                        <span className="vital-warning">{validateVitals('bloodPressureDiastolic', newVisit.bloodPressureDiastolic)}</span>
                      )}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Maternal Heart Rate (bpm)</label>
                      <input
                        type="number"
                        name="heartRate"
                        value={newVisit.heartRate}
                        onChange={handleVisitInputChange}
                        className={`form-control ${validateVitals('heartRate', newVisit.heartRate) ? 'has-warning' : ''}`}
                        placeholder="e.g., 80"
                        min="40"
                        max="200"
                      />
                      {validateVitals('heartRate', newVisit.heartRate) && (
                        <span className="vital-warning">{validateVitals('heartRate', newVisit.heartRate)}</span>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Fetal Heart Rate (bpm)</label>
                      <input
                        type="number"
                        name="fetalHeartRate"
                        value={newVisit.fetalHeartRate}
                        onChange={handleVisitInputChange}
                        className={`form-control ${validateVitals('fetalHeartRate', newVisit.fetalHeartRate) ? 'has-warning' : ''}`}
                        placeholder="e.g., 140"
                        min="100"
                        max="180"
                      />
                      {validateVitals('fetalHeartRate', newVisit.fetalHeartRate) && (
                        <span className="vital-warning">{validateVitals('fetalHeartRate', newVisit.fetalHeartRate)}</span>
                      )}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Temperature (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        name="temperature"
                        value={newVisit.temperature}
                        onChange={handleVisitInputChange}
                        className={`form-control ${validateVitals('temperature', newVisit.temperature) ? 'has-warning' : ''}`}
                        placeholder="e.g., 36.5"
                        min="35"
                        max="40"
                      />
                      {validateVitals('temperature', newVisit.temperature) && (
                        <span className="vital-warning">{validateVitals('temperature', newVisit.temperature)}</span>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Respiratory Rate (/min)</label>
                      <input
                        type="number"
                        name="respiratoryRate"
                        value={newVisit.respiratoryRate}
                        onChange={handleVisitInputChange}
                        className={`form-control ${validateVitals('respiratoryRate', newVisit.respiratoryRate) ? 'has-warning' : ''}`}
                        placeholder="e.g., 18"
                        min="10"
                        max="40"
                      />
                      {validateVitals('respiratoryRate', newVisit.respiratoryRate) && (
                        <span className="vital-warning">{validateVitals('respiratoryRate', newVisit.respiratoryRate)}</span>
                      )}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Oxygen Saturation (%)</label>
                      <input
                        type="number"
                        name="oxygenSaturation"
                        value={newVisit.oxygenSaturation}
                        onChange={handleVisitInputChange}
                        className={`form-control ${validateVitals('oxygenSaturation', newVisit.oxygenSaturation) ? 'has-warning' : ''}`}
                        placeholder="e.g., 98"
                        min="85"
                        max="100"
                      />
                      {validateVitals('oxygenSaturation', newVisit.oxygenSaturation) && (
                        <span className="vital-warning">{validateVitals('oxygenSaturation', newVisit.oxygenSaturation)}</span>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Maternal Weight (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        name="weight"
                        value={newVisit.weight}
                        onChange={handleVisitInputChange}
                        className="form-control"
                        placeholder="e.g., 65"
                        min="30"
                        max="200"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Fundal Height (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      name="fundalHeight"
                      value={newVisit.fundalHeight}
                      onChange={handleVisitInputChange}
                      className={`form-control ${newVisit.gestationalWeeks && newVisit.fundalHeight && Math.abs(parseFloat(newVisit.fundalHeight) - parseFloat(newVisit.gestationalWeeks)) > 2 ? 'has-warning' : ''}`}
                      placeholder="e.g., 28"
                      min="0"
                      max="50"
                    />
                    {newVisit.gestationalWeeks && newVisit.fundalHeight && (
                      <span className={Math.abs(parseFloat(newVisit.fundalHeight) - parseFloat(newVisit.gestationalWeeks)) > 2 ? 'vital-warning' : 'vital-success'}>
                        {Math.abs(parseFloat(newVisit.fundalHeight) - parseFloat(newVisit.gestationalWeeks)) > 2
                          ? `Fundal height (${newVisit.fundalHeight}cm) is off by more than 2cm from weeks (${newVisit.gestationalWeeks} weeks)`
                          : `Fundal height matches gestational age (${newVisit.gestationalWeeks} weeks)`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="form-section">
                  <div className="form-section-title">
                    <span className="icon">📝</span> Additional Notes
                  </div>
                  <div className="form-group">
                    <label>Notes</label>
                    <textarea
                      name="notes"
                      value={newVisit.notes}
                      onChange={handleVisitInputChange}
                      className="form-control"
                      rows="3"
                      placeholder="Any additional observations or comments..."
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowVisitModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? '⏳ Saving...' : '💾 Save Visit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===== UPGRADED DELIVERY MODAL ===== */}
      {showDeliveryModal && (
        <div className="modal-overlay modern-modal" onClick={() => setShowDeliveryModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🩺 Record Delivery</h3>
              <button className="modal-close" onClick={() => setShowDeliveryModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleRecordDelivery} className="modern-form">
                {/* Delivery Information */}
                <div className="form-section">
                  <div className="form-section-title">
                    <span className="icon">📅</span> Delivery Information
                  </div>
                  <div className="form-group">
                    <label>Delivery Date &amp; Time <span className="required">*</span></label>
                    <input
                      type="datetime-local"
                      name="deliveryDate"
                      value={newDelivery.deliveryDate}
                      onChange={handleDeliveryInputChange}
                      required
                      className="form-control"
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Delivery Type <span className="required">*</span></label>
                      <select
                        name="type"
                        value={newDelivery.type}
                        onChange={handleDeliveryInputChange}
                        className="form-control"
                      >
                        <option value="Vaginal">🤱 Vaginal</option>
                        <option value="C-section">🔪 C-section</option>
                        <option value="Assisted">🩺 Assisted</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Duration (hours)</label>
                      <input
                        type="number"
                        step="0.5"
                        name="durationHours"
                        value={newDelivery.durationHours}
                        onChange={handleDeliveryInputChange}
                        className="form-control"
                        placeholder="e.g., 4.5"
                        min="0"
                        max="72"
                      />
                    </div>
                  </div>
                </div>

                {/* Baby Information */}
                <div className="form-section">
                  <div className="form-section-title">
                    <span className="icon">👶</span> Baby Information
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Baby Gender <span className="required">*</span></label>
                      <select
                        name="babyGender"
                        value={newDelivery.babyGender}
                        onChange={handleDeliveryInputChange}
                        className="form-control"
                      >
                        <option value="Male">👦 Male</option>
                        <option value="Female">👧 Female</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Baby Weight (kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        name="babyWeight"
                        value={newDelivery.babyWeight}
                        onChange={handleDeliveryInputChange}
                        className="form-control"
                        placeholder="e.g., 3.2"
                        min="0.5"
                        max="6"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Apgar Score</label>
                      <input
                        type="number"
                        name="babyApgar"
                        value={newDelivery.babyApgar}
                        onChange={handleDeliveryInputChange}
                        className="form-control"
                        placeholder="e.g., 9"
                        min="0"
                        max="10"
                      />
                      <span className="helper-text">💡 Score ranges from 0-10, typically 7-10 is normal</span>
                    </div>
                    <div className="form-group">
                      <label>Outcome</label>
                      <select
                        name="outcome"
                        value={newDelivery.outcome}
                        onChange={handleDeliveryInputChange}
                        className="form-control"
                      >
                        <option value="Live birth">✅ Live birth</option>
                        <option value="Stillbirth">❌ Stillbirth</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="form-section">
                  <div className="form-section-title">
                    <span className="icon">📝</span> Additional Notes
                  </div>
                  <div className="form-group">
                    <label>Notes</label>
                    <textarea
                      name="notes"
                      value={newDelivery.notes}
                      onChange={handleDeliveryInputChange}
                      className="form-control"
                      rows="3"
                      placeholder="Any additional delivery notes or complications..."
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDeliveryModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success" disabled={saving}>
                    {saving ? '⏳ Saving...' : '✅ Record Delivery'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PregnancyProfile;