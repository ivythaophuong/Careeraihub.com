// Supabase Edge Function: POST /functions/v1/verify-cert
// Checks a certificate link against the issuing platform. See handler.js for the safety rules.
import { handleRequest } from './handler.js';

Deno.serve((req: Request) => handleRequest(req, { env: Deno.env.toObject() }));
