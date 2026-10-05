#!/usr/bin/env bash
# Smoke test for the deployed Edge Functions. Run from the project folder:  bash scripts/smoke-test.sh
# It never prints your password or tokens. Your password is read without echo and only sent to Supabase.
set -u

REF="ruibdsvrcctxgxctaxwe"
BASE="https://$REF.supabase.co"
ANON=$(grep -o 'eyJ[A-Za-z0-9._-]*' src/lib/supabase.js | head -1)
[ -n "$ANON" ] || { echo "Could not find the public key in src/lib/supabase.js. Run this from the careeraihub folder."; exit 1; }

pass=0; fail=0
ok()  { echo "  PASS  $1"; pass=$((pass+1)); }
bad() { echo "  FAIL  $1"; fail=$((fail+1)); }
call() { # call <function> <authToken> <json>  -> sets CODE and BODY
  local out; out=$(curl -s -m 120 -w $'\n%{http_code}' -X POST "$BASE/functions/v1/$1" \
    -H "apikey: $ANON" -H "Authorization: Bearer $2" -H "Content-Type: application/json" -d "$3")
  CODE=${out##*$'\n'}; BODY=${out%$'\n'*}
}
field() { python3 -c 'import sys,json
try:
    d=json.load(sys.stdin)
    print(d.get(sys.argv[1], d.get("error",{}).get("message","")) if sys.argv[1]!="message" else d.get("error",{}).get("message",""))
except Exception: print("")' "$1"; }

AIBODY='{"messages":[{"role":"user","content":"Reply with exactly the word: OK"}],"maxTokens":50}'

echo "1) ai function rejects a visitor who is not signed in (using the public key)"
call ai "$ANON" "$AIBODY"
[ "$CODE" = "401" ] && ok "HTTP 401 - $(echo "$BODY" | field message)" || bad "expected 401, got HTTP $CODE  $BODY"

echo "2) ai function rejects a request with no usable token at all"
out=$(curl -s -m 60 -o /dev/null -w '%{http_code}' -X POST "$BASE/functions/v1/ai" -H "Content-Type: application/json" -d "$AIBODY")
[ "$out" = "401" ] && ok "HTTP 401" || bad "expected 401, got HTTP $out"

echo "3) jobs function (works for guests; needs Adzuna keys to return live jobs)"
call jobs "$ANON" '{"what":"Product Manager","where":"Singapore"}'
case "$CODE" in
  200) ok "HTTP 200 - live jobs are working" ;;
  500) echo "  INFO  HTTP 500 \"$(echo "$BODY" | field message)\" - expected until Adzuna keys are set; the website falls back to board links" ;;
  404) bad "jobs function is not deployed yet (HTTP 404)" ;;
  *)   bad "unexpected HTTP $CODE  $BODY" ;;
esac

echo "3b) verify-cert rejects a visitor who is not signed in (using the public key)"
call verify-cert "$ANON" '{"url":"https://www.coursera.org/verify/ABC123"}'
[ "$CODE" = "401" ] && ok "HTTP 401 - $(echo "$BODY" | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("error",""))
except Exception: print("")')" || bad "expected 401, got HTTP $CODE  $BODY"

echo "4) Real AI call as a signed-in user"
read -r -p "   Your CareerAiHub email (press Enter to skip this step): " EMAIL
if [ -n "$EMAIL" ]; then
  read -r -s -p "   Your password (hidden): " PASS; echo
  LOGIN=$(EMAIL="$EMAIL" PASS="$PASS" python3 -c 'import os,json;print(json.dumps({"email":os.environ["EMAIL"],"password":os.environ["PASS"]}))' \
    | curl -s -m 60 -X POST "$BASE/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" -d @-)
  unset PASS
  TOKEN=$(echo "$LOGIN" | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("access_token",""))
except Exception: print("")')
  if [ -z "$TOKEN" ]; then
    WHY=$(echo "$LOGIN" | python3 -c 'import sys,json
try:
    d=json.load(sys.stdin); print(d.get("error_description") or d.get("msg") or d.get("message") or d.get("error") or "no reason given")
except Exception: print("could not read the sign-in response")')
    bad "sign-in failed - Supabase says: $WHY"
  else
    # Google sometimes answers "high demand" (502/503) or "slow down" (429); that is temporary, so retry a few times.
    for attempt in 1 2 3 4 5; do
      call ai "$TOKEN" "$AIBODY"
      case "$CODE" in 429|502|503) [ "$attempt" -lt 5 ] && { echo "   The AI provider is busy (HTTP $CODE), trying again in 10 seconds ($attempt/5)..."; sleep 10; continue; } ;; esac
      break
    done
    if [ "$CODE" = "200" ]; then ok "HTTP 200 - the model answered: $(echo "$BODY" | field text)"
    else
      bad "HTTP $CODE - $(echo "$BODY" | field message)"
      DIAG=$(echo "$BODY" | python3 -c 'import sys,json
try:
    d=json.load(sys.stdin).get("error",{}).get("diag")
    print(json.dumps(d) if d else "")
except Exception: print("")')
      [ -n "$DIAG" ] && echo "        what the server sees (no secret values): $DIAG"
    fi

    echo "5) verify-cert as a signed-in user"
    call verify-cert "$TOKEN" '{"url":"https://evil.com/coursera.org/verify/x"}'
    [ "$CODE" = "400" ] && ok "HTTP 400 - a look-alike link is refused ($(echo "$BODY" | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("error",""))
except Exception: print("")'))" || bad "expected 400 for a look-alike link, got HTTP $CODE  $BODY"
    call verify-cert "$TOKEN" '{"url":"http://www.coursera.org/verify/ABC123"}'
    [ "$CODE" = "400" ] && ok "HTTP 400 - a plain http link is refused" || bad "expected 400 for http, got HTTP $CODE  $BODY"

    read -r -p "   Optional: paste a public certificate link (Coursera, Udemy, edX, Accredible, freeCodeCamp) or press Enter to skip: " CERT
    if [ -n "$CERT" ]; then
      PAYLOAD=$(CERT="$CERT" python3 -c 'import os,json;print(json.dumps({"url":os.environ["CERT"]}))')
      call verify-cert "$TOKEN" "$PAYLOAD"
      echo "$BODY" | CODE="$CODE" python3 -c 'import sys,json,os
code=os.environ["CODE"]
try:
    d=json.load(sys.stdin)
except Exception:
    print("  INFO  HTTP "+code+" (unreadable reply)"); sys.exit()
if code=="200":
    print("  INFO  HTTP 200 - verified=%s platform=%s name=%s issuer=%s" % (d.get("verified"), d.get("platform"), d.get("name"), d.get("issuer")))
else:
    print("  INFO  HTTP "+code+" - "+str(d.get("error","")))'
    fi
  fi
else
  echo "  SKIP  (no email entered)"
fi

echo
echo "Result: $pass passed, $fail failed"
[ "$fail" = "0" ]
