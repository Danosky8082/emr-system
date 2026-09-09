// src/pages/Pharmacy.jsx - WITH STOCK MANAGEMENT

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';
import { useSearch } from '../components/Layout';
import toast from 'react-hot-toast';

const Pharmacy = () => {
  const { token, user } = useAuth();
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

  // ✅ STOCK MANAGEMENT STATE
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [stockForm, setStockForm] = useState({
    quantity: '',
    transactionType: 'Purchase',
    note: ''
  });
  const [updatingStock, setUpdatingStock] = useState(false);

  const isPharmacist = user?.role === 'Pharmacist' || user?.role === 'Admin' || user?.role === 'ITAdmin';

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const numericFields = ['unitPrice', 'stockQuantity', 'reorderLevel'];
    const parsedValue = numericFields.includes(name) 
      ? (value === '' ? '' : parseFloat(value) || 0)
      : value;
    
    setFormData(prev => ({ ...prev, [name]: parsedValue }));
  };

  // ✅ STOCK MANAGEMENT HANDLERS
  const handleOpenStockModal = (medication) => {
    setSelectedMedication(medication);
    setStockForm({
      quantity: '',
      transactionType: 'Purchase',
      note: ''
    });
    setShowStockModal(true);
  };

  const handleStockSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMedication) return;
    
    const quantity = parseInt(stockForm.quantity);
    if (!quantity || quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    // For dispensed, check if stock is sufficient
    if (stockForm.transactionType === 'Dispensed' && quantity > selectedMedication.stockQuantity) {
      toast.error(`Insufficient stock. Available: ${selectedMedication.stockQuantity}`);
      return;
    }

    setUpdatingStock(true);
    try {
      const response = await axios.patch(
        `http://localhost:3000/api/medications/${selectedMedication.id}/stock`,
        {
          quantity: quantity,
          transactionType: stockForm.transactionType,
          note: stockForm.note || `${stockForm.transactionType} of ${quantity} units`
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`✅ ${stockForm.transactionType}: ${quantity} units processed! New stock: ${response.data.newStock}`);
      setShowStockModal(false);
      setSelectedMedication(null);
      setStockForm({ quantity: '', transactionType: 'Purchase', note: '' });
      fetchMedications();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update stock');
    } finally {
      setUpdatingStock(false);
    }
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

      if (editing) {
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
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

  const handleEdit = (med) => {
    if (!med || !med.id) {
      toast.error('Invalid medication. Please refresh and try again.');
      return;
    }
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
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
          <button className="btn btn-secondary" onClick={fetchMedications}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="stats-grid" style={{ marginBottom: '16px' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-icon">💊</div>
          <div className="stat-info">
            <div className="stat-value">{medications.length}</div>
            <div className="stat-label">Total Medications</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#ef4444' }}>
              {medications.filter(m => m.stockQuantity <= m.reorderLevel).length}
            </div>
            <div className="stat-label">Low Stock Items</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#10b981' }}>
              {medications.filter(m => m.stockQuantity > m.reorderLevel).length}
            </div>
            <div className="stat-label">In Stock</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon">📦</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#f59e0b' }}>
              {medications.reduce((sum, m) => sum + (m.stockQuantity || 0), 0)}
            </div>
            <div className="stat-label">Total Units</div>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Generic</th>
              <th>Category</th>
              <th>Stock</th>
              <th>Reorder Level</th>
              <th>Unit Price</th>
              <th>NHIS Price</th>
              <th>Expiry</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMedications.map((m) => {
              const nhisPrice = nhisPrices[m.id];
              const isLowStock = m.stockQuantity <= m.reorderLevel;
              const isOutOfStock = m.stockQuantity <= 0;
              
              return (
                <tr key={m.id} style={{
                  background: isOutOfStock ? '#fee2e2' : isLowStock ? '#fef3c7' : 'white'
                }}>
                  <td><strong>{m.name}</strong></td>
                  <td>{m.genericName || '-'}</td>
                  <td>{m.category}</td>
                  <td style={{ 
                    color: isOutOfStock ? '#dc2626' : isLowStock ? '#d97706' : '#000',
                    fontWeight: isOutOfStock || isLowStock ? 'bold' : 'normal'
                  }}>
                    {m.stockQuantity}
                    {isOutOfStock && ' ❌'}
                    {isLowStock && !isOutOfStock && ' ⚠️'}
                  </td>
                  <td>{m.reorderLevel || 10}</td>
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
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
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
                      {isPharmacist && (
                        <button 
                          className="btn btn-sm"
                          onClick={() => handleOpenStockModal(m)}
                          style={{
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                        >
                          📦 Stock
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredMedications.length === 0 && (
              <tr><td colSpan="9" className="text-center">No medications found</td></tr>
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
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                >
                  {editing ? 'Update Medication' : 'Add Medication'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ STOCK MANAGEMENT MODAL */}
      {showStockModal && selectedMedication && (
        <div className="modal-overlay" onClick={() => setShowStockModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>📦 Manage Stock</h3>
              <button className="modal-close" onClick={() => setShowStockModal(false)}>×</button>
            </div>
            <form onSubmit={handleStockSubmit}>
              <div className="modal-body">
                <div style={{
                  background: '#f8fafc',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <p style={{ margin: 0 }}>
                    <strong>{selectedMedication.name}</strong>
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
                    Current Stock: <strong style={{ 
                      color: selectedMedication.stockQuantity <= selectedMedication.reorderLevel ? '#ef4444' : '#10b981'
                    }}>
                      {selectedMedication.stockQuantity} units
                    </strong>
                    {selectedMedication.stockQuantity <= selectedMedication.reorderLevel && (
                      <span style={{ color: '#ef4444', marginLeft: '8px' }}>⚠️ Low Stock</span>
                    )}
                  </p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                    Reorder Level: {selectedMedication.reorderLevel || 10} units
                  </p>
                </div>

                <div className="form-group">
                  <label>Transaction Type *</label>
                  <select
                    value={stockForm.transactionType}
                    onChange={(e) => setStockForm({...stockForm, transactionType: e.target.value})}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="Purchase">📥 Purchase (Add Stock)</option>
                    <option value="Returned">🔄 Returned (Add Stock)</option>
                    <option value="Dispensed">📤 Dispensed (Remove Stock)</option>
                    <option value="Adjusted">⚙️ Adjusted</option>
                    <option value="Damaged">❌ Damaged (Remove Stock)</option>
                    <option value="Expired">⏰ Expired (Remove Stock)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Quantity *</label>
                  <input
                    type="number"
                    value={stockForm.quantity}
                    onChange={(e) => setStockForm({...stockForm, quantity: e.target.value})}
                    required
                    min="1"
                    max={['Dispensed', 'Adjusted', 'Damaged', 'Expired'].includes(stockForm.transactionType) 
                      ? selectedMedication.stockQuantity 
                      : undefined}
                    placeholder="Enter quantity..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                  {['Dispensed', 'Adjusted', 'Damaged', 'Expired'].includes(stockForm.transactionType) && (
                    <small style={{ color: '#6b7280' }}>
                      Max available: {selectedMedication.stockQuantity} units
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label>Note</label>
                  <textarea
                    value={stockForm.note}
                    onChange={(e) => setStockForm({...stockForm, note: e.target.value})}
                    rows="2"
                    placeholder="Reason for stock adjustment..."
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
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowStockModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={updatingStock}
                  style={{
                    background: '#0f3460',
                    color: 'white',
                    border: 'none',
                    padding: '10px 24px',
                    borderRadius: '6px',
                    cursor: updatingStock ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    opacity: updatingStock ? 0.6 : 1
                  }}
                >
                  {updatingStock ? '⏳ Processing...' : '✅ Update Stock'}
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