// Supabase Edge Function: POST /functions/v1/transcribe
// Turns a recorded answer into text for voice practice. Off unless VOICE_TRANSCRIBE=on. See handler.js and README.md.
import { handleRequest } from './handler.js';

Deno.serve((req: Request) => handleRequest(req, { env: Deno.env.toObject() }));
