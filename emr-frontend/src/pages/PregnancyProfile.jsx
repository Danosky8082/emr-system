// src/pages/PregnancyProfile.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import './Dashboard.css';

const PregnancyProfile = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  
  const isNew = location.pathname.includes('/pregnancy/new') || id === 'new' || !id;

  const [activeTab, setActiveTab] = useState('overview');
  const [pregnancy, setPregnancy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- State for creating a new pregnancy ---
  const [newPregnancy, setNewPregnancy] = useState({
    patientId: '',
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
    heartRate: '',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, location.pathname]);

  // --- Handlers for creating a new pregnancy ---
  const handleNewPregnancyChange = (e) => {
    const { name, value } = e.target;
    setNewPregnancy((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreatePregnancy = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        patientId: newPregnancy.patientId,
        expectedDelivery: newPregnancy.expectedDelivery,
        gravida: parseInt(newPregnancy.gravida) || undefined,
        para: parseInt(newPregnancy.para) || undefined,
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
    setSaving(true);
    try {
      await axios.post(
        `http://localhost:3000/api/pregnancies/${id}/visits`,
        {
          ...newVisit,
          gestationalWeeks: parseInt(newVisit.gestationalWeeks) || null,
          heartRate: parseInt(newVisit.heartRate) || null,
          weight: parseFloat(newVisit.weight) || null,
          fundalHeight: parseFloat(newVisit.fundalHeight) || null,
          staffId: user?.id,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Visit recorded successfully');
      setShowVisitModal(false);
      setNewVisit({
        visitDate: new Date().toISOString().slice(0, 16),
        gestationalWeeks: '',
        bloodPressure: '',
        heartRate: '',
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
        `http://localhost:3000/api/pregnancies/${id}/delivery`,
        {
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
    console.log('🔍 Updating pregnancy - ID:', id);
    console.log('🔍 New status:', newStatus);
    
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
  // RENDER FOR NEW PREGNANCY
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
              Register New Pregnancy
            </h2>
          </div>
        </div>

        <div style={{
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          marginTop: '20px'
        }}>
          <div style={{
            padding: '24px 32px',
            borderBottom: '1px solid #e8ecf1',
            background: '#f8fafc'
          }}>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1a1a2e' }}>
              🤰 New Pregnancy Registration
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
              Enter the patient details and expected delivery information
            </p>
          </div>
          <div style={{ padding: '32px' }}>
            <form onSubmit={handleCreatePregnancy}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '20px'
              }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '14px', color: '#374151', marginBottom: '6px' }}>
                      Patient Hospital ID <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="patientId"
                      value={newPregnancy.patientId}
                      onChange={handleNewPregnancyChange}
                      required
                      className="form-control"
                      placeholder="e.g., 000001"
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
                    />
                    <small style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                      Enter the patient's unique hospital ID
                    </small>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '600', fontSize: '14px', color: '#374151', marginBottom: '6px' }}>
                    Expected Delivery Date <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    name="expectedDelivery"
                    value={newPregnancy.expectedDelivery}
                    onChange={handleNewPregnancyChange}
                    required
                    className="form-control"
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '600', fontSize: '14px', color: '#374151', marginBottom: '6px' }}>
                    Estimated Due Date
                  </label>
                  <input
                    type="date"
                    name="estimatedDueDate"
                    value={newPregnancy.estimatedDueDate}
                    onChange={handleNewPregnancyChange}
                    className="form-control"
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '600', fontSize: '14px', color: '#374151', marginBottom: '6px' }}>
                    Gravida
                  </label>
                  <input
                    type="number"
                    name="gravida"
                    value={newPregnancy.gravida}
                    onChange={handleNewPregnancyChange}
                    className="form-control"
                    placeholder="Number of pregnancies"
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '600', fontSize: '14px', color: '#374151', marginBottom: '6px' }}>
                    Para
                  </label>
                  <input
                    type="number"
                    name="para"
                    value={newPregnancy.para}
                    onChange={handleNewPregnancyChange}
                    className="form-control"
                    placeholder="Number of deliveries"
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '600', fontSize: '14px', color: '#374151', marginBottom: '6px' }}>
                    Last Menstrual Period
                  </label>
                  <input
                    type="date"
                    name="lastMenstrualPeriod"
                    value={newPregnancy.lastMenstrualPeriod}
                    onChange={handleNewPregnancyChange}
                    className="form-control"
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '600', fontSize: '14px', color: '#374151', marginBottom: '6px' }}>
                    Risk Level
                  </label>
                  <select
                    name="riskLevel"
                    value={newPregnancy.riskLevel}
                    onChange={handleNewPregnancyChange}
                    className="form-control"
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: 'white' }}
                  >
                    <option value="Low">🟢 Low Risk</option>
                    <option value="Medium">🟡 Medium Risk</option>
                    <option value="High">🔴 High Risk</option>
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '14px', color: '#374151', marginBottom: '6px' }}>
                      Notes
                    </label>
                    <textarea
                      name="notes"
                      value={newPregnancy.notes}
                      onChange={handleNewPregnancyChange}
                      className="form-control"
                      rows="3"
                      placeholder="Any additional notes or observations..."
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }}
                    />
                  </div>
                </div>
              </div>

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
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER FOR EXISTING PREGNANCY - IMPROVED UI
  // ============================================================
  if (!pregnancy) {
    return (
      <div className="dashboard">
        <div className="alert alert-danger">Pregnancy not found</div>
      </div>
    );
  }

  const { patient, visits, delivery } = pregnancy;
  const sortedVisits = visits?.slice().sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate)) || [];

  return (
    <div className="dashboard" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <Link to="/antenatal" className="btn btn-secondary btn-sm" style={{ marginBottom: '16px', display: 'inline-block' }}>
            ← Back to Antenatal List
          </Link>
          <h2 style={{ fontSize: '28px', fontWeight: '700', margin: '8px 0 0 0', color: '#1a1a2e' }}>
            Pregnancy Profile
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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

          {/* Visits Tab */}
          {activeTab === 'visits' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>Antenatal Visits</h4>
                <button className="btn btn-primary btn-sm" onClick={() => setShowVisitModal(true)}>
                  ➕ Add Visit
                </button>
              </div>
              {sortedVisits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                  <p style={{ fontSize: '16px', marginBottom: '16px' }}>No visits recorded yet.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr>
                        <th style={{ background: '#f8fafc', padding: '10px 12px', fontSize: '12px', textTransform: 'uppercase', color: '#6b7280', fontWeight: '600', letterSpacing: '0.5px', textAlign: 'left' }}>Date</th>
                        <th style={{ background: '#f8fafc', padding: '10px 12px', fontSize: '12px', textTransform: 'uppercase', color: '#6b7280', fontWeight: '600', letterSpacing: '0.5px', textAlign: 'left' }}>Weeks</th>
                        <th style={{ background: '#f8fafc', padding: '10px 12px', fontSize: '12px', textTransform: 'uppercase', color: '#6b7280', fontWeight: '600', letterSpacing: '0.5px', textAlign: 'left' }}>BP</th>
                        <th style={{ background: '#f8fafc', padding: '10px 12px', fontSize: '12px', textTransform: 'uppercase', color: '#6b7280', fontWeight: '600', letterSpacing: '0.5px', textAlign: 'left' }}>FHR</th>
                        <th style={{ background: '#f8fafc', padding: '10px 12px', fontSize: '12px', textTransform: 'uppercase', color: '#6b7280', fontWeight: '600', letterSpacing: '0.5px', textAlign: 'left' }}>Weight</th>
                        <th style={{ background: '#f8fafc', padding: '10px 12px', fontSize: '12px', textTransform: 'uppercase', color: '#6b7280', fontWeight: '600', letterSpacing: '0.5px', textAlign: 'left' }}>Fundal Height</th>
                        <th style={{ background: '#f8fafc', padding: '10px 12px', fontSize: '12px', textTransform: 'uppercase', color: '#6b7280', fontWeight: '600', letterSpacing: '0.5px', textAlign: 'left' }}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedVisits.map((visit) => (
                        <tr key={visit.id}>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f2f5' }}>{new Date(visit.visitDate).toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f2f5' }}>{visit.gestationalWeeks ?? '—'}</td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f2f5' }}>{visit.bloodPressure || '—'}</td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f2f5' }}>{visit.heartRate ?? '—'}</td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f2f5' }}>{visit.weight ? `${visit.weight} kg` : '—'}</td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f2f5' }}>{visit.fundalHeight ? `${visit.fundalHeight} cm` : '—'}</td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f2f5' }}>{visit.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Delivery Tab */}
          {activeTab === 'delivery' && (
            <div>
              {delivery ? (
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '24px' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>Delivery Details</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</span>
                      <span style={{ fontSize: '15px', color: '#1a1a2e', marginTop: '2px' }}>{new Date(delivery.deliveryDate).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</span>
                      <span style={{ fontSize: '15px', color: '#1a1a2e', marginTop: '2px', fontWeight: '600', color: '#0f3460' }}>{delivery.type}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Duration</span>
                      <span style={{ fontSize: '15px', color: '#1a1a2e', marginTop: '2px' }}>{delivery.durationHours ? `${delivery.durationHours} hours` : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Baby Gender</span>
                      <span style={{ fontSize: '15px', color: '#1a1a2e', marginTop: '2px', fontWeight: '600' }}>{delivery.babyGender}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Baby Weight</span>
                      <span style={{ fontSize: '15px', color: '#1a1a2e', marginTop: '2px' }}>{delivery.babyWeight ? `${delivery.babyWeight} kg` : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Apgar Score</span>
                      <span style={{ fontSize: '15px', color: '#1a1a2e', marginTop: '2px' }}>{delivery.babyApgar ?? '—'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Outcome</span>
                      <span style={{
                        padding: '2px 12px',
                        borderRadius: '12px',
                        fontWeight: '600',
                        fontSize: '13px',
                        display: 'inline-block',
                        width: 'fit-content',
                        background: delivery.outcome === 'Live birth' ? '#d1fae5' : '#fee2e2',
                        color: delivery.outcome === 'Live birth' ? '#065f46' : '#991b1b'
                      }}>
                        {delivery.outcome}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Attending Staff</span>
                      <span style={{ fontSize: '15px', color: '#1a1a2e', marginTop: '2px' }}>{delivery.staff?.firstName} {delivery.staff?.lastName} ({delivery.staff?.role})</span>
                    </div>
                  </div>
                  {delivery.notes && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e8ecf1' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</span>
                      <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#374151', whiteSpace: 'pre-wrap' }}>{delivery.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                  <p style={{ fontSize: '16px', marginBottom: '16px' }}>No delivery recorded yet.</p>
                  {pregnancy.status === 'Active' && (
                    <button className="btn btn-success" onClick={() => setShowDeliveryModal(true)}>
                      🩺 Record Delivery
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Add Visit */}
      {showVisitModal && (
        <div className="modal-overlay" onClick={() => setShowVisitModal(false)}>
          <div className="modal" style={{ maxWidth: '600px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5>Record Antenatal Visit</h5>
              <button className="close" onClick={() => setShowVisitModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddVisit}>
                <div className="form-group">
                  <label>Visit Date &amp; Time</label>
                  <input type="datetime-local" name="visitDate" value={newVisit.visitDate} onChange={handleVisitInputChange} required className="form-control" />
                </div>
                <div className="form-group">
                  <label>Gestational Weeks</label>
                  <input type="number" name="gestationalWeeks" value={newVisit.gestationalWeeks} onChange={handleVisitInputChange} className="form-control" />
                </div>
                <div className="form-group">
                  <label>Blood Pressure (e.g., 120/80)</label>
                  <input type="text" name="bloodPressure" value={newVisit.bloodPressure} onChange={handleVisitInputChange} className="form-control" placeholder="120/80" />
                </div>
                <div className="form-group">
                  <label>Fetal Heart Rate (bpm)</label>
                  <input type="number" name="heartRate" value={newVisit.heartRate} onChange={handleVisitInputChange} className="form-control" />
                </div>
                <div className="form-group">
                  <label>Maternal Weight (kg)</label>
                  <input type="number" step="0.1" name="weight" value={newVisit.weight} onChange={handleVisitInputChange} className="form-control" />
                </div>
                <div className="form-group">
                  <label>Fundal Height (cm)</label>
                  <input type="number" step="0.1" name="fundalHeight" value={newVisit.fundalHeight} onChange={handleVisitInputChange} className="form-control" />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea name="notes" value={newVisit.notes} onChange={handleVisitInputChange} className="form-control" rows="3" />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowVisitModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Visit'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Record Delivery */}
      {showDeliveryModal && (
        <div className="modal-overlay" onClick={() => setShowDeliveryModal(false)}>
          <div className="modal" style={{ maxWidth: '600px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5>Record Delivery</h5>
              <button className="close" onClick={() => setShowDeliveryModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleRecordDelivery}>
                <div className="form-group">
                  <label>Delivery Date &amp; Time</label>
                  <input type="datetime-local" name="deliveryDate" value={newDelivery.deliveryDate} onChange={handleDeliveryInputChange} required className="form-control" />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select name="type" value={newDelivery.type} onChange={handleDeliveryInputChange} className="form-control">
                    <option value="Vaginal">Vaginal</option>
                    <option value="C-section">C-section</option>
                    <option value="Assisted">Assisted</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Duration (hours)</label>
                  <input type="number" step="0.5" name="durationHours" value={newDelivery.durationHours} onChange={handleDeliveryInputChange} className="form-control" />
                </div>
                <div className="form-group">
                  <label>Baby Gender</label>
                  <select name="babyGender" value={newDelivery.babyGender} onChange={handleDeliveryInputChange} className="form-control">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Baby Weight (kg)</label>
                  <input type="number" step="0.01" name="babyWeight" value={newDelivery.babyWeight} onChange={handleDeliveryInputChange} className="form-control" />
                </div>
                <div className="form-group">
                  <label>Apgar Score</label>
                  <input type="number" name="babyApgar" value={newDelivery.babyApgar} onChange={handleDeliveryInputChange} className="form-control" min="0" max="10" />
                </div>
                <div className="form-group">
                  <label>Outcome</label>
                  <select name="outcome" value={newDelivery.outcome} onChange={handleDeliveryInputChange} className="form-control">
                    <option value="Live birth">Live birth</option>
                    <option value="Stillbirth">Stillbirth</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea name="notes" value={newDelivery.notes} onChange={handleDeliveryInputChange} className="form-control" rows="3" />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDeliveryModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Saving...' : 'Record Delivery'}</button>
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