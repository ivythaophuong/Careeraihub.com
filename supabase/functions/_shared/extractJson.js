// Server copy of extractJSON (src/lib/ai.jsx): pulls the first {...} object out of a model reply.
export function extractJSON(str) {
  try {
    const cleaned = String(str)
      .replace(/[​-‍⁠﻿]/g, '')
      .replace(/`{1,3}json\s*/gi, '')
      .replace(/`{1,3}\s*/g, '')
      .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) return { error: true, msg: 'No JSON found in AI response' };
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return { error: true, msg: 'Failed to parse AI response' };
  }
}
