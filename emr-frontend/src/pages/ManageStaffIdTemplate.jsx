// src/pages/ManageStaffIdTemplate.jsx
//
// Admin page for configuring how the hospital generates staff IDs.
//
// Backend:
//   GET  /api/hospitals/:id/staff-id-template
//   PUT  /api/hospitals/:id/staff-id-template
//   POST /api/hospitals/:id/preview-staff-id
//
// The page lets the admin:
//   • choose the display format (PREFIX / DEPT / YEAR / SEQ, in any order)
//   • pick padding (3-8 digits for the sequence number)
//   • pick strategy (RANDOM or SEQUENTIAL)
//   • see a live preview of what a real ID will look like
//   • save and apply for all future staff

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import toast from 'react-hot-toast';
import './Dashboard.css';
import api from '../api/client';

// Presets that cover 90% of real-world hospital ID formats.
// Clicking a preset fills the form with a known-good shape.
const PRESETS = [
  {
    label: 'Hospital / Department / Number',
    format: '{PREFIX}/{DEPT}/{SEQ}',
    example: 'CARETECH/OUTPAT/4827',
    note: 'Default. Easy to read, sorts naturally in Excel.',
  },
  {
    label: 'Hospital-Year-Number',
    format: '{PREFIX}-{YEAR}-{SEQ}',
    example: 'CARETECH-2026-4827',
    note: 'Groups staff by hiring year.',
  },
  {
    label: 'Department / Hospital / Number',
    format: '{DEPT}/{PREFIX}/{SEQ}',
    example: 'OUTPAT/CARETECH/4827',
    note: 'Groups by department first.',
  },
  {
    label: 'Compact (no separators)',
    format: '{PREFIX}{SEQ}',
    example: 'CARETECH4827',
    note: 'Shortest. Fits on small ID cards.',
  },
  {
    label: 'Hospital / Department / Year / Number',
    format: '{PREFIX}/{DEPT}/{YEAR}/{SEQ}',
    example: 'CARETECH/OUTPAT/2026/4827',
    note: 'Fully disambiguated. Longest format.',
  },
];

