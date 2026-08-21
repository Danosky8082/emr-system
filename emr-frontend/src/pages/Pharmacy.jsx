// src/pages/Pharmacy.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import { useSearch } from '../components/Layout';
import toast from 'react-hot-toast';

const Pharmacy = () => {
  const { token } = useAuth();
  const { searchTerm } = useSearch();
  const [medications, setMedications] = useState([]);
  const [nhisPrices, setNhisPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    genericName: '',
    category: '',
    supplier: '',
    unitPrice: '',
    stockQuantity: '',
    reorderLevel: '10',
    expiryDate: '',
    batchNumber: ''
  });

  useEffect(() => {
    fetchMedications();
  }, []);

  const fetchMedications = async () => {
    try {
      const [medRes, nhisRes] = await Promise.all([
        axios.get('http://localhost:3000/api/medications', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:3000/api/pharmacy/nhis-prices', {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] }))
      ]);
      
      setMedications(medRes.data);
      
      // Map NHIS prices by medicationId
      const nhisMap = {};
      nhisRes.data.forEach(price => {
        nhisMap[price.medicationId] = price;
      });
      setNhisPrices(nhisMap);
    } catch (error) {
      console.error('Error fetching medications:', error);
      toast.error('Failed to load medications');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Handle form input with proper number parsing
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Parse numeric fields to numbers
    const numericFields = ['unitPrice', 'stockQuantity', 'reorderLevel'];
    const parsedValue = numericFields.includes(name) 
      ? (value === '' ? '' : parseFloat(value) || 0)
      : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: parsedValue
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        genericName: formData.genericName || '',
        category: formData.category,
        supplier: formData.supplier || '',
        unitPrice: parseFloat(formData.unitPrice) || 0,
        stockQuantity: parseInt(formData.stockQuantity) || 0,
        reorderLevel: parseInt(formData.reorderLevel) || 10,
        expiryDate: formData.expiryDate,
        batchNumber: formData.batchNumber || ''
      };

      console.log('📤 Sending update for ID:', editing?.id);
      console.log('📤 Payload:', payload);

      if (editing) {
        // ✅ Make sure we have a valid ID
        if (!editing.id) {
          toast.error('Invalid medication ID');
          return;
        }
        
        await axios.put(`http://localhost:3000/api/medications/${editing.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Medication updated successfully!');
      } else {
        await axios.post('http://localhost:3000/api/medications', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Medication added successfully!');
      }
      
      setShowModal(false);
      setEditing(null);
      setFormData({
        name: '',
        genericName: '',
        category: '',
        supplier: '',
        unitPrice: '',
        stockQuantity: '',
        reorderLevel: '10',
        expiryDate: '',
        batchNumber: ''
      });
      fetchMedications();
    } catch (error) {
      console.error('Submit error:', error);
      console.error('Error response:', error.response?.data);
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

  const handleEdit = (med) => {
    console.log('📝 Editing medication:', med);
    console.log('📝 Medication ID:', med.id);
    
    setEditing(med);
    setFormData({
      name: med.name || '',
      genericName: med.genericName || '',
      category: med.category || '',
      supplier: med.supplier || '',
      unitPrice: med.unitPrice || '',
      stockQuantity: med.stockQuantity || '',
      reorderLevel: med.reorderLevel || '10',
      expiryDate: med.expiryDate?.split('T')[0] || '',
      batchNumber: med.batchNumber || ''
    });
    setShowModal(true);
  };

  const filteredMedications = medications.filter(m => {
    const searchString = `${m.name} ${m.genericName || ''} ${m.category || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>💊 Pharmacy Inventory</h2>
        <button 
          className="btn btn-primary" 
          onClick={() => { 
            setEditing(null); 
            setFormData({
              name: '',
              genericName: '',
              category: '',
              supplier: '',
              unitPrice: '',
              stockQuantity: '',
              reorderLevel: '10',
              expiryDate: '',
              batchNumber: ''
            });
            setShowModal(true); 
          }}
        >
          + Add Medication
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Generic</th>
              <th>Category</th>
              <th>Stock</th>
              <th>Unit Price</th>
              <th>NHIS Price</th>
              <th>Expiry</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMedications.map((m) => {
              const nhisPrice = nhisPrices[m.id];
              return (
                <tr key={m.id}>
                  <td><strong>{m.name}</strong></td>
                  <td>{m.genericName || '-'}</td>
                  <td>{m.category}</td>
                  <td style={{ color: m.stockQuantity <= m.reorderLevel ? '#ef4444' : '#000' }}>
                    {m.stockQuantity}
                    {m.stockQuantity <= m.reorderLevel && ' ⚠️'}
                  </td>
                  <td>₦{m.unitPrice?.toLocaleString() || '0'}</td>
                  <td>
                    {nhisPrice ? (
                      <span style={{ color: '#10b981', fontWeight: '600' }}>
                        ₦{nhisPrice.nhisPrice?.toLocaleString() || '0'}
                        <br />
                        <small style={{ color: '#6b7280' }}>
                          Copay: ₦{nhisPrice.patientCopay?.toLocaleString() || '0'}
                        </small>
                      </span>
                    ) : (
                      <span style={{ color: '#6b7280', fontSize: '12px' }}>Not set</span>
                    )}
                  </td>
                  <td>{m.expiryDate ? new Date(m.expiryDate).toLocaleDateString() : '-'}</td>
                  <td>
                    <button 
                      className="btn btn-sm btn-edit" 
                      onClick={() => handleEdit(m)}
                      style={{
                        background: '#0f3460',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 10px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}
                    >
                      ✏️ Edit
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredMedications.length === 0 && (
              <tr><td colSpan="8" className="text-center">No medications found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Medication' : 'Add New Medication'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Name *</label>
                    <input 
                      type="text" 
                      name="name" 
                      value={formData.name} 
                      onChange={handleInputChange} 
                      required 
                      placeholder="e.g., Paracetamol"
                    />
                  </div>
                  <div className="form-group">
                    <label>Generic Name</label>
                    <input 
                      type="text" 
                      name="genericName" 
                      value={formData.genericName} 
                      onChange={handleInputChange} 
                      placeholder="e.g., Acetaminophen"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category *</label>
                    <input 
                      type="text" 
                      name="category" 
                      value={formData.category} 
                      onChange={handleInputChange} 
                      required 
                      placeholder="e.g., Analgesic"
                    />
                  </div>
                  <div className="form-group">
                    <label>Supplier</label>
                    <input 
                      type="text" 
                      name="supplier" 
                      value={formData.supplier} 
                      onChange={handleInputChange} 
                      placeholder="e.g., Emzor"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Unit Price (₦) *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      name="unitPrice" 
                      value={formData.unitPrice} 
                      onChange={handleInputChange} 
                      required 
                      placeholder="e.g., 500"
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Stock Quantity *</label>
                    <input 
                      type="number" 
                      name="stockQuantity" 
                      value={formData.stockQuantity} 
                      onChange={handleInputChange} 
                      required 
                      placeholder="e.g., 1000"
                      min="0"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Reorder Level</label>
                    <input 
                      type="number" 
                      name="reorderLevel" 
                      value={formData.reorderLevel} 
                      onChange={handleInputChange} 
                      placeholder="e.g., 10"
                      min="0"
                    />
                    <small>Alert when stock falls below this level</small>
                  </div>
                  <div className="form-group">
                    <label>Expiry Date *</label>
                    <input 
                      type="date" 
                      name="expiryDate" 
                      value={formData.expiryDate} 
                      onChange={handleInputChange} 
                      required 
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Batch Number</label>
                  <input 
                    type="text" 
                    name="batchNumber" 
                    value={formData.batchNumber} 
                    onChange={handleInputChange} 
                    placeholder="e.g., EM022113"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowModal(false)}
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
                  Cancel
                </button>
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
                  {editing ? 'Update Medication' : 'Add Medication'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pharmacy;