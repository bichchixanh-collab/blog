// config.js — single source of truth, tránh hardcode rải rác như bản cũ.
export const SITE = {
  name: 'J2ME',
  domain: 'https://j2me.vercel.app',
  theme: '#0066cc',
};
export const CATS = [
  { id: 'Hành Động', icon: '⚔️' }, { id: 'Nhập Vai', icon: '🧙' },
  { id: 'Đua xe', icon: '🏎️' }, { id: 'Bắn súng', icon: '🔫' },
  { id: 'Trí tuệ', icon: '🧩' }, { id: 'Thể thao', icon: '⚽' },
  { id: 'Phiêu lưu', icon: '🗺️' }, { id: 'Nông trại', icon: '🌾' },
  { id: 'Việt Hóa', icon: '🇻🇳', filter: 'vi' },
];
export const RESOLUTIONS = ['all', '240x320', '128x160'];
export function apiRoot() {
  try {
    const p = location.pathname || '/';
    const gi = p.indexOf('/game/');
    if (gi >= 0) return p.slice(0, gi).replace(/\/$/, '');
    if (p.endsWith('/blog-v2') || p.includes('/blog-v2/')) {
      const i = p.indexOf('/blog-v2');
      return p.slice(0, i + '/blog-v2'.length);
    }
    const i = p.lastIndexOf('/');
    return i <= 0 ? '' : p.slice(0, i);
  } catch { return ''; }
}
