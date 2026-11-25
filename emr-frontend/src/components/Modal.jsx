// src/components/Modal.jsx
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

const Modal = ({ isOpen, onClose, children, maxWidth = '620px' }) => {
  const lockRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);

    if (!lockRef.current) {
      window.__modalLockCount = (window.__modalLockCount || 0) + 1;
      if (window.__modalLockCount === 1) {
        document.body.dataset.prevOverflow = document.body.style.overflow || '';
        document.body.style.overflow = 'hidden';
      }
      lockRef.current = true;
    }

    return () => {
      document.removeEventListener('keydown', onKey);
      if (lockRef.current) {
        window.__modalLockCount = Math.max(0, (window.__modalLockCount || 1) - 1);
        if (window.__modalLockCount === 0) {
          document.body.style.overflow = document.body.dataset.prevOverflow || '';
          delete document.body.dataset.prevOverflow;
        }
        lockRef.current = false;
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay-global" onClick={onClose}>
      <div
        className="modal-content-global"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

export default Modal;