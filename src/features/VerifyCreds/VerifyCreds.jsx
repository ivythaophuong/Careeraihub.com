import React, { useState, useRef } from 'react';
import { C } from '../../styles/theme';
import jsQR from 'jsqr';
import { getValidSession } from '../../lib/session';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ruibdsvrcctxgxctaxwe.supabase.co';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1aWJkc3ZyY2N0eGd4Y3RheHdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Nzg3MjksImV4cCI6MjA4OTA1NDcyOX0.TB2jdImKiHx6oP0aNNXObShT_eHk0wvtN_As5tkbcmE';

// ── URL patterns to scan for inside certificate PDFs ─────────────────────────

const CERT_URL_PATTERNS = [
  /https?:\/\/(?:www\.)?credly\.com\/badges\/[a-f0-9-]+(?:\/public_url)?/i,
  /https?:\/\/(?:www\.)?coursera\.org\/verify\/[A-Z0-9]+/i,
  /https?:\/\/(?:www\.)?coursera\.org\/account\/accomplishments\/[A-Z0-9]+/i,
  /https?:\/\/(?:www\.)?udemy\.com\/certificate\/[A-Z0-9]+/i,
  /https?:\/\/(?:www\.)?linkedin\.com\/learning\/certificates\/[A-Za-z0-9_-]+/i,
  /https?:\/\/(?:www\.)?credential\.net\/[a-z0-9]+/i,
  /https?:\/\/(?:[a-z]+\.)?accredible\.com\/[a-z0-9-]+/i,
  /https?:\/\/learn\.microsoft\.com\/.+\/credentials\/[A-Za-z0-9-]+/i,
  /https?:\/\/opencerts\.io\/[A-Za-z0-9?=&]+/i,
  /https?:\/\/(?:courses\.)?edx\.org\/certificates\/[A-Za-z0-9]+/i,
  /https?:\/\/(?:www\.)?freecodecamp\.org\/certification\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+/i,
  /https?:\/\/(?:www\.)?kaggle\.com\/learn\/certification\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+/i,
  /https?:\/\/(?:www\.)?datacamp\.com\/certificate\/[A-Z0-9]+/i,
  /https?:\/\/trailhead\.salesforce\.com\/(?:[a-z]{2}\/)?credentials\/[A-Za-z0-9?=&_-]+/i,
  /https?:\/\/(?:www\.)?pluralsight\.com\/achievements\/[A-Za-z0-9_-]+/i,
  /https?:\/\/(?:app\.)?hubspot\.com\/academy\/achievements\/[A-Za-z0-9_-]+/i,
  /https?:\/\/(?:www\.)?codecademy\.com\/profiles\/[A-Za-z0-9_-]+\/certificates\/[A-Za-z0-9]+/i,
  /https?:\/\/(?:grow\.google\/certificates\/[A-Za-z0-9?=&_-]+|skillshop\.exceedlms\.com\/[A-Za-z0-9/?=&_-]+)/i,
  /https?:\/\/(?:www\.)?duolingo\.com\/certificates\/[A-Za-z0-9]+/i,
];

function findCertUrl(text) {
  for (const pat of CERT_URL_PATTERNS) {
    const m = text.match(pat);
    if (m) return m[0].replace(/[.,;)>\]"']+$/, ''); // strip trailing punctuation
  }
  return null;
}

async function extractUrlFromPdf(file) {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js', import.meta.url
  ).toString();

  const ab = await file.arrayBuffer();
  const pdf = await getDocument({ data: ab }).promise;

  // 1. Text extraction across all pages
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const text = content.items.map(i => i.str).join(' ');
    const url = findCertUrl(text);
    if (url) return url;
  }

  // 2. QR code scan — render each page to canvas, scan with jsQR
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const scale = 2;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code?.data) {
      const url = findCertUrl(code.data) || (code.data.startsWith('http') ? code.data : null);
      if (url) return url;
    }
  }

  return null;
}

// ── Platform detection ────────────────────────────────────────────────────────

