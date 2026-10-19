import React, { useEffect, useRef, useState } from 'react';
import { TURNSTILE_SITE_KEY, loadTurnstile } from '../lib/captcha';

// One Cloudflare Turnstile widget. onToken(token) when it is solved, onToken(null) when it fails or expires. A token can be used once, so the parent bumps
// `resetKey` after every attempt and the widget is reset (a fresh check). The widget is removed when the form changes or closes.
export default function CaptchaBox({ onToken, resetKey = 0 }) {
  const holder = useRef(null);
  const widget = useRef(null);
  const api = useRef(null);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadTurnstile().then((t) => {
      if (cancelled || !holder.current) return;
      api.current = t;
      widget.current = t.render(holder.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        callback: (token) => { setProblem(''); onToken(token); },
        'error-callback': () => { onToken(null); setProblem('The security check failed. Please try again.'); },
        'expired-callback': () => onToken(null),
      });
    }).catch(() => {
      if (cancelled) return;
      onToken(null);
      setProblem("We couldn't load the security check. Check your connection, or reload the page.");
    });
    return () => {
      cancelled = true;
      try { if (widget.current != null) api.current?.remove(widget.current); } catch { /* the page is going away anyway */ }
      widget.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resetKey && widget.current != null) { try { api.current.reset(widget.current); } catch { /* a widget that is gone needs no reset */ } }
  }, [resetKey]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div ref={holder} />
      {problem && <div role="alert" style={{ color: '#FF4757', fontSize: 12, textAlign: 'center' }}>⚠ {problem}</div>}
    </div>
  );
}
