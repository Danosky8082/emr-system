// src/pages/LaborDeliveryPage.jsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import './Dashboard.css';

const LaborDeliveryPage = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [pregnancies, setPregnancies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPregnancy, setSelectedPregnancy] = useState(null);

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

  const [showLaborModal, setShowLaborModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [laborStatus, setLaborStatus] = useState(null);

  const fetchPregnancies = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3000/api/pregnancies', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPregnancies(res.data);
    } catch (error) {
      console.error('Fetch pregnancies error:', error);
      toast.error('Failed to load pregnancies');
    } finally {
      setLoading(false);
    }
  };

  const fetchLaborStatus = async (pregnancyId) => {
    try {
      const res = await axios.get(
        `http://localhost:3000/api/pregnancies/${pregnancyId}/labor-status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLaborStatus(res.data);
    } catch (error) {
      console.error('Error fetching labor status:', error);
    }
  };

  useEffect(() => {
    fetchPregnancies();
  }, []);

  const handleStartLabor = async (e) => {
    e.preventDefault();
    if (!selectedPregnancy) return;
    
    try {
      const response = await axios.post(
        `http://localhost:3000/api/pregnancies/${selectedPregnancy.id}/start-labor`,
        laborForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(response.data.message || '✅ Labor started successfully!');
      setShowLaborModal(false);
      await fetchPregnancies();
      await fetchLaborStatus(selectedPregnancy.id);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to start labor');
    }
  };

  const handleRecordDelivery = async (e) => {
    e.preventDefault();
    if (!selectedPregnancy) return;
    
    try {
      const response = await axios.post(
        'http://localhost:3000/api/deliveries',
        {
          pregnancyId: selectedPregnancy.id,
          ...deliveryForm
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(response.data.message || '✅ Delivery recorded successfully!');
      setShowDeliveryModal(false);
      await fetchPregnancies();
      
      if (response.data.baby) {
        setTimeout(() => {
          navigate(`/patient-profile/${response.data.baby.id}`);
        }, 2000);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to record delivery');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Active': '#10b981',
      'In Labor': '#f59e0b',
      'Delivered': '#3b82f6'
    };
    return colors[status] || '#6b7280';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'Active': '✅ Active',
      'In Labor': '🟡 In Labor',
      'Delivered': '📋 Delivered'
    };
    return labels[status] || status;
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>🤱 Labor & Delivery Management</h2>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          👤 {user?.firstName} {user?.lastName} - {user?.role}
        </p>
      </div>

      {/* Pregnancies List */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Hospital ID</th>
              <th>Status</th>
              <th>Expected Delivery</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pregnancies.map(p => (
              <tr key={p.id} style={{
                borderLeft: `4px solid ${getStatusColor(p.status)}`
              }}>
                <td>{p.patient?.firstName} {p.patient?.lastName}</td>
                <td><strong>{p.patient?.hospitalId}</strong></td>
                <td>
                  <span style={{
                    background: getStatusColor(p.status),
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {getStatusLabel(p.status)}
                  </span>
                </td>
                <td>{p.expectedDelivery ? new Date(p.expectedDelivery).toLocaleDateString() : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <Link 
                      to={`/pregnancy/${p.id}`}
                      className="btn btn-sm btn-secondary"
                      style={{
                        background: '#0f3460',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: '600',
                        textDecoration: 'none'
                      }}
                    >
                      📂 Open
                    </Link>
                    
                    {p.status === 'Active' && (
                      <button
                        className="btn btn-sm"
                        style={{
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                        onClick={() => {
                          setSelectedPregnancy(p);
                          setLaborForm({
                            ...laborForm,
                            laborStartTime: new Date().toISOString().slice(0, 16)
                          });
                          setShowLaborModal(true);
                        }}
                      >
                        🟢 Start Labor
                      </button>
                    )}

                    {p.status === 'In Labor' && (
                      <>
                        <button
                          className="btn btn-sm"
                          style={{
                            background: '#f59e0b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                          onClick={() => {
                            setSelectedPregnancy(p);
                            setShowProgressModal(true);
                          }}
                        >
                          📊 Update Progress
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                          onClick={() => {
                            setSelectedPregnancy(p);
                            setDeliveryForm({
                              ...deliveryForm,
                              deliveryDate: new Date().toISOString().slice(0, 16)
                            });
                            setShowDeliveryModal(true);
                          }}
                        >
                          🩺 Record Delivery
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {pregnancies.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center">
                  No pregnancies found. Go to Antenatal to register a pregnancy.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Start Labor Modal */}
      {showLaborModal && selectedPregnancy && (
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
                <button type="submit" className="btn btn-primary">✅ Start Labor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {showProgressModal && selectedPregnancy && (
        <div className="modal-overlay" onClick={() => setShowProgressModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>📊 Update Labor Progress</h3>
              <button className="modal-close" onClick={() => setShowProgressModal(false)}>×</button>
            </div>
            <form onSubmit={() => {}}>
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
                <button type="submit" className="btn btn-primary">✅ Update Progress</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delivery Modal */}
      {showDeliveryModal && selectedPregnancy && (
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
                <button type="submit" className="btn btn-success">✅ Record Delivery</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LaborDeliveryPage;