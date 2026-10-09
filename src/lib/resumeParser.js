import mammoth from 'mammoth';
import { callLLM, extractJSON } from './ai.jsx';

// ── pdfjs text extraction (no LLM required) ──────────────────────────────────
export async function extractTextFromPdfFile(file) {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js', import.meta.url
  ).toString();
  const ab = await file.arrayBuffer();
  const pdf = await getDocument({ data: ab }).promise;
  const pages = await Promise.all(
    Array.from({ length: pdf.numPages }, (_, i) =>
      pdf.getPage(i + 1).then(p => p.getTextContent())
    )
  );
  return pages.flatMap(p => p.items.map(i => i.str)).join('\n');
}

const EXTRACT_PROMPT = `Extract the resume data from the provided document and return ONLY raw JSON (no markdown, no explanation, start with {):
{
  "personalInfo": { "fullName": "", "email": "", "phone": "", "location": "", "linkedin": "", "website": "" },
  "summary": "",
  "experience": [{ "company": "", "position": "", "startDate": "", "endDate": "", "description": [] }],
  "education": [{ "school": "", "degree": "", "year": "", "gpa": "" }],
  "skills": [{ "category": "Languages", "items": [] }],
  "projects": [{ "name": "", "techStack": [], "description": [], "link": "" }],
  "certifications": [{ "name": "", "issuer": "", "date": "" }]
}
Rules:
- skills must be grouped by category (e.g. Languages, Frameworks, Tools, Platforms). If categories are unclear, use a single category "Skills".
- description fields must be arrays of bullet point strings.
- If a field has no data, use empty string or empty array.
- Do not invent data. Only extract what is present.`;

// ── PDF: send directly to LLM as base64 (Gemini reads layout natively) ───────
export const extractResumeFromPdf = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = _arrayBufferToBase64(arrayBuffer);
  const raw = await callLLM(
    [{ role: 'user', content: EXTRACT_PROMPT }],
    8192,
    base64
  );
  const parsed = extractJSON(raw);
  if (parsed.error) throw new Error('Failed to parse resume structure from PDF');
  return parsed;
};

// ── DOCX: extract text with mammoth, then send text to LLM ──────────────────
export const extractResumeFromDocx = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const { value: rawText } = await mammoth.extractRawText({ arrayBuffer });
  const raw = await callLLM([{
    role: 'user',
    content: `${EXTRACT_PROMPT}\n\nResume Text:\n${rawText}`
  }], 8192);
  const parsed = extractJSON(raw);
  if (parsed.error) throw new Error('Failed to parse resume structure from DOCX');
  return parsed;
};

// ── Router: pick the right extractor based on file type ─────────────────────
export const extractResume = async (file) => {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return extractResumeFromPdf(file);
  if (name.endsWith('.docx')) return extractResumeFromDocx(file);
  throw new Error('Please upload a .pdf or .docx file');
};

function _arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Keep old exports as aliases so nothing else breaks
export const extractTextFromPdf = async (arrayBuffer) => {
  throw new Error('Use extractResume(file) instead');
};
export const extractTextFromDocx = async (arrayBuffer) => {
  throw new Error('Use extractResume(file) instead');
};
export const mapTextToResumeSchema = async () => {
  throw new Error('Use extractResume(file) instead');
};
