// Supabase Edge Function: POST /functions/v1/jobs
// Proxies Adzuna job search so the Adzuna keys stay on the server. See ../ai/README.md for deploy steps.
import { handleRequest } from './handler.js';

Deno.serve((req: Request) => handleRequest(req, { env: Deno.env.toObject() }));
