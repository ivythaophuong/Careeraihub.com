// Builds a plain, single-column .docx from the resume data the templates use.
// Headings are real heading styles and bullets are real list items, so Word, Google Docs
// and an ATS all read the structure. Nothing is added or reworded: the text is the user's.
import JSZip from 'jszip';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clean = (s) => String(s ?? '').trim();

const run = (text, { bold, italic, size } = {}) =>
  `<w:r><w:rPr>${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}${size ? `<w:sz w:val="${size}"/>` : ''}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
const para = (inner, { style, bullet } = {}) =>
  `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${bullet ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : ''}</w:pPr>${inner}</w:p>`;

function bodyXml(d) {
  const contact = d.contact || {};
  const out = [];
  out.push(para(run(clean(contact.name) || 'Resume'), { style: 'Title' }));
  const line = [contact.phone, contact.email, contact.linkedin, contact.location].map(clean).filter(Boolean).join(' | ');
  if (line) out.push(para(run(line)));

  const heading = (t) => out.push(para(run(t), { style: 'Heading1' }));
  const bullets = (items) => items.map(clean).filter(Boolean).forEach(b => out.push(para(run(b), { bullet: true })));

  if (clean(d.summary)) { heading('Summary'); out.push(para(run(clean(d.summary)))); }

  const jobs = (d.experience || []).filter(j => clean(j.company));
  if (jobs.length) {
    heading('Work Experience');
    for (const j of jobs) {
      out.push(para(run(clean(j.company), { bold: true }) + (clean(j.period) ? run(` | ${clean(j.period)}`) : '')));
      if (clean(j.title)) out.push(para(run(clean(j.title), { italic: true })));
      bullets(j.bullets || []);
    }
  }

  const edu = (d.education || []).filter(e => clean(e.institution));
  if (edu.length) {
    heading('Education');
    for (const e of edu) {
      out.push(para(run(clean(e.institution), { bold: true }) + (clean(e.year) ? run(` | ${clean(e.year)}`) : '')));
      if (clean(e.degree)) out.push(para(run(clean(e.degree))));
    }
  }

  const skills = (d.skills || []).map(clean).filter(Boolean);
  if (skills.length) { heading('Skills'); out.push(para(run(skills.join(', ')))); }

  const awards = (d.awards || []).map(clean).filter(Boolean);
  if (awards.length) { heading('Awards'); bullets(awards); }

  for (const s of (d.extras || [])) {
    if (!clean(s.heading) || !(s.items || []).some(clean)) continue;
    heading(clean(s.heading));
    bullets(s.items);
  }
  return out.join('');
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const STYLES = `${XML}<w:styles ${NS}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="40"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="808080"/></w:pBdr><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
</w:styles>`;

const NUMBERING = `${XML}<w:numbering ${NS}>
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>
<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#8226;"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="260"/></w:pPr></w:lvl>
</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

const CONTENT_TYPES = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;

const ROOT_RELS = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

const DOC_RELS = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;

// A4, 0.75 inch margins.
const SECT = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>';

export async function buildResumeDocx(data) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', ROOT_RELS);
  zip.file('word/_rels/document.xml.rels', DOC_RELS);
  zip.file('word/styles.xml', STYLES);
  zip.file('word/numbering.xml', NUMBERING);
  zip.file('word/document.xml', `${XML}<w:document ${NS}><w:body>${bodyXml(data || {})}${SECT}</w:body></w:document>`);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export function downloadBlob(bytes, filename, type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
