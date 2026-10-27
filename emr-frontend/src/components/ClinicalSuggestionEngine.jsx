import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

// 1. Define your clinical rules
const CLINICAL_RULES = [
    {
        id: 'malaria_test',
        keywords: ['fever', 'hot body', 'chills', 'rigors', 'sweating', 'malaise', 'headache'],
        message: 'Patient presents with symptoms of Malaria/Typhoid. Order a Malaria Parasite (MP) test?',
        actionType: 'LAB',
        actionPayload: { testName: 'Malaria Parasite (MP)', testType: 'Haematology' }
    },
    {
        id: 'respiratory_infection',
        keywords: ['cough', 'catarrh', 'sore throat', 'chest pain', 'wheezing'],
        message: 'Respiratory symptoms detected. Prescribe Amoxicillin or order a Chest X-Ray?',
        actionType: 'PRESCRIPTION',
        actionPayload: { medication: 'Amoxicillin 500mg', dosage: '1 tablet', frequency: 'Three times daily', duration: '5 days' }
    },
    {
        id: 'urinary_tract',
        keywords: ['dysuria', 'frequent urination', 'flank pain'],
        message: 'Urinary symptoms detected. Order a Urinalysis?',
        actionType: 'LAB',
        actionPayload: { testName: 'Urinalysis', testType: 'Microbiology' }
    },
    {
        id: 'preeclampsia_warning',
        keywords: ['severe headache', 'swollen feet', 'blurred vision', 'epigastric pain'],
        message: '⚠️ PREECLAMPSIA WARNING: Check Blood Pressure immediately and order Urinalysis.',
        actionType: 'LAB',
        actionPayload: { testName: 'Urinalysis', testType: 'Microbiology' }
    }
];

const ClinicalSuggestionEngine = ({ noteText, onActionClick }) => {
    const [activeSuggestions, setActiveSuggestions] = useState([]);
    const [isVisible, setIsVisible] = useState(false);
    const debounceRef = useRef(null);

    useEffect(() => {
        // Clear previous timer if user is still typing
        if (debounceRef.current) clearTimeout(debounceRef.current);

        // Debounce: Wait 2 seconds after user stops typing to scan
        debounceRef.current = setTimeout(() => {
            if (!noteText || noteText.length < 10) {
                setActiveSuggestions([]);
                setIsVisible(false);
                return;
            }

            const lowerText = noteText.toLowerCase();
            const matches = [];

            CLINICAL_RULES.forEach(rule => {
                // Check if any keyword exists in the text
                const hasKeyword = rule.keywords.some(keyword => lowerText.includes(keyword));
                if (hasKeyword && !activeSuggestions.some(s => s.id === rule.id)) {
                    matches.push(rule);
                }
            });

            if (matches.length > 0) {
                setActiveSuggestions(prev => [...prev, ...matches]);
                setIsVisible(true);
            }
        }, 2000); // 2000ms = 2 seconds delay

        return () => clearTimeout(debounceRef.current);
    }, [noteText]);

    // Reset suggestions when the note is saved/cleared
    const dismissSuggestion = (id) => {
        const updated = activeSuggestions.filter(s => s.id !== id);
        setActiveSuggestions(updated);
        if (updated.length === 0) setIsVisible(false);
    };

    const handleAccept = (suggestion) => {
        // Pass the payload up to the parent component to open the modal
        onActionClick(suggestion.actionType, suggestion.actionPayload);
        dismissSuggestion(suggestion.id);
        toast.success('Action applied successfully!');
    };

    if (!isVisible || activeSuggestions.length === 0) return null;

    return (
        <div style={{
            position: 'fixed', bottom: '20px', right: '20px', width: '350px',
            background: '#ffffff', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            borderLeft: '5px solid #8b5cf6', zIndex: 9999, overflow: 'hidden'
        }}>
            <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '14px', color: '#1e293b' }}>💡 Clinical Assistant</strong>
                <button onClick={() => setIsVisible(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#64748b' }}>×</button>
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {activeSuggestions.map((suggestion) => (
                    <div key={suggestion.id} style={{ padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
                        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                            {suggestion.message}
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => handleAccept(suggestion)}
                                style={{ flex: 1, background: '#10b981', color: 'white', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' }}
                            >
                                ✅ Yes, Apply
                            </button>
                            <button
                                onClick={() => dismissSuggestion(suggestion.id)}
                                style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' }}
                            >
                                Ignore
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ClinicalSuggestionEngine;