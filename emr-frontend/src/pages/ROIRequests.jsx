// src/pages/ROIRequests.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import { useSearch } from '../components/Layout';
import toast from 'react-hot-toast';

const ROIRequests = () => {
  const { token } = useAuth();
  const { searchTerm } = useSearch();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/roi', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(res.data);
    } catch (error) {
      console.error('Error fetching ROI:', error);
      toast.error('Failed to load ROI requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const filteredRequests = requests.filter(r => 
    `${r.requestorName} ${r.patientName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStatusChange = async (id, newStatus) => {
    try {
      await axios.patch(`http://localhost:3000/api/roi/${id}`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Request ${newStatus} successfully`);
      fetchRequests(); // Refresh list
    } catch (error) {
      toast.error('Failed to update request status');
    }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header"><h2>Release of Information (ROI) Requests</h2></div>
      <div className="table-container">
        <table>
          <thead><tr><th>Requestor</th><th>Patient</th><th>Date Requested</th><th>Request Type</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filteredRequests.map(r => (
              <tr key={r.id}>
                <td><strong>{r.requestorName}</strong></td>
                <td>{r.patientName}</td>
                <td>{new Date(r.requestDate).toLocaleDateString()}</td>
                <td>{r.requestType}</td>
                <td><span className={`status-badge ${r.status === 'Completed' ? 'status-completed' : 'status-scheduled'}`}>{r.status}</span></td>
                <td>
                  {r.status === 'Pending' && (
                    <>
                      <button className="btn btn-sm btn-success" onClick={() => handleStatusChange(r.id, 'Approved')} style={{marginRight:'5px'}}>Approve</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleStatusChange(r.id, 'Denied')}>Deny</button>
                    </>
                  )}
                  {r.status === 'Approved' && (
                    <button className="btn btn-sm btn-primary" onClick={() => handleStatusChange(r.id, 'Completed')}>Mark as Sent</button>
                  )}
                </td>
              </tr>
            ))}
            {filteredRequests.length === 0 && <tr><td colSpan="6" className="text-center">No ROI requests found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default ROIRequests;