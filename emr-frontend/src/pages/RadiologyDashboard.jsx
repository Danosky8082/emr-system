// src/pages/RadiologyDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';
import ImageUpload from '../components/ImageUpload';

const RadiologyDashboard = () => {
  const { token, user } = useAuth();
  const [imagingOrders, setImagingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0
  });
  const [filter, setFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showViewReportModal, setShowViewReportModal] = useState(false);
  const [resultForm, setResultForm] = useState({
    findings: '',
    impression: '',
    recommendations: '',
    severity: 'Normal'
  });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      console.log('📡 Fetching imaging orders...');
      const res = await axios.get('http://localhost:3000/api/imaging-orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const orders = res.data || [];
      console.log(`✅ Received ${orders.length} orders`);
      
      setImagingOrders(orders);
      
      setStats({
        total: orders.length,
        pending: orders.filter(o => o.status === 'Ordered' || o.status === 'Scheduled').length,
        inProgress: orders.filter(o => o.status === 'In Progress').length,
        completed: orders.filter(o => o.status === 'Completed').length
      });
    } catch (error) {
      console.error('❌ Fetch imaging orders error:', error);
      toast.error('Failed to load imaging orders');
      setImagingOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateStatus = async (orderId, status) => {
    try {
      await axios.patch(`http://localhost:3000/api/imaging-orders/${orderId}/status`, 
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Order status updated to ${status}`);
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleSubmitResults = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    
    try {
      await axios.post(`http://localhost:3000/api/imaging-orders/${selectedOrder.id}/results`,
        resultForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Results submitted successfully!');
      setShowResultModal(false);
      setResultForm({
        findings: '',
        impression: '',
        recommendations: '',
        severity: 'Normal'
      });
      fetchOrders();
    } catch (error) {
      toast.error('Failed to submit results');
    }
  };

  const getImageUrl = (url) => {
  if (!url) return '';
  let cleanUrl = url.trim();
  // If it's already a full URL, return it
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    return cleanUrl;
  }
  // Otherwise, construct the full URL
  const filename = cleanUrl.split('/').pop();
  return `http://localhost:3000/images/${filename}`;
};

  const getStatusColor = (status) => {
    const colors = {
      'Ordered': '#f59e0b',
      'Scheduled': '#3b82f6',
      'In Progress': '#8b5cf6',
      'Completed': '#10b981',
      'Cancelled': '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'Routine': '#3b82f6',
      'Urgent': '#f59e0b',
      'Emergency': '#ef4444'
    };
    return colors[priority] || '#3b82f6';
  };

  const filteredOrders = imagingOrders.filter(order => {
    if (filter === 'all') return true;
    if (filter === 'pending') return ['Ordered', 'Scheduled'].includes(order.status);
    if (filter === 'inprogress') return order.status === 'In Progress';
    if (filter === 'completed') return order.status === 'Completed';
    return true;
  });

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h2>📷 Radiology Dashboard</h2>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            👨‍⚕️ {user?.firstName} {user?.lastName} - {user?.role}
          </p>
        </div>
        <button className="btn btn-primary" onClick={fetchOrders} style={{ background: '#0f3460', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>
          🔄 Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Orders</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="stat-icon">🔄</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#8b5cf6' }}>{stats.inProgress}</div>
            <div className="stat-label">In Progress</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#10b981' }}>{stats.completed}</div>
            <div className="stat-label">Completed (Archived)</div>
          </div>
        </div>
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
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('all')}
            style={filter === 'all' ? { background: '#0f3460', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer' } : { background: '#e5e7eb', color: '#1f2937', border: '1px solid #d1d5db', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer' }}
          >
            All ({stats.total})
          </button>
          <button
            className={`btn btn-sm ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('pending')}
            style={filter === 'pending' ? { background: '#0f3460', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer' } : { background: '#e5e7eb', color: '#1f2937', border: '1px solid #d1d5db', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer' }}
          >
            ⏳ Pending ({stats.pending})
          </button>
          <button
            className={`btn btn-sm ${filter === 'inprogress' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('inprogress')}
            style={filter === 'inprogress' ? { background: '#0f3460', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer' } : { background: '#e5e7eb', color: '#1f2937', border: '1px solid #d1d5db', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer' }}
          >
            🔄 In Progress ({stats.inProgress})
          </button>
          <button
            className={`btn btn-sm ${filter === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('completed')}
            style={filter === 'completed' ? { background: '#0f3460', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer' } : { background: '#e5e7eb', color: '#1f2937', border: '1px solid #d1d5db', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer' }}
          >
            ✅ Completed ({stats.completed})
          </button>
        </div>
        <span style={{ fontSize: '13px', color: '#6b7280' }}>
          {filteredOrders.length} orders
        </span>
      </div>

      {/* Orders Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Order #</th>
              <th>Patient</th>
              <th>Imaging Type</th>
              <th>Body Part</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Ordered By</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length > 0 ? (
              filteredOrders.map(order => (
                <tr key={order.id} style={{ 
                  background: order.status === 'Completed' ? '#f0fdf4' : 
                             order.status === 'In Progress' ? '#eff6ff' : 'white'
                }}>
                  <td><strong>{order.orderNumber || order.id.slice(0, 8)}</strong></td>
                  <td>
                    <div>
                      {order.patient?.firstName} {order.patient?.lastName}
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>
                        ID: {order.patient?.hospitalId}
                      </div>
                    </div>
                  </td>
                  <td>{order.imagingType}</td>
                  <td>{order.bodyPart}</td>
                  <td>
                    <span style={{
                      background: getPriorityColor(order.priority),
                      color: 'white',
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      {order.priority || 'Routine'}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      background: getStatusColor(order.status),
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {order.status || 'Ordered'}
                    </span>
                    {order.status === 'Completed' && order.resultDate && (
                      <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                        Completed: {new Date(order.resultDate).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td>{order.orderingStaff?.firstName} {order.orderingStaff?.lastName}</td>
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {/* START button - Only for "Ordered" status */}
                      {order.status === 'Ordered' && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleUpdateStatus(order.id, 'In Progress')}
                          style={{ 
                            background: '#10b981', 
                            color: 'white', 
                            border: 'none', 
                            padding: '6px 14px', 
                            borderRadius: '6px', 
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          ▶️ Start
                        </button>
                      )}
                      
                      {/* UPLOAD & RESULTS button - For "In Progress" and "Scheduled" */}
                      {(order.status === 'In Progress' || order.status === 'Scheduled') && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowResultModal(true);
                          }}
                          style={{ 
                            background: '#0f3460', 
                            color: 'white', 
                            border: 'none', 
                            padding: '6px 14px', 
                            borderRadius: '6px', 
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          📝 Upload & Results
                        </button>
                      )}
                      
                      {/* ✅ VIEW REPORT button - For "Completed" orders */}
                      {order.status === 'Completed' && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowViewReportModal(true);
                          }}
                          style={{ 
                            background: '#3b82f6', 
                            color: 'white', 
                            border: 'none', 
                            padding: '6px 14px', 
                            borderRadius: '6px', 
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          📄 View Report
                        </button>
                      )}
                      
                      {/* REPRINT button - For "Completed" orders */}
                      {order.status === 'Completed' && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowViewReportModal(true);
                            setTimeout(() => {
                              window.print();
                            }, 500);
                          }}
                          style={{ 
                            background: '#f59e0b', 
                            color: 'white', 
                            border: 'none', 
                            padding: '6px 14px', 
                            borderRadius: '6px', 
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          🖨️ Reprint
                        </button>
                      )}
                      
                      {/* COMPLETE button - For "In Progress" */}
                      {order.status === 'In Progress' && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleUpdateStatus(order.id, 'Completed')}
                          style={{ 
                            background: '#10b981', 
                            color: 'white', 
                            border: 'none', 
                            padding: '6px 14px', 
                            borderRadius: '6px', 
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          ✅ Complete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="text-center">
                  <div style={{ padding: '20px' }}>
                    <p style={{ fontSize: '16px', color: '#6b7280' }}>
                      {filter === 'pending' ? '⏳ No pending orders' :
                       filter === 'inprogress' ? '🔄 No orders in progress' :
                       filter === 'completed' ? '✅ No completed orders yet' :
                       '📷 No imaging orders found'}
                    </p>
                    <p style={{ fontSize: '13px', color: '#9ca3af' }}>
                      {filter === 'completed' 
                        ? 'Completed orders will appear here for future reference and recheck.'
                        : 'Imaging orders will appear here when requested by doctors.'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Completed Orders Archive Info */}
      {stats.completed > 0 && filter === 'all' && (
        <div style={{ 
          marginTop: '16px', 
          padding: '16px 20px', 
          background: '#f0fdf4', 
          borderRadius: '8px',
          border: '1px solid #10b981',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '24px' }}>📚</span>
          <div>
            <strong style={{ color: '#065f46' }}>Archive Summary</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#065f46' }}>
              {stats.completed} completed order(s) available for future review.
              Click <strong>"📄 View Report"</strong> on any completed order to see full results and images.
            </p>
          </div>
        </div>
      )}

      {/* Results Modal with Image Upload */}
      {showResultModal && selectedOrder && (
        <div className="modal-overlay" onClick={() => setShowResultModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <h3>{selectedOrder.status === 'Completed' ? '📄 View Report - Archive' : '📝 Upload Images & Submit Results'}</h3>
              <button className="modal-close" onClick={() => setShowResultModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmitResults}>
              <div className="modal-body">
                <div style={{ 
                  background: selectedOrder.status === 'Completed' ? '#f0fdf4' : '#f8fafc', 
                  padding: '12px 16px', 
                  borderRadius: '8px',
                  marginBottom: '16px',
                  border: selectedOrder.status === 'Completed' ? '1px solid #10b981' : 'none'
                }}>
                  <p style={{ margin: 0 }}>
                    <strong>Order:</strong> {selectedOrder.imagingType} - {selectedOrder.bodyPart}
                    {selectedOrder.status === 'Completed' && (
                      <span style={{ 
                        marginLeft: '8px',
                        padding: '2px 10px',
                        background: '#10b981',
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        Archived
                      </span>
                    )}
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
                    Patient: {selectedOrder.patient?.firstName} {selectedOrder.patient?.lastName}
                  </p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                    Status: <span style={{ fontWeight: '600', color: getStatusColor(selectedOrder.status) }}>{selectedOrder.status}</span>
                    {selectedOrder.resultDate && (
                      <span style={{ marginLeft: '8px', fontSize: '12px', color: '#6b7280' }}>
                        • Completed: {new Date(selectedOrder.resultDate).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>

                {selectedOrder.status === 'Completed' ? (
                  // VIEW REPORT MODE - Complete Archive View
                  <div>
                    {/* Clinical History */}
                    {selectedOrder.clinicalHistory && (
                      <div style={{ marginBottom: '12px' }}>
                        <strong style={{ color: '#374151' }}>Clinical History:</strong>
                        <p style={{ margin: '4px 0 0 0', color: '#6b7280' }}>{selectedOrder.clinicalHistory}</p>
                      </div>
                    )}
                    
                    {/* Clinical Question */}
                    {selectedOrder.clinicalQuestion && (
                      <div style={{ marginBottom: '12px' }}>
                        <strong style={{ color: '#374151' }}>Clinical Question:</strong>
                        <p style={{ margin: '4px 0 0 0', color: '#6b7280' }}>{selectedOrder.clinicalQuestion}</p>
                      </div>
                    )}

                    {/* Findings */}
                    <div className="form-group">
                      <label style={{ fontWeight: '600', color: '#065f46' }}>📋 Findings</label>
                      <div style={{
                        background: '#f0fdf4',
                        padding: '12px',
                        borderRadius: '8px',
                        whiteSpace: 'pre-wrap',
                        minHeight: '80px',
                        border: '1px solid #10b981'
                      }}>
                        {selectedOrder.result || 'No findings recorded'}
                      </div>
                    </div>

                    {/* Impression */}
                    <div className="form-group">
                      <label style={{ fontWeight: '600', color: '#1e40af' }}>💡 Impression</label>
                      <div style={{
                        background: '#eff6ff',
                        padding: '12px',
                        borderRadius: '8px',
                        whiteSpace: 'pre-wrap',
                        minHeight: '60px',
                        border: '1px solid #3b82f6'
                      }}>
                        {selectedOrder.report || 'No impression recorded'}
                      </div>
                    </div>

                    {/* Recommendations */}
                    {selectedOrder.imagingResults?.[0]?.recommendations && (
                      <div className="form-group">
                        <label style={{ fontWeight: '600', color: '#92400e' }}>📌 Recommendations</label>
                        <div style={{
                          background: '#fffbeb',
                          padding: '12px',
                          borderRadius: '8px',
                          whiteSpace: 'pre-wrap',
                          border: '1px solid #f59e0b'
                        }}>
                          {selectedOrder.imagingResults[0].recommendations}
                        </div>
                      </div>
                    )}

                    {/* Severity */}
                    <div className="form-group">
                      <label style={{ fontWeight: '600', color: '#374151' }}>⚠️ Severity</label>
                      <div>
                        <span style={{
                          background: selectedOrder.imagingResults?.[0]?.severity === 'Critical' ? '#dc2626' :
                                     selectedOrder.imagingResults?.[0]?.severity === 'Abnormal' ? '#f59e0b' : '#10b981',
                          color: 'white',
                          padding: '4px 16px',
                          borderRadius: '12px',
                          fontSize: '14px',
                          fontWeight: '600',
                          display: 'inline-block'
                        }}>
                          {selectedOrder.imagingResults?.[0]?.severity || 'Normal'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Display images for completed orders */}
                    {selectedOrder.images && selectedOrder.images.length > 0 && (
                      <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                        <h4 style={{ margin: '0 0 12px 0' }}>📷 Images ({selectedOrder.images.split(',').length})</h4>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
                          gap: '12px'
                        }}>
                          {selectedOrder.images.split(',').filter(url => url && url.trim() !== '').map((url, index) => {
                            const imageUrl = getImageUrl(url);
                            return (
                              <div key={index} style={{ 
                                position: 'relative',
                                background: '#f1f5f9',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                border: '1px solid #e2e8f0',
                                aspectRatio: '1 / 1'
                              }}>
                                <img 
                                  src={imageUrl}
                                  alt={`Image ${index + 1}`}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => window.open(imageUrl, '_blank')}
                                  onError={(e) => {
                                    console.error(`❌ Failed to load image: ${imageUrl}`);
                                    e.target.onerror = null;
                                    e.target.style.display = 'none';
                                    const parent = e.target.parentElement;
                                    const fallback = document.createElement('div');
                                    fallback.style.cssText = `
                                      width: 100%;
                                      height: 100%;
                                      display: flex;
                                      flex-direction: column;
                                      align-items: center;
                                      justify-content: center;
                                      background: #f1f5f9;
                                      color: #6b7280;
                                      font-size: 14px;
                                      padding: 10px;
                                      text-align: center;
                                    `;
                                    const filename = imageUrl.split('/').pop();
                                    fallback.innerHTML = `
                                      <span style="font-size: 32px;">🖼️</span>
                                      <span style="margin-top: 4px; font-size: 12px;">${filename}</span>
                                      <button onclick="window.open('${imageUrl}', '_blank')" style="
                                        margin-top: 6px;
                                        padding: 4px 12px;
                                        background: #0f3460;
                                        color: white;
                                        border: none;
                                        border-radius: 4px;
                                        cursor: pointer;
                                        font-size: 11px;
                                      ">View Full Size</button>
                                    `;
                                    parent.appendChild(fallback);
                                  }}
                                />
                                <span style={{
                                  position: 'absolute',
                                  bottom: '4px',
                                  right: '4px',
                                  background: 'rgba(0,0,0,0.7)',
                                  color: 'white',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px'
                                }}>
                                  {index + 1}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                          Click on any image to view full size
                        </p>
                      </div>
                    )}
                    
                    {/* Radiologist Info */}
                    {selectedOrder.radiologist && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                          <strong>Reported by:</strong> {selectedOrder.radiologist.firstName} {selectedOrder.radiologist.lastName}
                          {selectedOrder.resultDate && (
                            <span style={{ marginLeft: '8px' }}>
                              on {new Date(selectedOrder.resultDate).toLocaleString()}
                            </span>
                          )}
                        </p>
                      </div>
                    )}

                    {/* Archive Note */}
                    <div style={{ 
                      marginTop: '12px', 
                      padding: '8px 12px', 
                      background: '#f0fdf4', 
                      borderRadius: '6px',
                      border: '1px solid #10b981'
                    }}>
                      <p style={{ margin: 0, fontSize: '12px', color: '#065f46' }}>
                        📚 This report is archived and available for future reference.
                      </p>
                    </div>
                  </div>
                ) : (
                  // Submit Results Mode
                  <>
                    {/* IMAGE UPLOAD SECTION */}
                    <div style={{ 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '16px',
                      background: '#fafafa'
                    }}>
                      <h4 style={{ margin: '0 0 12px 0', color: '#0f3460' }}>📷 Upload Images</h4>
                      <ImageUpload 
                        orderId={selectedOrder.id}
                        token={token}
                        onUploadComplete={(updatedOrder) => {
                          console.log('📸 Upload complete:', updatedOrder);
                          toast.success('Images uploaded successfully!');
                          fetchOrders();
                          setSelectedOrder(prev => ({
                            ...prev,
                            ...updatedOrder,
                            images: updatedOrder.images,
                            imageCount: updatedOrder.imageCount,
                            hasImages: true
                          }));
                        }}
                      />
                    </div>

                    <div className="form-group">
                      <label>Findings *</label>
                      <textarea
                        value={resultForm.findings}
                        onChange={(e) => setResultForm({...resultForm, findings: e.target.value})}
                        rows="4"
                        required
                        placeholder="Describe the imaging findings in detail..."
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label>Impression *</label>
                      <textarea
                        value={resultForm.impression}
                        onChange={(e) => setResultForm({...resultForm, impression: e.target.value})}
                        rows="3"
                        required
                        placeholder="What is your interpretation of the findings?"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Recommendations</label>
                        <input
                          type="text"
                          value={resultForm.recommendations}
                          onChange={(e) => setResultForm({...resultForm, recommendations: e.target.value})}
                          placeholder="Follow-up recommendations"
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                      <div className="form-group">
                        <label>Severity</label>
                        <select
                          value={resultForm.severity}
                          onChange={(e) => setResultForm({...resultForm, severity: e.target.value})}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            fontSize: '14px'
                          }}
                        >
                          <option value="Normal">✅ Normal</option>
                          <option value="Abnormal">⚠️ Abnormal</option>
                          <option value="Critical">🔴 Critical</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowResultModal(false)}
                  style={{ 
                    background: '#e5e7eb', 
                    color: '#1f2937', 
                    border: '1px solid #d1d5db', 
                    padding: '10px 24px', 
                    borderRadius: '6px', 
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {selectedOrder.status === 'Completed' ? 'Close Archive' : 'Cancel'}
                </button>
                {selectedOrder.status !== 'Completed' && (
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    style={{ 
                      background: '#0f3460', 
                      color: 'white', 
                      border: 'none', 
                      padding: '10px 24px', 
                      borderRadius: '6px', 
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    ✅ Submit & Archive Results
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ VIEW REPORT MODAL - Separate modal for completed orders */}
      {showViewReportModal && selectedOrder && (
        <div className="modal-overlay" onClick={() => setShowViewReportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <h3>📄 Imaging Report - {selectedOrder.orderNumber}</h3>
              <button className="modal-close" onClick={() => setShowViewReportModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* Patient Info */}
              <div style={{ 
                background: '#f0fdf4', 
                padding: '12px 16px', 
                borderRadius: '8px',
                marginBottom: '16px',
                border: '1px solid #10b981'
              }}>
                <p style={{ margin: 0 }}>
                  <strong>Patient:</strong> {selectedOrder.patient?.firstName} {selectedOrder.patient?.lastName}
                  <span style={{ marginLeft: '16px' }}>
                    <strong>Hospital ID:</strong> {selectedOrder.patient?.hospitalId}
                  </span>
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
                  <strong>Order:</strong> {selectedOrder.imagingType} - {selectedOrder.bodyPart}
                  <span style={{ marginLeft: '16px' }}>
                    <strong>Date:</strong> {new Date(selectedOrder.createdAt).toLocaleDateString()}
                  </span>
                </p>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                  <strong>Reported by:</strong> {selectedOrder.radiologist?.firstName || 'N/A'} {selectedOrder.radiologist?.lastName || ''}
                  {selectedOrder.resultDate && (
                    <span style={{ marginLeft: '16px' }}>
                      <strong>Completed:</strong> {new Date(selectedOrder.resultDate).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>

              {/* Clinical History */}
              {selectedOrder.clinicalHistory && (
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#374151' }}>📋 Clinical History:</strong>
                  <p style={{ margin: '4px 0 0 0', color: '#6b7280' }}>{selectedOrder.clinicalHistory}</p>
                </div>
              )}
              
              {/* Clinical Question */}
              {selectedOrder.clinicalQuestion && (
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#374151' }}>❓ Clinical Question:</strong>
                  <p style={{ margin: '4px 0 0 0', color: '#6b7280' }}>{selectedOrder.clinicalQuestion}</p>
                </div>
              )}

              {/* Findings */}
              <div style={{ marginBottom: '12px', padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #10b981' }}>
                <strong style={{ color: '#065f46' }}>📝 Findings:</strong>
                <p style={{ margin: '4px 0 0 0', color: '#374151' }}>{selectedOrder.result || 'No findings recorded'}</p>
              </div>

              {/* Impression */}
              <div style={{ marginBottom: '12px', padding: '12px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #3b82f6' }}>
                <strong style={{ color: '#1e40af' }}>💡 Impression:</strong>
                <p style={{ margin: '4px 0 0 0', color: '#374151' }}>{selectedOrder.report || 'No impression recorded'}</p>
              </div>

              {/* Recommendations */}
              {selectedOrder.imagingResults?.[0]?.recommendations && (
                <div style={{ marginBottom: '12px', padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #f59e0b' }}>
                  <strong style={{ color: '#92400e' }}>📌 Recommendations:</strong>
                  <p style={{ margin: '4px 0 0 0', color: '#374151' }}>{selectedOrder.imagingResults[0].recommendations}</p>
                </div>
              )}

              {/* Severity */}
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ color: '#374151' }}>⚠️ Severity:</strong>
                <span style={{
                  marginLeft: '8px',
                  background: selectedOrder.imagingResults?.[0]?.severity === 'Critical' ? '#dc2626' :
                             selectedOrder.imagingResults?.[0]?.severity === 'Abnormal' ? '#f59e0b' : '#10b981',
                  color: 'white',
                  padding: '4px 16px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'inline-block'
                }}>
                  {selectedOrder.imagingResults?.[0]?.severity || 'Normal'}
                </span>
              </div>
              
              {/* Images */}
              {selectedOrder.images && selectedOrder.images.length > 0 && (
                <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0' }}>📷 Images ({selectedOrder.images.split(',').length})</h4>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                    gap: '12px'
                  }}>
                    {selectedOrder.images.split(',').filter(url => url && url.trim() !== '').map((url, index) => {
                      const imageUrl = getImageUrl(url);
                      return (
                        <div key={index} style={{ 
                          position: 'relative',
                          background: '#f1f5f9',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '1px solid #e2e8f0',
                          aspectRatio: '1 / 1'
                        }}>
                          <img 
                            src={imageUrl}
                            alt={`Image ${index + 1}`}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              cursor: 'pointer'
                            }}
                            onClick={() => window.open(imageUrl, '_blank')}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.style.display = 'none';
                              const parent = e.target.parentElement;
                              const fallback = document.createElement('div');
                              fallback.style.cssText = `
                                width: 100%;
                                height: 100%;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                background: #f1f5f9;
                                color: #6b7280;
                                font-size: 14px;
                                padding: 10px;
                                text-align: center;
                              `;
                              const filename = imageUrl.split('/').pop();
                              fallback.innerHTML = `
                                <span style="font-size: 32px;">🖼️</span>
                                <span style="margin-top: 4px; font-size: 12px;">${filename}</span>
                                <button onclick="window.open('${imageUrl}', '_blank')" style="
                                  margin-top: 6px;
                                  padding: 4px 12px;
                                  background: #0f3460;
                                  color: white;
                                  border: none;
                                  border-radius: 4px;
                                  cursor: pointer;
                                  font-size: 11px;
                                ">View Full Size</button>
                              `;
                              parent.appendChild(fallback);
                            }}
                          />
                          <span style={{
                            position: 'absolute',
                            bottom: '4px',
                            right: '4px',
                            background: 'rgba(0,0,0,0.7)',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}>
                            {index + 1}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                    Click on any image to view full size
                  </p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowViewReportModal(false)}
                style={{
                  background: '#e5e7eb',
                  color: '#1f2937',
                  border: '1px solid #d1d5db',
                  padding: '10px 30px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Close
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  window.print();
                }}
                style={{
                  background: '#0f3460',
                  color: 'white',
                  border: 'none',
                  padding: '10px 30px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                🖨️ Print Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RadiologyDashboard;