import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import { useSearch } from '../components/Layout'; // <--- IMPORT

const Appointments = () => {
  const { token } = useAuth();
  const { searchTerm } = useSearch(); // <--- GET SEARCH TERM
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Declare fetch function FIRST
  const fetchAppointments = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/appointments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAppointments(res.data);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Then use it in useEffect
  useEffect(() => {
    fetchAppointments();
  }, []);

  // --- FILTER LOGIC APPLIED HERE ---
  const filteredAppointments = appointments.filter(a => {
    const patientName = `${a.patient?.firstName || ''} ${a.patient?.lastName || ''}`.toLowerCase();
    const doctorName = `${a.staff?.firstName || ''} ${a.staff?.lastName || ''}`.toLowerCase();
    const searchString = `${patientName} ${doctorName} ${a.type || ''} ${a.status || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  if (loading) return <div className="spinner" />;

  const getStatusClass = (status) => {
    const map = {
      'Scheduled': 'status-scheduled',
      'Completed': 'status-completed',
      'Cancelled': 'status-cancelled',
      'CheckedIn': 'status-scheduled',
      'InProgress': 'status-scheduled',
      'NoShow': 'status-cancelled'
    };
    return map[status] || 'status-pending';
  };

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Appointments</h2>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Date/Time</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredAppointments.map((a) => (
              <tr key={a.id}>
                <td>{a.patient?.firstName} {a.patient?.lastName || 'N/A'}</td>
                <td>{a.staff?.firstName} {a.staff?.lastName || 'N/A'}</td>
                <td>{new Date(a.dateTime).toLocaleString()}</td>
                <td>{a.type}</td>
                <td><span className={`status-badge ${getStatusClass(a.status)}`}>{a.status}</span></td>
              </tr>
            ))}
            {filteredAppointments.length === 0 && (
              <tr><td colSpan="5" className="text-center">No appointments found matching that search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Appointments;