const PLATFORMS = {
  credly: {
    label: 'Credly',
    color: '#F07A37',
    icon: '🏅',
    covers: 'AWS · Google Cloud · Cisco · CompTIA · IBM · Salesforce',
    canVerify: true,
  },
  coursera: {
    label: 'Coursera',
    color: '#0056D2',
    icon: '🎓',
    covers: 'Coursera · DeepLearning.AI · Google · Stanford',
    canVerify: true,
  },
  udemy: {
    label: 'Udemy',
    color: '#A435F0',
    icon: '📚',
    covers: 'Udemy',
    canVerify: true,
  },
  linkedin_learning: {
    label: 'LinkedIn Learning',
    color: '#0077B5',
    icon: '💼',
    covers: 'LinkedIn Learning',
    canVerify: false,
  },
  accredible: {
    label: 'Accredible',
    color: '#2D9CDB',
    icon: '📜',
    covers: 'Google Cloud (legacy) · Various',
    canVerify: true,
  },
  microsoft: {
    label: 'Microsoft Learn',
    color: '#00A4EF',
    icon: '🪟',
    covers: 'Microsoft certifications',
    canVerify: false,
  },
  opencerts: {
    label: 'OpenCerts',
    color: '#E6007E',
    icon: '🔗',
    covers: 'Singapore academic institutions',
    canVerify: false,
  },
  edx: {
    label: 'edX',
    color: '#0068A5',
    icon: '🏫',
    covers: 'edX · MIT · Harvard · Berkeley',
    canVerify: true,
  },
  freecodecamp: {
    label: 'freeCodeCamp',
    color: '#00C4A7',
    icon: '🔥',
    covers: 'freeCodeCamp certifications',
    canVerify: true,
  },
  kaggle: {
    label: 'Kaggle',
    color: '#20BEFF',
    icon: '📊',
    covers: 'Kaggle Learn certifications',
    canVerify: true,
  },
  datacamp: {
    label: 'DataCamp',
    color: '#03EF62',
    icon: '📈',
    covers: 'DataCamp certifications',
    canVerify: false,
  },
  salesforce: {
    label: 'Salesforce',
    color: '#00A1E0',
    icon: '☁️',
    covers: 'Salesforce · Trailhead credentials',
    canVerify: false,
  },
  pluralsight: {
    label: 'Pluralsight',
    color: '#F15B2A',
    icon: '▶️',
    covers: 'Pluralsight skill assessments',
    canVerify: false,
  },
  hubspot: {
    label: 'HubSpot',
    color: '#FF7A59',
    icon: '🔶',
    covers: 'HubSpot Academy certifications',
    canVerify: false,
  },
  codecademy: {
    label: 'Codecademy',
    color: '#1FA2A0',
    icon: '💻',
    covers: 'Codecademy courses',
    canVerify: false,
  },
  google: {
    label: 'Google',
    color: '#4285F4',
    icon: '🔵',
    covers: 'Google Career Certificates · Grow with Google',
    canVerify: false,
  },
  duolingo: {
    label: 'Duolingo',
    color: '#58CC02',
    icon: '🦉',
    covers: 'Duolingo English Test · language certs',
    canVerify: false,
  },
  manual: {
    label: 'Other',
    color: '#6B7280',
    icon: '📋',
    covers: 'Tableau · Meta Blueprint · Certiport · etc.',
    canVerify: false,
  },
};

function detectPlatform(url) {
  if (!url) return 'manual';
  const u = url.toLowerCase();
  if (u.includes('credly.com/badges/')) return 'credly';
  if (u.includes('coursera.org/verify/') || u.includes('coursera.org/account/accomplishments/')) return 'coursera';
  if (u.includes('udemy.com/certificate/')) return 'udemy';
  if (u.includes('linkedin.com/learning/certificates/')) return 'linkedin_learning';
  if (u.includes('credential.net/') || u.includes('accredible.com')) return 'accredible';
  if (u.includes('learn.microsoft.com') || u.includes('microsoft.com/learning')) return 'microsoft';
  if (u.includes('opencerts.io') || u.includes('opencerts')) return 'opencerts';
  if (u.includes('edx.org/certificates/') || u.includes('courses.edx.org/certificates/')) return 'edx';
  if (u.includes('freecodecamp.org/certification/')) return 'freecodecamp';
  if (u.includes('kaggle.com/learn/certification/')) return 'kaggle';
  if (u.includes('datacamp.com/certificate/')) return 'datacamp';
  if (u.includes('trailhead.salesforce.com/credentials')) return 'salesforce';
  if (u.includes('pluralsight.com/achievements')) return 'pluralsight';
  if (u.includes('hubspot.com/academy')) return 'hubspot';
  if (u.includes('codecademy.com/profiles') && u.includes('/certificates/')) return 'codecademy';
  if (u.includes('grow.google/certificates') || u.includes('skillshop.exceedlms.com')) return 'google';
  if (u.includes('duolingo.com/certificates/')) return 'duolingo';
  return 'manual';
}

