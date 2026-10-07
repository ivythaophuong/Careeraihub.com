// `resumeText` is shared by several tabs and has two legitimate shapes: a plain string (the paste box
// in App, ATS Builder) and an object `{ type, content, fileName }` written by Resume Scan after an
// upload (`content` is null for a PDF, which keeps no text). A component that calls `.trim()` on the
// object crashes the whole screen, so anything that needs plain text goes through this.
export const resumeContent = (v) =>
  typeof v === 'string' ? v : (typeof v?.content === 'string' ? v.content : '');
