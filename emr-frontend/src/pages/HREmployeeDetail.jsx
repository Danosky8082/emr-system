// src/pages/HREmployeeDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const HREmployeeDetail = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await axios.get(`http://localhost:3000/api/hr/employees/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setEmployee(res.data);
      } catch (error) {
        console.error('Fetch employee error:', error);
        toast.error('Failed to load employee details');
        navigate('/hr/employees');
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, [id, token, navigate]);

  if (loading) return <div className="spinner" />;
  if (!employee) return <div>Employee not found</div>;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>👤 Employee Details</h2>
        <div>
          <Link to="/hr/employees" className="btn btn-secondary">← Back to Employees</Link>
          {/* <button 
            className="btn btn-primary" 
            onClick={() => navigate(`/hr/employees/${id}/edit`)}
            style={{ marginLeft: '10px' }}
          >
            ✏️ Edit
          </button> */}
        </div>
      </div>

      <div style={{ 
        background: 'white', 
        borderRadius: '12px', 
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div><strong>Employee ID:</strong> {employee.employeeId}</div>
          <div><strong>Name:</strong> {employee.firstName} {employee.lastName}</div>
          <div><strong>Email:</strong> {employee.email}</div>
          <div><strong>Role:</strong> <span className="role-badge">{employee.role}</span></div>
          <div><strong>Department:</strong> {employee.department?.name || '—'}</div>
          <div><strong>Employment Type:</strong> {employee.employmentType || '—'}</div>
          <div><strong>Gender:</strong> {employee.gender || '—'}</div>
          <div><strong>Date of Birth:</strong> {employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString() : '—'}</div>
          <div><strong>Phone:</strong> {employee.phone || '—'}</div>
          <div><strong>Address:</strong> {employee.address || '—'}</div>
          <div><strong>Emergency Contact:</strong> {employee.emergencyContact || '—'}</div>
          <div><strong>Status:</strong>
            <span className={`status-badge ${employee.isActive ? 'status-active' : 'status-inactive'}`}>
              {employee.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div><strong>Start Date:</strong> {employee.startDate ? new Date(employee.startDate).toLocaleDateString() : '—'}</div>
          <div><strong>Salary:</strong> {employee.salary ? `₦${employee.salary.toLocaleString()}` : '—'}</div>
          <div><strong>Bank:</strong> {employee.bankName || '—'}</div>
          <div><strong>Bank Account:</strong> {employee.bankAccount || '—'}</div>
          <div><strong>Tax ID:</strong> {employee.taxId || '—'}</div>
          <div><strong>National ID:</strong> {employee.nationalId || '—'}</div>
        </div>
      </div>
    </div>
  );
};

export default HREmployeeDetail;