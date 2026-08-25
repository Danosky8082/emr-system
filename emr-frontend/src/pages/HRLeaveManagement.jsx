// src/pages/HRLeaveManagement.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const HRLeaveManagement = () => {
  const { token, user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [formData, setFormData] = useState({
    staffId: '',
    leaveType: 'Annual',
    startDate: '',
    endDate: '',
    reason: '',
    contactDuringLeave: '',
    substituteId: ''
  });

  const leaveTypes = ['Annual', 'Sick', 'Maternity', 'Paternity', 'Study', 'Unpaid', 'Other'];

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:3000/api/hr/leaves?status=${filterStatus === 'all' ? '' : filterStatus}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLeaves(res.data);
    } catch (error) {
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/hr/employees', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployees(res.data);
    } catch (error) {
      toast.error('Failed to load employees');
    }
  };

  useEffect(() => {
    fetchLeaves();
    fetchEmployees();
  }, [filterStatus]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/hr/leaves', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Leave request created successfully!');
      setShowModal(false);
      resetForm();
      fetchLeaves();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create leave request');
    }
  };

  const resetForm = () => {
    setFormData({
      staffId: '',
      leaveType: 'Annual',
      startDate: '',
      endDate: '',
      reason: '',
      contactDuringLeave: '',
      substituteId: ''
    });
  };

  const handleApproval = async (id, status) => {
    try {
      await axios.patch(`http://localhost:3000/api/hr/leaves/${id}`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Leave ${status.toLowerCase()} successfully`);
      fetchLeaves();
    } catch (error) {
      toast.error('Failed to update leave status');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Pending': '#fef3c7',
      'Approved': '#d1fae5',
      'Rejected': '#fee2e2',
      'Cancelled': '#e5e7eb'
    };
    return colors[status] || '#e5e7eb';
  };

  const getStatusTextColor = (status) => {
    const colors = {
      'Pending': '#92400e',
      'Approved': '#065f46',
      'Rejected': '#991b1b',
      'Cancelled': '#6b7280'
    };
    return colors[status] || '#6b7280';
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>📋 Leave Management</h2>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          + Request Leave
        </button>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '16px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${filterStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus('all')}
          >
            All
          </button>
          <button
            className={`btn btn-sm ${filterStatus === 'Pending' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus('Pending')}
          >
            ⏳ Pending
          </button>
          <button
            className={`btn btn-sm ${filterStatus === 'Approved' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus('Approved')}
          >
            ✅ Approved
          </button>
          <button
            className={`btn btn-sm ${filterStatus === 'Rejected' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus('Rejected')}
          >
            ❌ Rejected
          </button>
        </div>
        <span style={{ fontSize: '13px', color: '#6b7280' }}>
          {leaves.length} requests
        </span>
      </div>

      {/* Leave Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Type</th>
              <th>Duration</th>
              <th>Days</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaves.map(leave => (
              <tr key={leave.id}>
                <td>
                  <strong>{leave.staff?.firstName} {leave.staff?.lastName}</strong>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>
                    {leave.staff?.employeeId}
                  </div>
                </td>
                <td>{leave.leaveType}</td>
                <td>
                  {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                </td>
                <td>{leave.days} days</td>
                <td>{leave.reason || '—'}</td>
                <td>
                  <span style={{
                    background: getStatusColor(leave.status),
                    color: getStatusTextColor(leave.status),
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {leave.status}
                  </span>
                </td>
                <td>
  {leave.status === 'Pending' && (
    <>
      <button 
        className="btn btn-sm btn-success" 
        onClick={() => handleApproval(leave.id, 'Approved')}
        style={{
          background: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '4px 10px',
          cursor: 'pointer',
          fontSize: '11px',
          fontWeight: '600',
          marginRight: '4px'
        }}
      >
        ✅ Approve
      </button>
      <button 
        className="btn btn-sm btn-danger" 
        onClick={() => handleApproval(leave.id, 'Rejected')}
        style={{
          background: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '4px 10px',
          cursor: 'pointer',
          fontSize: '11px',
          fontWeight: '600'
        }}
      >
        ❌ Reject
      </button>
    </>
  )}
  {leave.status === 'Approved' && (
    <button 
      className="btn btn-sm btn-secondary" 
      onClick={() => handleApproval(leave.id, 'Cancelled')}
      style={{
        background: '#e5e7eb',
        color: '#1f2937',
        border: '1px solid #d1d5db',
        borderRadius: '4px',
        padding: '4px 10px',
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: '600'
      }}
    >
      Cancel
    </button>
  )}
  {leave.status === 'Rejected' && (
    <span style={{ fontSize: '12px', color: '#6b7280' }}>No actions</span>
  )}
</td>
              </tr>
            ))}
            {leaves.length === 0 && (
              <tr><td colSpan="7" className="text-center">No leave requests found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Leave Request Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Request Leave</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Employee *</label>
                  <select name="staffId" value={formData.staffId} onChange={handleInputChange} required>
                    <option value="">Select Employee...</option>
                    {employees.filter(e => e.isActive).map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeId})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Leave Type *</label>
                  <select name="leaveType" value={formData.leaveType} onChange={handleInputChange} required>
                    {leaveTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date *</label>
                    <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label>End Date *</label>
                    <input type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Reason</label>
                  <textarea name="reason" value={formData.reason} onChange={handleInputChange} rows="3" placeholder="Reason for leave..." />
                </div>
                <div className="form-group">
                  <label>Contact During Leave</label>
                  <input type="text" name="contactDuringLeave" value={formData.contactDuringLeave} onChange={handleInputChange} placeholder="Phone number or email" />
                </div>
                <div className="form-group">
                  <label>Substitute (Optional)</label>
                  <select name="substituteId" value={formData.substituteId} onChange={handleInputChange}>
                    <option value="">None</option>
                    {employees.filter(e => e.isActive && e.id !== formData.staffId).map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRLeaveManagement;