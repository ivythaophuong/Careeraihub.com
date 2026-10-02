import React from 'react';
import { C } from '../../styles/theme';
import { Card, Btn } from '../../components/CommonUI';

export default function PrivacyPolicy({ onBack }) {
  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <Btn onClick={onBack} color={C.muted} style={{ marginBottom: 24 }}>← Back to Platform</Btn>
      
      <Card style={{ padding: 40, lineHeight: 1.6 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 24, color: C.text }}>Privacy Policy</h1>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: 32 }}>Last Updated: March 2026</p>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, color: C.accent, marginBottom: 12 }}>1. Information We Collect</h2>
          <p style={{ color: C.text, marginBottom: 12 }}>
            To provide our AI-powered career services, we collect information that you voluntarily provide:
          </p>
          <ul style={{ color: C.text, paddingLeft: 20 }}>
            <li><strong>Resume Data:</strong> When you upload or paste your resume, we process your name, contact details, work history, and skills.</li>
            <li><strong>Account Information:</strong> Email address and name for authentication purposes.</li>
            <li><strong>Application Data:</strong> Information about jobs you apply to through the platform.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, color: C.accent, marginBottom: 12 }}>2. How We Use Your Data</h2>
          <p style={{ color: C.text, marginBottom: 12 }}>
            Your data is used exclusively to:
          </p>
          <ul style={{ color: C.text, paddingLeft: 20 }}>
            <li>Analyze and improve your resume using AI models (Anthropic, OpenAI, or Gemini).</li>
            <li>Generate personalized career advice and interview simulations.</li>
            <li>Sync your progress across devices via our database.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, color: C.accent, marginBottom: 12 }}>3. Data Storage & Security</h2>
          <p style={{ color: C.text }}>
            All data is secured using industry-standard encryption. We use <strong>Supabase</strong> for database management and authentication. We do not sell your personal data to third parties.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, color: C.accent, marginBottom: 12 }}>Work Culture Quiz</h2>
          <p style={{ color: C.text }}>
            If you take our free Work Culture Quiz and request your full report, we store your email address, optional first name, your five culture scores and your persona result. If you tick the consent box, we use your email to send your report and occasional career tips; you can unsubscribe in any email or ask us to delete your data at <a href="mailto:hello@careeraihub.com" style={{ color: C.accent }}>hello@careeraihub.com</a>. Emails are sent through Resend. We also record anonymous usage events (such as starting or finishing the quiz) to improve it. Quiz results describe work preferences, not ability, and are not used to make decisions about you.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, color: C.accent, marginBottom: 12 }}>4. Third-Party AI Services</h2>
          <p style={{ color: C.text }}>
            When you use our scanning or generation features, relevant portions of your resume are sent to high-trust AI providers (like Anthropic) for processing. These providers do not use your data for training their models if you are using our platform.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, color: C.accent, marginBottom: 12 }}>5. Contact Us</h2>
          <p style={{ color: C.text }}>
            If you have any questions about this policy or wish to delete your data, please contact us at <a href="mailto:hello@careeraihub.com" style={{ color: C.accent }}>hello@careeraihub.com</a>.
          </p>
        </section>
      </Card>
    </div>
  );
}
