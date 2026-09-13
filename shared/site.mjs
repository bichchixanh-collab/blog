// shared/site.mjs — 1 nơi duy nhất resolve domain. Không hardcode J2ME.VERCEL.APP.
// Client: location.origin. Server: x-forwarded-* + SITE_URL env (ưu tiên env để ổn định canonical).
export function siteUrlFromHeaders(headers = {}, env = {}) {
  if (env.SITE_URL) return String(env.SITE_URL).replace(/\/$/, '');
  const proto = headers['x-forwarded-proto'] || 'https';
  const host = headers['x-forwarded-host'] || headers.host || 'localhost';
  return `${proto}://${host}`.replace(/\/$/, '');
}
export function siteUrlClient() {
  try { return location.origin.replace(/\/$/, ''); } catch { return ''; }
}
export const isValidSlug = (s) => /^[a-z0-9][a-z0-9\-]{0,119}$/i.test(String(s || ''));
