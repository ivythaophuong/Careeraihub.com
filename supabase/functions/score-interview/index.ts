// Supabase Edge Function: POST /functions/v1/score-interview
// Grades mock-interview answers and saves the session with a server-computed score. See handler.js.
import { handleRequest } from './handler.js';

Deno.serve((req: Request) => handleRequest(req, { env: Deno.env.toObject() }));
