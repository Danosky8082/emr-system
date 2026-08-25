// src/components/LeaveEntitlement.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const LeaveEntitlement = () => {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entitlements, setEntitlements] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [bulkData, setBulkData] = useState({
    year: new Date().getFullYear(),
    annualLeaveDays: 21,
    sickLeaveDays: 10,
    studyLeaveDays: 5,
    maternityLeaveDays: 90,
    paternityLeaveDays: 14
  });
  const [policyData, setPolicyData] = useState({
    defaultAnnualDays: 21,
    defaultSickDays: 10,
    defaultStudyDays: 5,
    defaultMaternityDays: 90,
    defaultPaternityDays: 14,
    maxCarryOverDays: 5,
    reminderDays: 30
  });

  const isHR = ['HR', 'Admin', 'ITAdmin'].includes(user?.role);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [entitlementRes, policyRes] = await Promise.all([
        axios.get(`http://localhost:3000/api/hr/leave-entitlement?year=${selectedYear}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:3000/api/hr/leave-policy', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setEntitlements(entitlementRes.data);
      setPolicy(policyRes.data);
      if (policyRes.data) {
        setPolicyData({
          defaultAnnualDays: policyRes.data.defaultAnnualDays || 21,
          defaultSickDays: policyRes.data.defaultSickDays || 10,
          defaultStudyDays: policyRes.data.defaultStudyDays || 5,
          defaultMaternityDays: policyRes.data.defaultMaternityDays || 90,
          defaultPaternityDays: policyRes.data.defaultPaternityDays || 14,
          maxCarryOverDays: policyRes.data.maxCarryOverDays || 5,
          reminderDays: policyRes.data.reminderDays || 30
        });
      }
    } catch (error) {
      console.error('Fetch data error:', error);
      toast.error('Failed to load leave entitlement data');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/hr/leave-entitlement/bulk', bulkData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Bulk leave entitlements created successfully!');
      setShowBulkModal(false);
      fetchData();
    } catch (error) {
      console.error('Bulk create error:', error);
      toast.error('Failed to create bulk entitlements');
    }
  };

  const handleUpdatePolicy = async (e) => {
    e.preventDefault();
    try {
      await axios.put('http://localhost:3000/api/hr/leave-policy', policyData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Leave policy updated successfully!');
      setShowPolicyModal(false);
      fetchData();
    } catch (error) {
      console.error('Update policy error:', error);
      toast.error('Failed to update leave policy');
    }
  };

  const getLeaveStatusColor = (remaining, total) => {
    const percentage = (remaining / total) * 100;
    if (percentage > 50) return '#10b981';
    if (percentage > 25) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) return <div className="spinner" />;

  if (!isHR) {
    return (
      <div className="leave-entitlement-container">
        <h3>My Leave Balance - {selectedYear}</h3>
        {/* Staff view - show only their own balance */}
        <div className="leave-balance-grid">
          {/* Will be implemented for staff view */}
        </div>
      </div>
    );
  }

  return (
    <div className="leave-entitlement-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h2>📋 Annual Leave Entitlement - {selectedYear}</h2>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            Manage annual leave allocations for all staff members
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              background: 'white'
            }}
          >
            {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowBulkModal(true)}
            style={{
              background: '#0f3460',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            📤 Bulk Setup
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowPolicyModal(true)}
            style={{
              background: '#e5e7eb',
              color: '#1f2937',
              border: '1px solid #d1d5db',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            ⚙️ Policy
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={fetchData}
            style={{
              background: '#e5e7eb',
              color: '#1f2937',
              border: '1px solid #d1d5db',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Entitlement Table */}
      <div className="table-container" style={{ marginTop: '16px' }}>
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Employee ID</th>
              <th>Department</th>
              <th>Annual Leave</th>
              <th>Remaining</th>
              <th>Sick Leave</th>
              <th>Study Leave</th>
              <th>Carried Over</th>
              <th>Total Available</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entitlements.length === 0 ? (
              <tr><td colSpan="10" className="text-center">
                No leave entitlements found for {selectedYear}. 
                <br />
                <button className="btn btn-sm btn-primary" onClick={() => setShowBulkModal(true)} style={{ marginTop: '8px' }}>
                  Create Bulk Entitlements
                </button>
              </td></tr>
            ) : (
              entitlements.map(ent => {
                const remaining = ent.remainingAnnualDays || 0;
                const total = ent.annualLeaveDays || 0;
                const statusColor = getLeaveStatusColor(remaining, total);
                
                return (
                  <tr key={ent.id}>
                    <td>
                      <strong>{ent.staff?.firstName} {ent.staff?.lastName}</strong>
                    </td>
                    <td>{ent.staff?.employeeId}</td>
                    <td>{ent.staff?.department?.name || '—'}</td>
                    <td>{ent.annualLeaveDays || 0} days</td>
                    <td>
                      <span style={{ 
                        color: statusColor, 
                        fontWeight: '600',
                        background: `${statusColor}20`,
                        padding: '2px 10px',
                        borderRadius: '12px'
                      }}>
                        {remaining} days
                      </span>
                    </td>
                    <td>{ent.sickLeaveDays || 0} days</td>
                    <td>{ent.studyLeaveDays || 0} days</td>
                    <td>{ent.carriedOverDays || 0} days</td>
                    <td><strong>{ent.totalAvailableDays || 0} days</strong></td>
                    <td>
                      <button 
                        className="btn btn-sm btn-edit"
                        onClick={() => {
                          // Edit individual entitlement
                          const newDays = prompt(`Enter annual leave days for ${ent.staff?.firstName} ${ent.staff?.lastName}:`, ent.annualLeaveDays);
                          if (newDays !== null) {
                            // Update entitlement
                          }
                        }}
                        style={{
                          background: '#0f3460',
                          color: 'white',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        ✏️ Edit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk Setup Modal */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>📤 Bulk Leave Entitlement Setup</h3>
              <button className="modal-close" onClick={() => setShowBulkModal(false)}>×</button>
            </div>
            <form onSubmit={handleBulkCreate}>
              <div className="modal-body">
                <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
                  This will create or update leave entitlements for ALL active staff members for the selected year.
                  <br />
                  <strong>Note:</strong> New employees will get pro-rata based on their start date.
                </p>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Year *</label>
                    <input 
                      type="number" 
                      value={bulkData.year} 
                      onChange={(e) => setBulkData({...bulkData, year: parseInt(e.target.value)})}
                      min={new Date().getFullYear() - 1}
                      max={new Date().getFullYear() + 1}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Annual Leave Days</label>
                    <input 
                      type="number" 
                      value={bulkData.annualLeaveDays} 
                      onChange={(e) => setBulkData({...bulkData, annualLeaveDays: parseFloat(e.target.value)})}
                      min="0"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Sick Leave Days</label>
                    <input 
                      type="number" 
                      value={bulkData.sickLeaveDays} 
                      onChange={(e) => setBulkData({...bulkData, sickLeaveDays: parseFloat(e.target.value)})}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Study Leave Days</label>
                    <input 
                      type="number" 
                      value={bulkData.studyLeaveDays} 
                      onChange={(e) => setBulkData({...bulkData, studyLeaveDays: parseFloat(e.target.value)})}
                      min="0"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Maternity Leave Days</label>
                    <input 
                      type="number" 
                      value={bulkData.maternityLeaveDays} 
                      onChange={(e) => setBulkData({...bulkData, maternityLeaveDays: parseFloat(e.target.value)})}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Paternity Leave Days</label>
                    <input 
                      type="number" 
                      value={bulkData.paternityLeaveDays} 
                      onChange={(e) => setBulkData({...bulkData, paternityLeaveDays: parseFloat(e.target.value)})}
                      min="0"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBulkModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Entitlements</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Policy Modal */}
      {showPolicyModal && (
        <div className="modal-overlay" onClick={() => setShowPolicyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>⚙️ Leave Policy Settings</h3>
              <button className="modal-close" onClick={() => setShowPolicyModal(false)}>×</button>
            </div>
            <form onSubmit={handleUpdatePolicy}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Default Annual Leave (days)</label>
                    <input 
                      type="number" 
                      value={policyData.defaultAnnualDays} 
                      onChange={(e) => setPolicyData({...policyData, defaultAnnualDays: parseFloat(e.target.value)})}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Default Sick Leave (days)</label>
                    <input 
                      type="number" 
                      value={policyData.defaultSickDays} 
                      onChange={(e) => setPolicyData({...policyData, defaultSickDays: parseFloat(e.target.value)})}
                      min="0"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Default Study Leave (days)</label>
                    <input 
                      type="number" 
                      value={policyData.defaultStudyDays} 
                      onChange={(e) => setPolicyData({...policyData, defaultStudyDays: parseFloat(e.target.value)})}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Max Carry Over (days)</label>
                    <input 
                      type="number" 
                      value={policyData.maxCarryOverDays} 
                      onChange={(e) => setPolicyData({...policyData, maxCarryOverDays: parseFloat(e.target.value)})}
                      min="0"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Default Maternity Leave (days)</label>
                    <input 
                      type="number" 
                      value={policyData.defaultMaternityDays} 
                      onChange={(e) => setPolicyData({...policyData, defaultMaternityDays: parseFloat(e.target.value)})}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Default Paternity Leave (days)</label>
                    <input 
                      type="number" 
                      value={policyData.defaultPaternityDays} 
                      onChange={(e) => setPolicyData({...policyData, defaultPaternityDays: parseFloat(e.target.value)})}
                      min="0"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Reminder Days (before leave)</label>
                  <input 
                    type="number" 
                    value={policyData.reminderDays} 
                    onChange={(e) => setPolicyData({...policyData, reminderDays: parseInt(e.target.value)})}
                    min="0"
                  />
                  <small>Days before leave start to send reminders</small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPolicyModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Policy</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveEntitlement;