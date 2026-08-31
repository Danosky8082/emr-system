// src/pages/ServiceConfig.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const ServiceConfig = () => {
  const { token } = useAuth();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    baseAmount: '',
    nhisAmount: '',
    corporateAmount: '',
    isActive: true
  });

  const serviceTypes = [
    { key: 'REGISTRATION', label: '📝 Registration Fee', defaultAmount: 2000 },
    { key: 'CARD', label: '🪪 Hospital ID Card', defaultAmount: 1000 },
    { key: 'CONSULTATION', label: '🩺 Consultation Fee', defaultAmount: 5000 },
  ];

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3000/api/services/config', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfigs(res.data);
    } catch (error) {
      console.error('Error fetching configs:', error);
      toast.error('Failed to load service configurations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleEdit = (config) => {
    setEditing(config.serviceType);
    setFormData({
      name: config.name || '',
      description: config.description || '',
      baseAmount: config.baseAmount || '',
      nhisAmount: config.nhisAmount || '',
      corporateAmount: config.corporateAmount || '',
      isActive: config.isActive !== undefined ? config.isActive : true
    });
  };

  const handleSave = async (serviceType) => {
    try {
      await axios.put(
        `http://localhost:3000/api/services/config/${serviceType}`,
        {
          name: formData.name,
          description: formData.description,
          baseAmount: parseFloat(formData.baseAmount) || 0,
          nhisAmount: formData.nhisAmount ? parseFloat(formData.nhisAmount) : null,
          corporateAmount: formData.corporateAmount ? parseFloat(formData.corporateAmount) : null,
          isActive: formData.isActive
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Service configuration updated successfully!`);
      setEditing(null);
      fetchConfigs();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update configuration');
    }
  };

  const getConfigValue = (serviceType) => {
    const config = configs.find(c => c.serviceType === serviceType);
    return config;
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>💰 Service Fee Configuration</h2>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          Configure registration, card, and consultation fees. Changes take effect immediately for new patients.
        </p>
      </div>

      {/* Info Banner */}
      <div style={{
        background: '#eff6ff',
        border: '1px solid #3b82f6',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: '20px' }}>💡</span>
        <span style={{ fontSize: '14px', color: '#1e3a5f' }}>
          These fees are automatically applied when a new patient is registered.
          <br />
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            NHIS patients pay 10% • Corporate patients pay 200% of the base amount.
          </span>
        </span>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Description</th>
              <th>Base (₦)</th>
              <th>NHIS (₦)</th>
              <th>Corporate (₦)</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {serviceTypes.map((service) => {
              const config = getConfigValue(service.key);
              const isEditing = editing === service.key;
              const baseAmount = config?.baseAmount || service.defaultAmount;
              const nhisAmount = config?.nhisAmount || Math.round(baseAmount * 0.1);
              const corporateAmount = config?.corporateAmount || baseAmount * 2;
              
              return (
                <tr key={service.key}>
                  <td><strong>{service.label}</strong></td>
                  <td>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        placeholder="Description"
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          fontSize: '13px'
                        }}
                      />
                    ) : (
                      <span>{config?.description || '—'}</span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        value={formData.baseAmount}
                        onChange={(e) => setFormData({...formData, baseAmount: e.target.value})}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          fontSize: '14px'
                        }}
                        min="0"
                        step="0.01"
                        autoFocus
                      />
                    ) : (
                      <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f3460' }}>
                        ₦{baseAmount.toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        value={formData.nhisAmount}
                        onChange={(e) => setFormData({...formData, nhisAmount: e.target.value})}
                        placeholder="Auto: 10%"
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          fontSize: '13px'
                        }}
                        min="0"
                        step="0.01"
                      />
                    ) : (
                      <span style={{ color: '#065f46', fontWeight: '600' }}>
                        ₦{nhisAmount.toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        value={formData.corporateAmount}
                        onChange={(e) => setFormData({...formData, corporateAmount: e.target.value})}
                        placeholder="Auto: 200%"
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          fontSize: '13px'
                        }}
                        min="0"
                        step="0.01"
                      />
                    ) : (
                      <span style={{ color: '#92400e', fontWeight: '600' }}>
                        ₦{corporateAmount.toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <select
                        value={formData.isActive ? 'true' : 'false'}
                        onChange={(e) => setFormData({...formData, isActive: e.target.value === 'true'})}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          fontSize: '13px'
                        }}
                      >
                        <option value="true">✅ Active</option>
                        <option value="false">❌ Inactive</option>
                      </select>
                    ) : (
                      <span className={`status-badge ${config?.isActive !== false ? 'status-active' : 'status-inactive'}`}>
                        {config?.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleSave(service.key)}
                          style={{
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          💾 Save
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setEditing(null)}
                          style={{
                            background: '#e5e7eb',
                            color: '#1f2937',
                            border: '1px solid #d1d5db',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleEdit(config || { serviceType: service.key, baseAmount: service.defaultAmount, isActive: true })}
                        style={{
                          background: '#0f3460',
                          color: 'white',
                          border: 'none',
                          padding: '6px 14px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        ✏️ Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Fee Rules */}
      <div style={{
        marginTop: '16px',
        padding: '16px 20px',
        background: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <h4 style={{ margin: '0 0 8px 0' }}>📊 Fee Rules</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '10px 14px', background: '#dbeafe', borderRadius: '6px' }}>
            <strong style={{ color: '#1e40af' }}>💰 FPP</strong>
            <div style={{ fontSize: '13px', color: '#374151' }}>Full amount (100%)</div>
          </div>
          <div style={{ padding: '10px 14px', background: '#d1fae5', borderRadius: '6px' }}>
            <strong style={{ color: '#065f46' }}>🏥 NHIS</strong>
            <div style={{ fontSize: '13px', color: '#374151' }}>10% of base amount</div>
          </div>
          <div style={{ padding: '10px 14px', background: '#fef3c7', borderRadius: '6px' }}>
            <strong style={{ color: '#92400e' }}>🏢 Corporate</strong>
            <div style={{ fontSize: '13px', color: '#374151' }}>200% of base amount</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceConfig;