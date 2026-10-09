// Supabase Edge Function: POST /functions/v1/score-star
// Grades a STAR story and saves it with a server-computed score. See handler.js.
import { handleRequest } from './handler.js';

Deno.serve((req: Request) => handleRequest(req, { env: Deno.env.toObject() }));
