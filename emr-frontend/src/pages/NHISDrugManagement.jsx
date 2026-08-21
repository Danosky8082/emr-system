// src/pages/NHISDrugManagement.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import toast from 'react-hot-toast';

const NHISDrugManagement = () => {
  const { token } = useAuth();
  const [nhisDrugs, setNhisDrugs] = useState([]);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    medicationId: '',
    nhisCode: '',
    nhisName: '',
    standardPrice: '',
    nhisPrice: '',
    patientCopay: '',
    maxQuantity: '',
    refillLimit: 3,
    validityPeriod: 30,
    drugClass: '',
    requiresPriorAuth: false,
    effectiveDate: new Date().toISOString().split('T')[0],
    expiryDate: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [nhisRes, medsRes] = await Promise.all([
        axios.get('http://localhost:3000/api/pharmacy/nhis-prices', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:3000/api/medications', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setNhisDrugs(nhisRes.data);
      setMedications(medsRes.data);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3000/api/pharmacy/nhis-prices', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('NHIS drug pricing saved successfully');
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(error.response?.data?.error || 'Failed to save');
    }
  };

  const resetForm = () => {
    setFormData({
      medicationId: '',
      nhisCode: '',
      nhisName: '',
      standardPrice: '',
      nhisPrice: '',
      patientCopay: '',
      maxQuantity: '',
      refillLimit: 3,
      validityPeriod: 30,
      drugClass: '',
      requiresPriorAuth: false,
      effectiveDate: new Date().toISOString().split('T')[0],
      expiryDate: ''
    });
    setEditing(null);
  };

  const handleEdit = (drug) => {
    setEditing(drug);
    setFormData({
      medicationId: drug.medicationId,
      nhisCode: drug.nhisCode,
      nhisName: drug.nhisName || '',
      standardPrice: drug.standardPrice,
      nhisPrice: drug.nhisPrice,
      patientCopay: drug.patientCopay,
      maxQuantity: drug.maxQuantity || '',
      refillLimit: drug.refillLimit,
      validityPeriod: drug.validityPeriod,
      drugClass: drug.drugClass || '',
      requiresPriorAuth: drug.requiresPriorAuth || false,
      effectiveDate: drug.effectiveDate?.split('T')[0] || new Date().toISOString().split('T')[0],
      expiryDate: drug.expiryDate?.split('T')[0] || ''
    });
    setShowModal(true);
  };

  const filteredDrugs = nhisDrugs.filter(drug =>
    drug.medication?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    drug.nhisCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    drug.nhisName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>💊 NHIS Drug Pricing Management</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="🔍 Search NHIS drugs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              width: '250px'
            }}
          />
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Add NHIS Drug
          </button>
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, #0f3460, #1a4a7a)',
        color: 'white',
        padding: '16px 24px',
        borderRadius: '12px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>Total NHIS Drugs</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{nhisDrugs.length}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>Active Drugs</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
            {nhisDrugs.filter(d => d.isActive).length}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>Coverage Rate</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold' }}>90%</div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Medication</th>
              <th>NHIS Code</th>
              <th>Standard Price</th>
              <th>NHIS Price</th>
              <th>Patient Copay (10%)</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDrugs.map(drug => (
              <tr key={drug.id}>
                <td><strong>{drug.medication?.name}</strong></td>
                <td><code style={{ background: '#f0f2f5', padding: '2px 6px', borderRadius: '4px' }}>{drug.nhisCode}</code></td>
                <td>₦{drug.standardPrice.toLocaleString()}</td>
                <td style={{ color: '#10b981', fontWeight: '600' }}>₦{drug.nhisPrice.toLocaleString()}</td>
                <td style={{ color: '#f59e0b', fontWeight: '600' }}>₦{drug.patientCopay.toLocaleString()}</td>
                <td>
                  <span className={`status-badge ${drug.isActive ? 'status-active' : 'status-inactive'}`}>
                    {drug.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button className="btn btn-sm btn-edit" onClick={() => handleEdit(drug)}>Edit</button>
                </td>
              </tr>
            ))}
            {filteredDrugs.length === 0 && (
              <tr><td colSpan="7" className="text-center">No NHIS drug pricing found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editing ? 'Edit NHIS Drug Pricing' : 'Add NHIS Drug Pricing'}</h3>
              <button className="modal-close" onClick={() => { setShowModal(false); resetForm(); }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Select Medication *</label>
                  <select
                    value={formData.medicationId}
                    onChange={(e) => setFormData({...formData, medicationId: e.target.value})}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">Select Medication...</option>
                    {medications.map(med => (
                      <option key={med.id} value={med.id}>
                        {med.name} {med.genericName ? `(${med.genericName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>NHIS Code *</label>
                    <input
                      type="text"
                      value={formData.nhisCode}
                      onChange={(e) => setFormData({...formData, nhisCode: e.target.value})}
                      required
                      placeholder="e.g., NHIS-001"
                    />
                  </div>
                  <div className="form-group">
                    <label>NHIS Name</label>
                    <input
                      type="text"
                      value={formData.nhisName}
                      onChange={(e) => setFormData({...formData, nhisName: e.target.value})}
                      placeholder="Alternative name if different"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Standard Price (₦) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.standardPrice}
                      onChange={(e) => setFormData({...formData, standardPrice: e.target.value})}
                      required
                      placeholder="e.g., 5000"
                    />
                  </div>
                  <div className="form-group">
                    <label>NHIS Price (₦) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.nhisPrice}
                      onChange={(e) => setFormData({...formData, nhisPrice: e.target.value})}
                      required
                      placeholder="e.g., 4500"
                    />
                    <small style={{ color: '#6b7280' }}>Patient pays 10% of this amount</small>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Patient Copay (₦)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.patientCopay}
                      onChange={(e) => setFormData({...formData, patientCopay: e.target.value})}
                      placeholder="Auto-calculated: 10% of NHIS price"
                    />
                    <small style={{ color: '#6b7280' }}>
                      {formData.nhisPrice ? `10% = ₦${(parseFloat(formData.nhisPrice) * 0.1).toFixed(2)}` : 'Enter NHIS price first'}
                    </small>
                  </div>
                  <div className="form-group">
                    <label>Max Quantity per Prescription</label>
                    <input
                      type="number"
                      value={formData.maxQuantity}
                      onChange={(e) => setFormData({...formData, maxQuantity: e.target.value})}
                      placeholder="e.g., 30"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Refill Limit</label>
                    <input
                      type="number"
                      value={formData.refillLimit}
                      onChange={(e) => setFormData({...formData, refillLimit: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Validity Period (days)</label>
                    <input
                      type="number"
                      value={formData.validityPeriod}
                      onChange={(e) => setFormData({...formData, validityPeriod: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Drug Class</label>
                    <select
                      value={formData.drugClass}
                      onChange={(e) => setFormData({...formData, drugClass: e.target.value})}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="">Select Class...</option>
                      <option value="Essential">Essential</option>
                      <option value="Controlled">Controlled</option>
                      <option value="Restricted">Restricted</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginTop: '24px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={formData.requiresPriorAuth}
                        onChange={(e) => setFormData({...formData, requiresPriorAuth: e.target.checked})}
                        style={{ width: '18px', height: '18px' }}
                      />
                      Requires Prior Authorization
                    </label>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Effective Date</label>
                    <input
                      type="date"
                      value={formData.effectiveDate}
                      onChange={(e) => setFormData({...formData, effectiveDate: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Expiry Date</label>
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Update' : 'Save'} NHIS Drug
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NHISDrugManagement;