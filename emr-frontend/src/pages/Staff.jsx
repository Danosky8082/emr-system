import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';

const Staff = () => {
  const { token } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/staff', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStaff(res.data);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Staff Management</h2>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.employeeId}</strong></td>
                <td>{s.firstName} {s.lastName}</td>
                <td>{s.email}</td>
                <td><span className="role-badge">{s.role}</span></td>
                <td>{s.department || '-'}</td>
                <td>{s.isActive ? '✅ Yes' : '❌ No'}</td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr><td colSpan="6" className="text-center">No staff found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Staff;