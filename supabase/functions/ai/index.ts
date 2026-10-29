// Supabase Edge Function: POST /functions/v1/ai
// Keeps AI provider keys on the server. See README.md for setup.
import { handleRequest } from './handler.js';

Deno.serve((req: Request) => handleRequest(req, { env: Deno.env.toObject() }));