function extractCredlyUuid(url) {
  const m = url.match(/credly\.com\/badges\/([a-f0-9-]+)/i);
  return m ? m[1] : null;
}

// ── Verifier ──────────────────────────────────────────────────────────────────

const PROXY_PLATFORMS = new Set(['coursera', 'udemy', 'accredible', 'edx', 'freecodecamp', 'kaggle']);

async function verifyCredential(url) {
  const platform = detectPlatform(url);

  // Credly — direct browser API (CORS-open)
  if (platform === 'credly') {
    const uuid = extractCredlyUuid(url);
    if (!uuid) throw new Error('Could not extract badge ID from URL.');
    const res = await fetch(`https://www.credly.com/badges/${uuid}.json`);
    if (!res.ok) throw new Error(`Credly returned ${res.status}. Badge may be private or invalid.`);
    const json = await res.json();
    const d = json.data;
    if (!d) throw new Error('Unexpected Credly response format.');
    return {
      verified: true,
      platform: 'credly',
      name: d.badge?.name || 'Unknown credential',
      issuer: d.badge?.issuer?.entities?.[0]?.entity?.name || d.badge?.issuer?.summary || 'Unknown issuer',
      issuedAt: d.issued_at_date || d.issued_at?.slice(0, 10) || null,
      expiresAt: d.expires_at_date || null,
      recipientName: d.user?.name || null,
      skills: (d.badge?.skills || []).map(s => s.name).slice(0, 6),
      imageUrl: d.badge?.image_url || null,
      badgeUrl: `https://www.credly.com/badges/${uuid}/public_url`,
    };
  }

  // Coursera, Udemy, Accredible, edX, freeCodeCamp — via Supabase edge function proxy
  if (PROXY_PLATFORMS.has(platform)) {
    // The function needs the signed-in user's token (the public anon key alone is rejected).
    const session = await getValidSession();
    if (!session?.access_token) throw new Error('Please sign in to verify credentials.');
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-cert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON, Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Verification failed (${res.status})`);
    }
    // `verified` comes from the server: a page that loads is not proof of a certificate.
    const data = await res.json();
    return { ...data, urlValid: true };
  }

  // All others — URL format validation only
  const urlPatterns = {
    linkedin_learning: /linkedin\.com\/learning\/certificates\/[A-Za-z0-9]+/i,
    microsoft: /learn\.microsoft\.com\/.+credentials/i,
    opencerts: /opencerts\.io/i,
    datacamp: /datacamp\.com\/certificate\/[A-Z0-9]+/i,
    salesforce: /trailhead\.salesforce\.com\/(?:[a-z]{2}\/)?credentials/i,
    pluralsight: /pluralsight\.com\/achievements\/[A-Za-z0-9_-]+/i,
    hubspot: /(?:app\.)?hubspot\.com\/academy\/achievements/i,
    codecademy: /codecademy\.com\/profiles\/[A-Za-z0-9_-]+\/certificates/i,
    google: /(?:grow\.google\/certificates|skillshop\.exceedlms\.com)/i,
    duolingo: /duolingo\.com\/certificates\/[A-Za-z0-9]+/i,
  };
  const pattern = urlPatterns[platform];
  return {
    verified: false,
    urlValid: pattern ? pattern.test(url) : url.startsWith('http'),
    platform,
    name: null,
    issuer: null,
    issuedAt: null,
    badgeUrl: url,
  };
}

// ── Trust score computation ───────────────────────────────────────────────────

function computeTrustScore(credentials) {
  let certPts = 0;
  (credentials || []).forEach(c => {
    if (c.status === 'verified') certPts += 15;
    else if (c.status === 'url_valid') certPts += 5;
  });
  return { certifications: Math.min(certPts, 45), total: Math.min(certPts, 45) };
}

// ── Platform domain map (for logo fetching) ───────────────────────────────────

const PLATFORM_DOMAINS = {
  credly: 'credly.com',
  coursera: 'coursera.org',
  udemy: 'udemy.com',
  linkedin_learning: 'linkedin.com',
  accredible: 'accredible.com',
  microsoft: 'microsoft.com',
  opencerts: 'opencerts.io',
  edx: 'edx.org',
  freecodecamp: 'freecodecamp.org',
  kaggle: 'kaggle.com',
  datacamp: 'datacamp.com',
  salesforce: 'salesforce.com',
  pluralsight: 'pluralsight.com',
  hubspot: 'hubspot.com',
  codecademy: 'codecademy.com',
  google: 'google.com',
  duolingo: 'duolingo.com',
};

function PlatformLogo({ platform, size = 16 }) {
  const [failed, setFailed] = useState(false);
  const domain = PLATFORM_DOMAINS[platform];
  const p = PLATFORMS[platform] || PLATFORMS.manual;
  if (!domain || failed) return <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>{p.icon}</span>;
  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={p.label}
      width={size}
      height={size}
      style={{ borderRadius: 3, objectFit: 'contain', display: 'block', flexShrink: 0 }}
      onError={() => setFailed(true)}
    />
  );
}

// ── Platform pill ─────────────────────────────────────────────────────────────

function PlatformPill({ platform }) {
  const p = PLATFORMS[platform] || PLATFORMS.manual;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: p.color + '18', border: `1px solid ${p.color}44`,
      borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 700, color: p.color,
    }}>
      <PlatformLogo platform={platform} size={14} /> {p.label}
    </span>
  );
}

// ── Issuer options per platform ───────────────────────────────────────────────

const PLATFORM_ISSUERS = {
  credly: [
    'Amazon Web Services', 'Google Cloud', 'Cisco', 'CompTIA', 'IBM', 'Salesforce',
    'Microsoft', 'VMware', 'Red Hat', 'Oracle', 'ISACA', 'ISC²',
    'Project Management Institute', 'HashiCorp', 'Databricks', 'Atlassian',
    'ServiceNow', 'Palo Alto Networks', 'CrowdStrike', 'Splunk',
  ],
  coursera: [
    'DeepLearning.AI', 'Google', 'IBM', 'Meta', 'Stanford University',
    'University of Michigan', 'Duke University', 'Johns Hopkins University',
    'University of London', 'Coursera',
  ],
  udemy: ['Udemy'],
  linkedin_learning: ['LinkedIn Learning'],
  accredible: ['Google Cloud', 'Accredible'],
  microsoft: ['Microsoft'],
  opencerts: [
    'Nanyang Technological University', 'National University of Singapore',
    'Singapore Management University', 'Singapore Polytechnic',
  ],
  edx: [
    'MIT', 'Harvard University', 'Berkeley', 'Microsoft', 'IBM',
    'Linux Foundation', 'University of Texas', 'Columbia University', 'edX',
  ],
  freecodecamp: ['freeCodeCamp'],
  kaggle: ['Kaggle', 'Google'],
  datacamp: ['DataCamp'],
  salesforce: ['Salesforce'],
  pluralsight: ['Pluralsight'],
  hubspot: ['HubSpot'],
  codecademy: ['Codecademy'],
  google: ['Google'],
  duolingo: ['Duolingo'],
  manual: [
    'Tableau', 'Meta Blueprint', 'Scrum Alliance', 'PMI', 'ISACA', 'Certiport',
  ],
};

// ── Add credential modal ──────────────────────────────────────────────────────

function AddModal({ onAdd, onClose, existingCredentials }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [issuerCustom, setIssuerCustom] = useState('');
  const [date, setDate] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState('');
  const [pdfDragOver, setPdfDragOver] = useState(false);
  const [err, setErr] = useState('');
  const pdfRef = useRef(null);

  const detectedPlatform = detectPlatform(url);
  const p = PLATFORMS[detectedPlatform] || PLATFORMS.manual;
  const issuerOptions = PLATFORM_ISSUERS[detectedPlatform] || PLATFORM_ISSUERS.manual;
  const effectiveIssuer = issuer === '__other__' ? issuerCustom.trim() : issuer;

  // Auto-select issuer when platform changes
  React.useEffect(() => {
    const opts = PLATFORM_ISSUERS[detectedPlatform] || PLATFORM_ISSUERS.manual;
    if (opts.length === 1) {
      setIssuer(opts[0]);
    } else {
      setIssuer('');
    }
    setIssuerCustom('');
  }, [detectedPlatform]);

  const handlePdfFile = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setErr('Only PDF files supported for auto-extraction.');
      return;
    }
    setErr(''); setExtractMsg('Scanning PDF for certificate URL…'); setExtracting(true);
    try {
      const found = await extractUrlFromPdf(file);
      if (found) {
        setUrl(found);
        setExtractMsg(`✓ URL extracted from PDF`);
      } else {
        setExtractMsg('No verification URL found — paste it manually below.');
      }
    } catch (e) {
      setExtractMsg('');
      setErr('PDF scan failed: ' + e.message);
    }
    setExtracting(false);
  };

  const handleAdd = async () => {
    if (!name.trim()) { setErr('Credential name is required.'); return; }
    if (url.trim() && existingCredentials?.some(c => c.url && c.url === url.trim())) {
      setErr('This credential URL is already in your profile.');
      return;
    }
    setErr('');
    let result = { verified: false, urlValid: false, platform: detectedPlatform };

    if (url.trim()) {
      setVerifying(true);
      try {
        result = await verifyCredential(url.trim());
      } catch (e) {
        // Network / CORS errors mean we can't reach the issuer right now.
        // Save as url_valid (URL pattern matched) or manual and let user retry later.
        const isNetworkErr = e.message.toLowerCase().includes('fetch') || e.message.toLowerCase().includes('network') || e.message.toLowerCase().includes('failed');
        const urlPatternValid = CERT_URL_PATTERNS.some(p => p.test(url.trim()));
        result = { verified: false, urlValid: urlPatternValid, platform: detectedPlatform };
        if (!isNetworkErr) {
          setErr(e.message);
          setVerifying(false);
          return;
        }
        setVerifying(false);
        // Network error — fall through and save as url_valid/manual; user can retry from card
      }
      setVerifying(false);
    }

    const cred = {
      id: Date.now().toString(),
      name: result.name || name.trim(),
      issuer: result.issuer || effectiveIssuer || p.label,
      platform: detectedPlatform,
      url: url.trim() || null,
      status: result.verified ? 'verified' : result.urlValid ? 'url_valid' : 'manual',
      issuedAt: result.issuedAt || date || null,
      expiresAt: result.expiresAt || null,
      recipientName: result.recipientName || null,
      skills: result.skills || [],
      imageUrl: result.imageUrl || null,
      badgeUrl: result.badgeUrl || url.trim() || null,
      addedAt: new Date().toISOString(),
    };

    onAdd(cred);
  };

  const inp = {
    width: '100%', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)',
    borderRadius: 8, padding: '9px 12px', color: 'var(--lp-text)', fontSize: 13,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}>
      <div style={{ background: 'var(--lp-bg2)', border: '1px solid var(--lp-bdr)', borderRadius: 16, padding: 28, width: 440, maxWidth: '92vw', display: 'flex', flexDirection: 'column', gap: 16 }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--lp-text)' }}>Add credential</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--lp-text3)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* PDF upload zone — auto-extracts URL */}
        <div
          onDragOver={e => { e.preventDefault(); setPdfDragOver(true); }}
          onDragLeave={() => setPdfDragOver(false)}
          onDrop={e => { e.preventDefault(); setPdfDragOver(false); handlePdfFile(e.dataTransfer.files[0]); }}
          onClick={() => !extracting && pdfRef.current?.click()}
          style={{
            border: `2px dashed ${pdfDragOver ? 'var(--lp-teal)' : url ? 'rgba(0,229,160,.3)' : 'var(--lp-bdr)'}`,
            borderRadius: 12, padding: '18px 16px', cursor: extracting ? 'default' : 'pointer',
            background: pdfDragOver ? 'rgba(236,72,153,.04)' : url ? 'rgba(0,229,160,.03)' : 'transparent',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            transition: 'all .15s',
          }}
        >
          <input ref={pdfRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handlePdfFile(e.target.files[0])} />
          {extracting ? (
            <>
              <div style={{ fontSize: 20, opacity: .6 }}>⏳</div>
              <div style={{ fontSize: 12, color: 'var(--lp-text3)' }}>{extractMsg}</div>
            </>
          ) : extractMsg && url ? (
            <>
              <div style={{ fontSize: 20 }}>✅</div>
              <div style={{ fontSize: 12, color: '#00E5A0', fontWeight: 700 }}>{extractMsg}</div>
              <div style={{ fontSize: 10, color: 'var(--lp-text3)' }}>Drop another PDF to re-scan</div>
            </>
          ) : extractMsg && !url ? (
            <>
              <div style={{ fontSize: 20, opacity: .5 }}>🔍</div>
              <div style={{ fontSize: 12, color: '#FFB84D' }}>{extractMsg}</div>
              <div style={{ fontSize: 10, color: 'var(--lp-text3)' }}>Paste URL manually below</div>
            </>
          ) : (
            <>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--lp-bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📄</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-text2)' }}>Upload certificate PDF</div>
                <div style={{ fontSize: 11, color: 'var(--lp-text3)', marginTop: 2 }}>We scan for the verification URL &amp; QR code automatically</div>
              </div>
            </>
          )}
        </div>

        {/* URL field — auto-populated from PDF or manual paste */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--lp-text3)' }}>
            Credential URL <span style={{ color: 'var(--lp-text3)', fontWeight: 400, textTransform: 'none' }}>(auto-filled from PDF or paste manually)</span>
          </label>
          <input
            style={inp}
            value={url}
            onChange={e => { setUrl(e.target.value); setExtractMsg(''); }}
            placeholder="https://www.credly.com/badges/... or coursera.org/verify/..."
          />
          {url && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <PlatformPill platform={detectedPlatform} />
              {PLATFORMS[detectedPlatform]?.canVerify
                ? <span style={{ color: '#00E5A0', fontWeight: 600 }}>✓ Full verification available</span>
                : <span style={{ color: '#FFB84D' }}>URL-format verification only</span>
              }
            </div>
          )}
        </div>

        {/* Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--lp-text3)' }}>
            Credential name <span style={{ color: '#FF5A5A' }}>*</span>
          </label>
          <input style={inp} value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Machine Learning Specialization" />
        </div>

        <div className="vc-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--lp-text3)' }}>Issuer</label>
            <select
              style={{ ...inp, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28 }}
              value={issuer}
              onChange={e => { setIssuer(e.target.value); if (e.target.value !== '__other__') setIssuerCustom(''); }}
            >
              <option value="">— Select issuer —</option>
              {issuerOptions.map(o => <option key={o} value={o}>{o}</option>)}
              <option value="__other__">Other…</option>
            </select>
            {issuer === '__other__' && (
              <input style={{ ...inp, marginTop: 4 }} value={issuerCustom} onChange={e => setIssuerCustom(e.target.value)} placeholder="Type issuer name" autoFocus />
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--lp-text3)' }}>Issue date</label>
            <input style={inp} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        {err && <div style={{ background: 'rgba(255,90,90,.08)', border: '1px solid rgba(255,90,90,.25)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#FF5A5A' }}>⚠ {err}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px 0', background: 'transparent',
            border: '1px solid var(--lp-bdr)', color: 'var(--lp-text3)',
            borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}>Cancel</button>
          <button onClick={handleAdd} disabled={verifying || !name.trim()} style={{
            flex: 2, padding: '11px 0',
            background: verifying || !name.trim() ? 'var(--lp-bdr)' : 'var(--lp-teal)',
            color: verifying || !name.trim() ? 'var(--lp-text3)' : '#000',
            border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 800,
            cursor: verifying || !name.trim() ? 'default' : 'pointer', fontFamily: 'inherit',
          }}>
            {verifying ? 'Verifying…' : PLATFORMS[detectedPlatform]?.canVerify && url ? 'Verify & Add →' : 'Add credential →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Credential row ────────────────────────────────────────────────────────────

function CredRow({ cred, onRemove, onReverify }) {
  const [reverifying, setReverifying] = useState(false);
  const [err, setErr] = useState('');
  const p = PLATFORMS[cred.platform] || PLATFORMS.manual;

  const handleReverify = async () => {
    if (!cred.url) return;
    setReverifying(true); setErr('');
    try {
      const result = await verifyCredential(cred.url);
      onReverify(cred.id, result);
    } catch (e) {
      setErr(e.message);
    }
    setReverifying(false);
  };

  const statusBadge = () => {
    if (cred.status === 'verified') return (
      <span style={{ background: 'rgba(0,229,160,.1)', color: '#00E5A0', border: '1px solid rgba(0,229,160,.25)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>✓ Verified</span>
    );
    if (cred.status === 'url_valid') return (
      <span style={{ background: 'rgba(255,184,77,.08)', color: '#FFB84D', border: '1px solid rgba(255,184,77,.25)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>○ URL valid</span>
    );
    return (
      <span style={{ background: 'var(--lp-bg3)', color: 'var(--lp-text3)', border: '1px solid var(--lp-bdr)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>Manual</span>
    );
  };

  return (
    <div style={{ background: 'var(--lp-bg3)', border: `1px solid ${cred.status === 'verified' ? 'rgba(0,229,160,.2)' : 'var(--lp-bdr)'}`, borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, transition: 'border-color .2s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Icon or badge image */}
        {cred.imageUrl ? (
          <img src={cred.imageUrl} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'contain', background: '#fff', padding: 3, flexShrink: 0 }} />
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: 8, background: p.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PlatformLogo platform={cred.platform} size={22} />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-text)' }}>{cred.name}</span>
            {statusBadge()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--lp-text3)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>{cred.issuer}</span>
            {cred.issuedAt && <><span>·</span><span>Issued {cred.issuedAt}</span></>}
            {cred.expiresAt && <><span>·</span><span style={{ color: '#FFB84D' }}>Expires {cred.expiresAt}</span></>}
          </div>
          <div style={{ marginTop: 5 }}><PlatformPill platform={cred.platform} /></div>
        </div>
      </div>

      {/* Skills chips (Credly) */}
      {cred.skills?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {cred.skills.map((s, i) => (
            <span key={i} style={{ background: 'rgba(236,72,153,.08)', border: '1px solid rgba(236,72,153,.18)', color: 'var(--lp-teal)', borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>{s}</span>
          ))}
        </div>
      )}

      {err && <div style={{ fontSize: 11, color: '#FF5A5A' }}>⚠ {err}</div>}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {cred.badgeUrl && (
          <a href={cred.badgeUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--lp-teal)', fontWeight: 600, textDecoration: 'none' }}>
            View ↗
          </a>
        )}
        {cred.url && cred.status !== 'verified' && PLATFORMS[cred.platform]?.canVerify && (
          <button onClick={handleReverify} disabled={reverifying} style={{
            background: 'none', border: '1px solid rgba(236,72,153,.3)', color: 'var(--lp-teal)',
            borderRadius: 6, padding: '4px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>{reverifying ? 'Verifying…' : 'Verify now →'}</button>
        )}
        <button onClick={() => onRemove(cred.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--lp-text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VerifyCreds({ memory, updateMemory, setActiveModule }) {
  const [showAdd, setShowAdd] = useState(false);

  const credentials = memory?.credentials || [];
  const { certifications, total } = computeTrustScore(credentials);
  const verified = credentials.filter(c => c.status === 'verified').length;

  const addCredential = (cred) => {
    updateMemory(m => ({ ...m, credentials: [...(m.credentials || []), cred] }));
    setShowAdd(false);
  };

  const removeCredential = (id) => {
    updateMemory(m => ({ ...m, credentials: (m.credentials || []).filter(c => c.id !== id) }));
  };

  const reverifyCredential = (id, result) => {
    updateMemory(m => ({
      ...m,
      credentials: (m.credentials || []).map(c => c.id !== id ? c : {
        ...c,
        status: result.verified ? 'verified' : result.urlValid ? 'url_valid' : c.status,
        name: result.name || c.name,
        issuer: result.issuer || c.issuer,
        issuedAt: result.issuedAt || c.issuedAt,
        expiresAt: result.expiresAt || c.expiresAt,
        skills: result.skills?.length ? result.skills : c.skills,
        imageUrl: result.imageUrl || c.imageUrl,
        recipientName: result.recipientName || c.recipientName,
      }),
    }));
  };

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 860 }}>
      <style>{`@keyframes vc-fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--lp-text)', letterSpacing: '-.02em', marginBottom: 4 }}>Verify Credentials</div>
          <div style={{ fontSize: 13, color: 'var(--lp-text3)' }}>
            Verified credentials boost your Trust Score and unlock TrustMatch recruiter visibility.
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} style={{
          padding: '10px 18px', background: 'linear-gradient(135deg,#EC4899,#F59E0B)',
          color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800,
          cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(236,72,153,.2)',
        }}>+ Add credential</button>
      </div>

      <div className="vc-main-grid" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Trust score panel */}
        <div style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 14, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--lp-text3)' }}>Trust score</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, fontWeight: 900, color: total >= 40 ? '#00E5A0' : total >= 20 ? '#FFB84D' : '#FF5A5A', lineHeight: 1, fontFamily: 'var(--lp-ff)' }}>{total}</div>
            <div style={{ fontSize: 12, color: 'var(--lp-text3)', marginTop: 2 }}>/100</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Education', val: 0 },
              { label: 'Work experience', val: 0 },
              { label: 'Certifications', val: certifications },
              { label: 'Skills', val: 0 },
            ].map(row => {
              const col = row.val >= 30 ? '#00E5A0' : row.val > 0 ? '#FFB84D' : 'var(--lp-bdr)';
              return (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--lp-text3)', width: 110, flexShrink: 0 }}>{row.label}</span>
                  <div style={{ flex: 1, height: 4, background: 'var(--lp-bg2)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${row.val}%`, background: col, borderRadius: 2, transition: 'width .6s' }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: col, width: 20, textAlign: 'right' }}>{row.val}</span>
                </div>
              );
            })}
          </div>

          {total < 65 && (
            <div style={{ background: 'rgba(236,72,153,.05)', border: '1px solid rgba(236,72,153,.12)', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: 'var(--lp-text2)', lineHeight: 1.6 }}>
              Reach <strong style={{ color: C.accent }}>65+</strong> to unlock TrustMatch recruiter visibility.
            </div>
          )}

          <div style={{ fontSize: 11, color: 'var(--lp-text3)', lineHeight: 1.6 }}>
            <div style={{ marginBottom: 4, fontWeight: 600, color: 'var(--lp-text2)' }}>Score breakdown:</div>
            <div>Verified: +15 each</div>
            <div>URL valid: +5 each</div>
            <div>Max from certs: 45 pts</div>
          </div>

          {total >= 65 && (
            <button onClick={() => setActiveModule?.('trustmatch')} style={{ padding: '9px 0', background: 'var(--lp-teal)', color: '#000', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              View TrustMatch →
            </button>
          )}
        </div>

        {/* Credentials list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'vc-fadein .3s ease' }}>

          {credentials.length === 0 && (
            <div style={{ background: 'var(--lp-bg3)', border: '2px dashed var(--lp-bdr)', borderRadius: 14, padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 32, opacity: .4 }}>🏅</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--lp-text2)' }}>No credentials yet</div>
              <div style={{ fontSize: 12, color: 'var(--lp-text3)', textAlign: 'center', maxWidth: 300 }}>
                Add credentials from Credly, Coursera, Udemy, Kaggle, edX, LinkedIn Learning, and 10+ more platforms.
              </div>
              <button onClick={() => setShowAdd(true)} style={{
                padding: '9px 20px', background: 'var(--lp-teal)', color: '#000',
                border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              }}>+ Add first credential</button>
            </div>
          )}

          {credentials.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--lp-text3)' }}>
                  {credentials.length} credential{credentials.length !== 1 ? 's' : ''} · {verified} verified
                </div>
              </div>
              {credentials.map(cred => (
                <CredRow
                  key={cred.id}
                  cred={cred}
                  onRemove={removeCredential}
                  onReverify={reverifyCredential}
                />
              ))}
            </>
          )}

          {/* Platform coverage note */}
          <div style={{ background: 'var(--lp-bg3)', borderRadius: 12, padding: '14px 18px', fontSize: 11, color: 'var(--lp-text3)', lineHeight: 1.8 }}>
            <div style={{ fontWeight: 700, color: 'var(--lp-text2)', marginBottom: 6 }}>Verification coverage</div>
            <div><span style={{ color: '#00E5A0' }}>✓ Full verification</span> — Credly · Coursera · Udemy · Accredible · edX · freeCodeCamp · Kaggle</div>
            <div><span style={{ color: '#FFB84D' }}>○ URL validation</span> — LinkedIn Learning · Microsoft · OpenCerts · Salesforce · Pluralsight · DataCamp · HubSpot · Codecademy · Google · Duolingo</div>
            <div><span style={{ color: 'var(--lp-text3)' }}>+ Manual</span> — Any other platform (name + issuer stored, no URL check)</div>
          </div>
        </div>
      </div>

      {showAdd && <AddModal onAdd={addCredential} onClose={() => setShowAdd(false)} existingCredentials={credentials} />}
    </div>
  );
}
