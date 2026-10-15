import React from 'react';
import { C } from '../../styles/theme';
import { Card, Btn } from '../../components/CommonUI';
import LegalDocument from './LegalDocument.jsx';
import { TERMS_SECTIONS, LEGAL_UPDATED } from './legalContent.js';

export default function TermsOfService({ onBack }) {
  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <Btn onClick={onBack} color={C.muted} style={{ marginBottom: 24 }}>← Back to Platform</Btn>

      <Card style={{ padding: 40, lineHeight: 1.6 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 24, color: C.text }}>Terms of Service</h1>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: 32 }}>Last Updated: {LEGAL_UPDATED}</p>
        <LegalDocument sections={TERMS_SECTIONS} headColor={C.accent} textColor={C.text} />
      </Card>
    </div>
  );
}
