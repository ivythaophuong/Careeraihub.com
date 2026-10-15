import React from 'react';
import { C } from '../../styles/theme';
import { Card, Btn } from '../../components/CommonUI';

export default function PrivacyPolicy({ onBack }) {
  return (
    <div style={{ animation: 'fadeIn 0.5s ease' }}>
      <Btn onClick={onBack} color={C.muted} style={{ marginBottom: 24 }}>← Back to Platform</Btn>
      
      <Card style={{ padding: 40, lineHeight: 1.6 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 24, color: C.text }}>Privacy Policy</h1>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: 32 }}>Last Updated: October 2026</p>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, color: C.accent, marginBottom: 12 }}>1. Information We Collect</h2>
          <p style={{ color: C.text, marginBottom: 12 }}>
            To provide our AI-powered career services, we collect information that you provide:
          </p>
          <ul style={{ color: C.text, paddingLeft: 20 }}>
            <li><strong>Resume Data:</strong> When you upload or paste your resume, we process your name, contact details, work history, and skills. A PDF you upload may also be kept in your account so you can edit it again later.</li>
            <li><strong>Account Information:</strong> Email address and name for authentication purposes.</li>
            <li><strong>Career Activity:</strong> Scans, job applications, practice interview and STAR answers, cover letters and similar items you create or save in the platform.</li>
            <li><strong>Job Search Terms:</strong> The job title and location you type into job search.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, color: C.accent, marginBottom: 12 }}>2. How We Use Your Data</h2>
          <p style={{ color: C.text, marginBottom: 12 }}>
            We use your data to:
          </p>
          <ul style={{ color: C.text, paddingLeft: 20 }}>
            <li>Analyze and improve your resume and prepare your career materials using AI models (see section 4).</li>
            <li>Generate personalized career advice and interview simulations.</li>
            <li>Save your progress and sync it across devices through our database.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, color: C.accent, marginBottom: 12 }}>3. Data Storage, Retention & Deletion</h2>
          <p style={{ color: C.text, marginBottom: 12 }}>
            We use <strong>Supabase</strong> for database management and authentication. We do not sell your personal data.
          </p>
          <p style={{ color: C.text, marginBottom: 12 }}>
            The career data saved in your account stays there until you delete it. You can remove it yourself in the Memory Dashboard with <strong>Clear memory</strong>, or ask us to delete your data or your account at the address in section 6.
          </p>
          <p style={{ color: C.text }}>
            We also keep technical logs of AI requests (time, feature, model used, size of the request and whether it succeeded, with an identifier that is not your email). These logs are made to run and protect the service and do not include the text of your resume.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, color: C.accent, marginBottom: 12 }}>4. Third-Party Services</h2>
          <p style={{ color: C.text, marginBottom: 12 }}>
            When you use a scanning, rewriting, scoring or coaching feature, the relevant part of your resume and your request are sent to an AI provider so it can answer. Today our main provider is <strong>OpenAI</strong>, and <strong>Groq</strong> is used as a backup if OpenAI is unavailable. We may change providers; when we do, this page is updated.
          </p>
          <ul style={{ color: C.text, paddingLeft: 20, marginBottom: 12 }}>
            <li><strong>OpenAI:</strong> OpenAI states that data sent to its API is not used to train or improve its models unless a customer opts in, and that it keeps abuse-monitoring logs of API usage for up to 30 days unless the law requires longer.</li>
            <li><strong>Groq:</strong> Groq states that by default it does not retain customer data for inference requests, except where needed to protect platform reliability. Its own terms apply to how it handles the data we send.</li>
          </ul>
          <p style={{ color: C.text, marginBottom: 12 }}>
            These are statements by those providers, and their terms govern what they do with the data. We do not control their systems.
          </p>
          <p style={{ color: C.text }}>
            <strong>Job search:</strong> the job title and location you search for are sent to <strong>Adzuna</strong>, our job listings provider. We do not send your resume to Adzuna.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, color: C.accent, marginBottom: 12 }}>5. Security</h2>
          <p style={{ color: C.text }}>
            Access to your saved data requires you to sign in, and our AI keys are kept on our servers and never in your browser. No online service can promise absolute security, so please do not include more personal information in your resume than you are comfortable sharing.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, color: C.accent, marginBottom: 12 }}>6. Contact Us</h2>
          <p style={{ color: C.text }}>
            If you have any questions about this policy or wish to delete your data, please contact us at <a href="mailto:hello@careeraihub.com" style={{ color: C.accent }}>hello@careeraihub.com</a>.
          </p>
        </section>
      </Card>
    </div>
  );
}
