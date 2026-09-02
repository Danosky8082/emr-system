// src/components/LaborDeliveryTab.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const LaborDeliveryTab = ({ pregnancy, token, onUpdate }) => {
  const navigate = useNavigate();
  const [laborStatus, setLaborStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showLaborModal, setShowLaborModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  // Labor Form
  const [laborForm, setLaborForm] = useState({
    laborStartTime: new Date().toISOString().slice(0, 16),
    contractions: '',
    dilation: '',
    effacement: '',
    bloodPressure: '',
    heartRate: '',
    notes: ''
  });

  // Progress Form
  const [progressForm, setProgressForm] = useState({
    contractions: '',
    dilation: '',
    effacement: '',
    fetalHeartRate: '',
    maternalHeartRate: '',
    bloodPressure: '',
    notes: ''
  });

  // Delivery Form
  const [deliveryForm, setDeliveryForm] = useState({
    deliveryDate: new Date().toISOString().slice(0, 16),
    type: 'Vaginal',
    durationHours: '',
    babyGender: 'Male',
    babyWeight: '',
    babyLength: '',
    babyHeadCircumference: '',
    babyApgar1min: '',
    babyApgar5min: '',
    babyApgar10min: '',
    babyNotes: '',
    maternalCondition: 'Stable',
    complications: '',
    placentaDelivery: 'Complete',
    estimatedBloodLoss: '',
    perinealCondition: 'Intact',
    outcome: 'Live birth',
    notes: ''
  });

  const isInLabor = pregnancy?.status === 'In Labor';
  const isDelivered = pregnancy?.status === 'Delivered';
  const canStartLabor = !isInLabor && !isDelivered;
  const canRecordDelivery = isInLabor && !isDelivered;

  const fetchLaborStatus = async () => {
    try {
      const res = await axios.get(
        `http://localhost:3000/api/pregnancies/${pregnancy.id}/labor-status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLaborStatus(res.data);
    } catch (error) {
      console.error('Error fetching labor status:', error);
    }
  };

  useEffect(() => {
    if (pregnancy?.id) {
      fetchLaborStatus();
      // Auto-refresh every 30 seconds when in labor
      if (isInLabor) {
        const interval = setInterval(fetchLaborStatus, 30000);
        return () => clearInterval(interval);
      }
    }
  }, [pregnancy?.id, isInLabor]);

  const handleStartLabor = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(
        `http://localhost:3000/api/pregnancies/${pregnancy.id}/start-labor`,
        laborForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(response.data.message || '✅ Labor started successfully!');
      setShowLaborModal(false);
      await fetchLaborStatus();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to start labor');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProgress = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.patch(
        `http://localhost:3000/api/pregnancies/${pregnancy.id}/labor-progress`,
        progressForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('✅ Labor progress updated successfully!');
      setShowProgressModal(false);
      await fetchLaborStatus();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update progress');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordDelivery = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(
        'http://localhost:3000/api/deliveries',
        {
          pregnancyId: pregnancy.id,
          ...deliveryForm
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(response.data.message || '✅ Delivery recorded successfully! Baby transferred to Paediatrics.');
      setShowDeliveryModal(false);
      await fetchLaborStatus();
      if (onUpdate) onUpdate();
      
      // Navigate to baby profile
      if (response.data.baby) {
        setTimeout(() => {
          navigate(`/patient-profile/${response.data.baby.id}`);
        }, 2000);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to record delivery');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        marginBottom: '20px'
      }}>
        {canStartLabor && (
          <button
            className="btn btn-primary"
            onClick={() => setShowLaborModal(true)}
            disabled={loading}
            style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            🟢 Start Labor
          </button>
        )}
        {isInLabor && (
          <button
            className="btn btn-secondary"
            onClick={() => setShowProgressModal(true)}
            disabled={loading}
            style={{
              background: '#f59e0b',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            📊 Update Progress
          </button>
        )}
        {canRecordDelivery && (
          <button
            className="btn btn-success"
            onClick={() => setShowDeliveryModal(true)}
            disabled={loading}
            style={{
              background: '#10b981',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            🩺 Record Delivery
          </button>
        )}
        {isDelivered && (
          <span style={{
            padding: '12px 24px',
            background: '#d1fae5',
            borderRadius: '8px',
            color: '#065f46',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            ✅ Delivery Completed
          </span>
        )}
        <button
          className="btn btn-secondary"
          onClick={fetchLaborStatus}
          style={{
            background: '#e5e7eb',
            color: '#1f2937',
            border: '1px solid #d1d5db',
            padding: '12px 24px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Labor Status Card */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        border: `2px solid ${isDelivered ? '#10b981' : isInLabor ? '#f59e0b' : '#e5e7eb'}`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Status</span>
            <div style={{ fontSize: '24px', fontWeight: '700' }}>
              {isDelivered ? '✅ Delivered' : isInLabor ? '🟡 In Labor' : '⏳ Not in Labor'}
            </div>
            {isDelivered && pregnancy?.deliveryDate && (
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                Delivered: {new Date(pregnancy.deliveryDate).toLocaleString()}
              </div>
            )}
          </div>
          {isInLabor && laborStatus?.laborDuration && (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Labor Duration</span>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#dc2626' }}>
                {formatDuration(laborStatus.laborDuration)}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                Started: {laborStatus.laborStartedAt ? new Date(laborStatus.laborStartedAt).toLocaleString() : 'N/A'}
              </div>
            </div>
          )}
        </div>

        {/* Progress Indicators */}
        {isInLabor && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
            gap: '12px',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #e5e7eb'
          }}>
            <div style={{ textAlign: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>Dilation</span>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#dc2626' }}>
                {pregnancy?.dilation || laborStatus?.pregnancy?.dilation || '—'} cm
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>Effacement</span>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#dc2626' }}>
                {pregnancy?.effacement || laborStatus?.pregnancy?.effacement || '—'} %
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>Contractions</span>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>
                {pregnancy?.contractions || laborStatus?.pregnancy?.contractions || 'Not recorded'}
              </div>
            </div>
          </div>
        )}

        {/* Labor Notes */}
        {pregnancy?.laborNotes && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            background: '#f8fafc',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#374151',
            maxHeight: '100px',
            overflowY: 'auto'
          }}>
            <strong>📝 Labor Notes:</strong>
            <pre style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '13px' }}>
              {pregnancy.laborNotes}
            </pre>
          </div>
        )}
      </div>

      {/* Recent Labor Visits */}
      {laborStatus?.pregnancy?.visits && laborStatus.pregnancy.visits.length > 0 && (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
            📋 Labor Progress Log
          </h4>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {laborStatus.pregnancy.visits.map((visit, index) => (
              <div key={visit.id} style={{
                padding: '8px 12px',
                borderBottom: index < laborStatus.pregnancy.visits.length - 1 ? '1px solid #f3f4f6' : 'none',
                fontSize: '13px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '500' }}>{new Date(visit.visitDate).toLocaleString()}</span>
                  <span style={{ color: '#6b7280' }}>by {visit.staff?.firstName} {visit.staff?.lastName}</span>
                </div>
                <div style={{ color: '#374151', marginTop: '2px' }}>{visit.notes}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================
          START LABOR MODAL
          ============================================================ */}
      {showLaborModal && (
        <div className="modal-overlay" onClick={() => setShowLaborModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>🟢 Start Labor</h3>
              <button className="modal-close" onClick={() => setShowLaborModal(false)}>×</button>
            </div>
            <form onSubmit={handleStartLabor}>
              <div className="modal-body">
                <div style={{
                  background: '#fef3c7',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <p style={{ margin: 0, color: '#92400e' }}>
                    ⚠️ Confirm that the patient is in active labor before proceeding.
                  </p>
                </div>

                <div className="form-group">
                  <label>Labor Start Time *</label>
                  <input
                    type="datetime-local"
                    value={laborForm.laborStartTime}
                    onChange={(e) => setLaborForm({...laborForm, laborStartTime: e.target.value})}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Contractions</label>
                    <input
                      type="text"
                      value={laborForm.contractions}
                      onChange={(e) => setLaborForm({...laborForm, contractions: e.target.value})}
                      placeholder="e.g., Every 3-5 min"
                    />
                  </div>
                  <div className="form-group">
                    <label>Dilation (cm)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={laborForm.dilation}
                      onChange={(e) => setLaborForm({...laborForm, dilation: e.target.value})}
                      placeholder="e.g., 4"
                      min="0"
                      max="10"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Effacement (%)</label>
                    <input
                      type="number"
                      value={laborForm.effacement}
                      onChange={(e) => setLaborForm({...laborForm, effacement: e.target.value})}
                      placeholder="e.g., 50"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="form-group">
                    <label>Heart Rate (bpm)</label>
                    <input
                      type="number"
                      value={laborForm.heartRate}
                      onChange={(e) => setLaborForm({...laborForm, heartRate: e.target.value})}
                      placeholder="e.g., 80"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Blood Pressure</label>
                  <input
                    type="text"
                    value={laborForm.bloodPressure}
                    onChange={(e) => setLaborForm({...laborForm, bloodPressure: e.target.value})}
                    placeholder="e.g., 120/80"
                  />
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={laborForm.notes}
                    onChange={(e) => setLaborForm({...laborForm, notes: e.target.value})}
                    rows="2"
                    placeholder="Additional observations..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowLaborModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? '⏳ Starting...' : '✅ Start Labor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          UPDATE PROGRESS MODAL
          ============================================================ */}
      {showProgressModal && (
        <div className="modal-overlay" onClick={() => setShowProgressModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>📊 Update Labor Progress</h3>
              <button className="modal-close" onClick={() => setShowProgressModal(false)}>×</button>
            </div>
            <form onSubmit={handleUpdateProgress}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Contractions</label>
                    <input
                      type="text"
                      value={progressForm.contractions}
                      onChange={(e) => setProgressForm({...progressForm, contractions: e.target.value})}
                      placeholder="e.g., Every 2-3 min"
                    />
                  </div>
                  <div className="form-group">
                    <label>Dilation (cm)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={progressForm.dilation}
                      onChange={(e) => setProgressForm({...progressForm, dilation: e.target.value})}
                      placeholder="e.g., 6"
                      min="0"
                      max="10"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Effacement (%)</label>
                    <input
                      type="number"
                      value={progressForm.effacement}
                      onChange={(e) => setProgressForm({...progressForm, effacement: e.target.value})}
                      placeholder="e.g., 80"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="form-group">
                    <label>Fetal Heart Rate (bpm)</label>
                    <input
                      type="number"
                      value={progressForm.fetalHeartRate}
                      onChange={(e) => setProgressForm({...progressForm, fetalHeartRate: e.target.value})}
                      placeholder="e.g., 140"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Maternal Heart Rate (bpm)</label>
                    <input
                      type="number"
                      value={progressForm.maternalHeartRate}
                      onChange={(e) => setProgressForm({...progressForm, maternalHeartRate: e.target.value})}
                      placeholder="e.g., 90"
                    />
                  </div>
                  <div className="form-group">
                    <label>Blood Pressure</label>
                    <input
                      type="text"
                      value={progressForm.bloodPressure}
                      onChange={(e) => setProgressForm({...progressForm, bloodPressure: e.target.value})}
                      placeholder="e.g., 130/85"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={progressForm.notes}
                    onChange={(e) => setProgressForm({...progressForm, notes: e.target.value})}
                    rows="2"
                    placeholder="Progress notes..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowProgressModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? '⏳ Updating...' : '✅ Update Progress'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          RECORD DELIVERY MODAL
          ============================================================ */}
      {showDeliveryModal && (
        <div className="modal-overlay" onClick={() => setShowDeliveryModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>🩺 Record Delivery</h3>
              <button className="modal-close" onClick={() => setShowDeliveryModal(false)}>×</button>
            </div>
            <form onSubmit={handleRecordDelivery}>
              <div className="modal-body">
                <div style={{
                  background: '#eff6ff',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <p style={{ margin: 0, color: '#1e3a5f' }}>
                    👶 <strong>Baby will be automatically registered and transferred to Paediatrics.</strong>
                  </p>
                </div>

                <h4 style={{ margin: '16px 0 8px 0' }}>📅 Delivery Information</h4>
                <div className="form-group">
                  <label>Delivery Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={deliveryForm.deliveryDate}
                    onChange={(e) => setDeliveryForm({...deliveryForm, deliveryDate: e.target.value})}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Delivery Type *</label>
                    <select
                      value={deliveryForm.type}
                      onChange={(e) => setDeliveryForm({...deliveryForm, type: e.target.value})}
                      required
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
                      value={deliveryForm.durationHours}
                      onChange={(e) => setDeliveryForm({...deliveryForm, durationHours: e.target.value})}
                      placeholder="e.g., 4.5"
                      min="0"
                      max="72"
                    />
                  </div>
                </div>

                <h4 style={{ margin: '16px 0 8px 0' }}>👶 Baby Information</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Baby Gender *</label>
                    <select
                      value={deliveryForm.babyGender}
                      onChange={(e) => setDeliveryForm({...deliveryForm, babyGender: e.target.value})}
                      required
                    >
                      <option value="Male">👦 Male</option>
                      <option value="Female">👧 Female</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Weight (kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={deliveryForm.babyWeight}
                      onChange={(e) => setDeliveryForm({...deliveryForm, babyWeight: e.target.value})}
                      placeholder="e.g., 3.2"
                      min="0.5"
                      max="6"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Length (cm)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={deliveryForm.babyLength}
                      onChange={(e) => setDeliveryForm({...deliveryForm, babyLength: e.target.value})}
                      placeholder="e.g., 50"
                    />
                  </div>
                  <div className="form-group">
                    <label>Head Circumference (cm)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={deliveryForm.babyHeadCircumference}
                      onChange={(e) => setDeliveryForm({...deliveryForm, babyHeadCircumference: e.target.value})}
                      placeholder="e.g., 35"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Apgar 1 min</label>
                    <input
                      type="number"
                      value={deliveryForm.babyApgar1min}
                      onChange={(e) => setDeliveryForm({...deliveryForm, babyApgar1min: e.target.value})}
                      placeholder="0-10"
                      min="0"
                      max="10"
                    />
                  </div>
                  <div className="form-group">
                    <label>Apgar 5 min</label>
                    <input
                      type="number"
                      value={deliveryForm.babyApgar5min}
                      onChange={(e) => setDeliveryForm({...deliveryForm, babyApgar5min: e.target.value})}
                      placeholder="0-10"
                      min="0"
                      max="10"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Apgar 10 min</label>
                  <input
                    type="number"
                    value={deliveryForm.babyApgar10min}
                    onChange={(e) => setDeliveryForm({...deliveryForm, babyApgar10min: e.target.value})}
                    placeholder="0-10"
                    min="0"
                    max="10"
                  />
                </div>

                <div className="form-group">
                  <label>Baby Notes</label>
                  <textarea
                    value={deliveryForm.babyNotes}
                    onChange={(e) => setDeliveryForm({...deliveryForm, babyNotes: e.target.value})}
                    rows="2"
                    placeholder="Any observations about the baby..."
                  />
                </div>

                <h4 style={{ margin: '16px 0 8px 0' }}>👩 Maternal Information</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Maternal Condition</label>
                    <select
                      value={deliveryForm.maternalCondition}
                      onChange={(e) => setDeliveryForm({...deliveryForm, maternalCondition: e.target.value})}
                    >
                      <option value="Stable">✅ Stable</option>
                      <option value="Unstable">⚠️ Unstable</option>
                      <option value="Critical">🔴 Critical</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Estimated Blood Loss (ml)</label>
                    <input
                      type="number"
                      value={deliveryForm.estimatedBloodLoss}
                      onChange={(e) => setDeliveryForm({...deliveryForm, estimatedBloodLoss: e.target.value})}
                      placeholder="e.g., 500"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Placenta Delivery</label>
                    <select
                      value={deliveryForm.placentaDelivery}
                      onChange={(e) => setDeliveryForm({...deliveryForm, placentaDelivery: e.target.value})}
                    >
                      <option value="Complete">✅ Complete</option>
                      <option value="Incomplete">⚠️ Incomplete</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Perineal Condition</label>
                    <select
                      value={deliveryForm.perinealCondition}
                      onChange={(e) => setDeliveryForm({...deliveryForm, perinealCondition: e.target.value})}
                    >
                      <option value="Intact">✅ Intact</option>
                      <option value="Tear">⚠️ Tear</option>
                      <option value="Episiotomy">✂️ Episiotomy</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Complications</label>
                  <input
                    type="text"
                    value={deliveryForm.complications}
                    onChange={(e) => setDeliveryForm({...deliveryForm, complications: e.target.value})}
                    placeholder="e.g., PPH, Cord around neck"
                  />
                </div>

                <div className="form-group">
                  <label>Outcome</label>
                  <select
                    value={deliveryForm.outcome}
                    onChange={(e) => setDeliveryForm({...deliveryForm, outcome: e.target.value})}
                  >
                    <option value="Live birth">✅ Live birth</option>
                    <option value="Stillbirth">❌ Stillbirth</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Additional Notes</label>
                  <textarea
                    value={deliveryForm.notes}
                    onChange={(e) => setDeliveryForm({...deliveryForm, notes: e.target.value})}
                    rows="3"
                    placeholder="Any additional delivery notes or complications..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeliveryModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading ? '⏳ Recording...' : '✅ Record Delivery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LaborDeliveryTab;