import { createClient } from '@supabase/supabase-js';

// Both values are public client identifiers (they ship in the JS bundle).
// Access is enforced by row-level security and the edge functions.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://REPLACE_ME.supabase.co';
const PUBLISHABLE_KEY     = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'REPLACE_ME';

export const supabase = createClient(SUPABASE_URL, PUBLISHABLE_KEY);

// CHWs log in with a username; Supabase Auth needs an email, so we derive
// one. No mail is ever sent to it. Must match EMAIL_DOMAIN in admin-users.
const EMAIL_DOMAIN = 'chw-assistant.local';
export const usernameToEmail = (username) => `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;

// Call an edge function as the signed-in user. Throws Error(message) on failure.
export async function callFunction(name, body, { signal } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: PUBLISHABLE_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
  return payload;
}
