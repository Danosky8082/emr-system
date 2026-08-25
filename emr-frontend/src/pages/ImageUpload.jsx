// src/components/ImageUpload.jsx
import React, { useState, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const ImageUpload = ({ orderId, onUploadComplete, token }) => {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    
    // Create previews
    const previewUrls = selectedFiles.map(file => URL.createObjectURL(file));
    setPreviews(previewUrls);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Please select at least one image');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    files.forEach(file => {
      formData.append('images', file);
    });
    formData.append('orderId', orderId);

    try {
      const res = await axios.post(
        `http://localhost:3000/api/imaging-orders/${orderId}/upload-images`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      toast.success(`Uploaded ${files.length} image(s) successfully!`);
      setFiles([]);
      setPreviews([]);
      if (onUploadComplete) onUploadComplete(res.data);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    const newPreviews = previews.filter((_, i) => i !== index);
    setPreviews(newPreviews);
  };

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ 
        border: '2px dashed #d1d5db', 
        borderRadius: '8px', 
        padding: '20px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'border-color 0.2s'
      }}
      onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#0f3460'; }}
      onDragLeave={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; }}
      onDrop={(e) => {
        e.preventDefault();
        const droppedFiles = Array.from(e.dataTransfer.files);
        setFiles(prev => [...prev, ...droppedFiles]);
        const previewUrls = droppedFiles.map(file => URL.createObjectURL(file));
        setPreviews(prev => [...prev, ...previewUrls]);
      }}
      onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <span style={{ fontSize: '40px' }}>📷</span>
        <p style={{ margin: '8px 0', color: '#6b7280' }}>
          Drag & drop images here, or click to select
        </p>
        <p style={{ fontSize: '12px', color: '#9ca3af' }}>
          Supported formats: JPG, PNG, GIF, DICOM
        </p>
      </div>

      {/* Preview Grid */}
      {previews.length > 0 && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
          gap: '12px',
          marginTop: '16px'
        }}>
          {previews.map((url, index) => (
            <div key={index} style={{ position: 'relative' }}>
              <img 
                src={url} 
                alt={`Preview ${index + 1}`}
                style={{
                  width: '100%',
                  height: '100px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}
              />
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary"
            onClick={() => { setFiles([]); setPreviews([]); }}
            disabled={uploading}
          >
            Clear All
          </button>
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? '⏳ Uploading...' : `📤 Upload ${files.length} Image(s)`}
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;