const ManageStaffIdTemplate = () => {
  const { token, user } = useAuth();
  const { tenantId, hospital } = useTenant();

  const isAllowed = ['Admin', 'ITAdmin', 'HR'].includes(user?.role);
  const effectiveTenantId = tenantId || user?.tenantId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    displayFormat: '{PREFIX}/{DEPT}/{SEQ}',
    sequencePadding: 4,
    sequenceStrategy: 'RANDOM',
  });

  const [original, setOriginal] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Fetch the current template ──
  const fetchTemplate = useCallback(async () => {
    if (!effectiveTenantId) return;
    setLoading(true);
    try {
      const res = await api.get(`/hospitals/${effectiveTenantId}/staff-id-template`);
      const t = res.data;
      setForm({
        displayFormat: t.displayFormat || '{PREFIX}/{DEPT}/{SEQ}',
        sequencePadding: t.sequencePadding ?? 4,
        sequenceStrategy: t.sequenceStrategy || 'RANDOM',
      });
      setOriginal({
        displayFormat: t.displayFormat,
        sequencePadding: t.sequencePadding,
        sequenceStrategy: t.sequenceStrategy,
      });
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to load template';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [effectiveTenantId]);

  useEffect(() => {
    if (isAllowed) fetchTemplate();
  }, [isAllowed, fetchTemplate]);

  // ── Debounced preview on every change ──
  const fetchPreview = useCallback(async (f) => {
    if (!effectiveTenantId) return;
    setPreviewLoading(true);
    try {
      const res = await api.post(`/hospitals/${effectiveTenantId}/preview-staff-id`, {
        department: 'Outpatient',
      });
      setPreview(res.data);
    } catch (err) {
      // Preview failure shouldn't scream at the user; it's optional
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [effectiveTenantId]);

  // Whenever the format or padding changes, refresh the preview
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => fetchPreview(form), 400);
    return () => clearTimeout(t);
  }, [form.displayFormat, form.sequencePadding, loading, fetchPreview, form]);

  const hasChanges = original
    ? form.displayFormat !== original.displayFormat ||
      form.sequencePadding !== original.sequencePadding ||
      form.sequenceStrategy !== original.sequenceStrategy
    : true;

  const handleSave = async () => {
    if (!effectiveTenantId) {
      toast.error('No hospital context');
      return;
    }
    setSaving(true);
    try {
      const res = await api.put(
        `/hospitals/${effectiveTenantId}/staff-id-template`,
        form
      );
      toast.success('Staff ID template saved');
      setOriginal({
        displayFormat: res.data.displayFormat,
        sequencePadding: res.data.sequencePadding,
        sequenceStrategy: res.data.sequenceStrategy,
      });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!original) return;
    setForm(original);
  };

  const handleResetToDefault = () => {
    if (!window.confirm('Reset to the default format {PREFIX}/{DEPT}/{SEQ} with 4-digit RANDOM sequence?')) return;
    setForm({
      displayFormat: '{PREFIX}/{DEPT}/{SEQ}',
      sequencePadding: 4,
      sequenceStrategy: 'RANDOM',
    });
  };

  // ── Render guards ──
  if (!isAllowed) {
    return (
      <div className="dashboard" style={{ textAlign: 'center', padding: '60px' }}>
        <span style={{ fontSize: '48px' }}>🔒</span>
        <h3 style={{ marginTop: 16 }}>Access Denied</h3>
        <p style={{ color: '#6b7280' }}>
          Only Admin, ITAdmin, and HR can configure the staff ID template.
        </p>
      </div>
    );
  }

  if (loading) return <div className="spinner" />;

  return (
    <div className="dashboard" style={{ maxWidth: '960px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0 }}>🪪 Staff ID Template</h2>
          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
            Configure how employee IDs are generated for <strong>{hospital?.name || 'this hospital'}</strong>.
            Changes apply to every new staff member created from now on — existing IDs are not touched.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={fetchTemplate}
            className="btn btn-secondary"
            disabled={saving}
          >
            🔄 Refresh
          </button>
          <button
            type="button"
            onClick={handleResetToDefault}
            className="btn btn-secondary"
            disabled={saving}
          >
            ↺ Default
          </button>
        </div>
      </div>

      {/* ============ PRESET CARDS ============ */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '15px' }}>Quick presets</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          {PRESETS.map((p) => {
            const isActive = form.displayFormat === p.format;
            return (
              <button
                key={p.format}
                type="button"
                onClick={() => setForm((f) => ({ ...f, displayFormat: p.format }))}
                style={{
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: isActive ? '2px solid #0f3460' : '1px solid #d1d5db',
                  background: isActive ? '#f0f7ff' : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px', color: '#1f2937' }}>
                  {p.label}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'monospace', marginBottom: '4px' }}>
                  {p.example}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{p.note}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ============ FORMAT EDITOR ============ */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '15px' }}>Format</h4>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
            Display format
          </label>
          <input
            type="text"
            value={form.displayFormat}
            onChange={(e) => setForm((f) => ({ ...f, displayFormat: e.target.value }))}
            placeholder="{PREFIX}/{DEPT}/{SEQ}"
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'monospace',
            }}
          />
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
            Available tokens:{' '}
            <code style={tokenBadge}>{'{PREFIX}'}</code>{' '}
            <code style={tokenBadge}>{'{DEPT}'}</code>{' '}
            <code style={tokenBadge}>{'{YEAR}'}</code>{' '}
            <code style={tokenBadge}>{'{SEQ}'}</code>
          </div>
        </div>

        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
              Sequence padding (digits)
            </label>
            <input
              type="number"
              min={3}
              max={8}
              value={form.sequencePadding}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  sequencePadding: Math.max(3, Math.min(8, parseInt(e.target.value, 10) || 4)),
                }))
              }
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
            />
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              4 digits → 1000–9999. 6 digits → 100000–999999.
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
              Sequence strategy
            </label>
            <select
              value={form.sequenceStrategy}
              onChange={(e) => setForm((f) => ({ ...f, sequenceStrategy: e.target.value }))}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
            >
              <option value="RANDOM">RANDOM — 4-digit random, collision-safe</option>
              <option value="SEQUENTIAL">SEQUENTIAL — 0001, 0002, 0003…</option>
            </select>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              Sequential is easier to predict (useful for auditing); random is better for privacy.
            </div>
          </div>
        </div>
      </div>

      {/* ============ LIVE PREVIEW ============ */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '15px' }}>Live preview</h4>
        {previewLoading ? (
          <div style={{ color: '#6b7280', fontSize: '13px' }}>Generating…</div>
        ) : preview ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              A staff member in <strong>Outpatient</strong> would be assigned:
            </div>
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #10b981',
                borderRadius: '8px',
                padding: '14px 16px',
                fontFamily: 'monospace',
                fontSize: '18px',
                fontWeight: 600,
                color: '#065f46',
                wordBreak: 'break-all',
              }}
            >
              {preview.previewEmployeeId}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Short login number:{' '}
              <code style={tokenBadge}>{preview.previewShortNumber}</code>{' '}
              · Year: <code style={tokenBadge}>{preview.year}</code>
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
              The preview uses a random sample — the actual number is drawn at
              staff-creation time and checked for uniqueness.
            </div>
          </div>
        ) : (
          <div style={{ color: '#6b7280', fontSize: '13px' }}>
            Preview unavailable. Save the template to test with a real staff
            creation.
          </div>
        )}
      </div>

            {/* ============ SAVE / DISCARD ============ */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: '13px', color: '#6b7280' }}>
          {hasChanges
            ? '● Unsaved changes'
            : '✓ Everything is up to date'}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handleReset}
            disabled={!hasChanges || saving}
            style={{
              background: hasChanges ? '#e5e7eb' : '#f3f4f6',
              color: hasChanges ? '#1f2937' : '#9ca3af',
              border: '1px solid #d1d5db',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: hasChanges && !saving ? 'pointer' : 'not-allowed',
              opacity: hasChanges && !saving ? 1 : 0.6,
            }}
          >
            Discard changes
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            style={{
              background: hasChanges && !saving ? '#0f3460' : '#9ca3af',
              color: 'white',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: hasChanges && !saving ? 'pointer' : 'not-allowed',
              opacity: hasChanges && !saving ? 1 : 0.6,
            }}
          >
            {saving ? '⏳ Saving…' : '💾 Save template'}
          </button>
        </div>
      </div>
  );
};

const tokenBadge = {
  display: 'inline-block',
  padding: '1px 6px',
  background: '#f3f4f6',
  border: '1px solid #e5e7eb',
  borderRadius: '4px',
  fontFamily: 'monospace',
  fontSize: '11px',
  color: '#374151',
};

export default ManageStaffIdTemplate;