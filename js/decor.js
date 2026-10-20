// Static SVG artwork (trusted strings, never user data). Colors come from the theme's CSS variables.

const P = 'style="fill:none;stroke:var(--primary);stroke-linecap:round;stroke-linejoin:round"';

export const SEAL_ICONS = {
  heart: { label: 'Corazón', svg: '<path d="M50 78C24 60 14 46 18 33c4-13 20-17 32-4 12-13 28-9 32 4 4 13-6 27-32 45z"/>' },
  cap: { label: 'Birrete', svg: '<path d="M10 40 50 24l40 16-40 16z"/><path d="M28 48v16c0 7 44 7 44 0V48L50 56z"/><path d="M84 42v20" style="stroke:currentColor;stroke-width:3;fill:none"/><circle cx="84" cy="66" r="4"/>' },
  rings: { label: 'Anillos', svg: '<circle cx="40" cy="56" r="20" style="fill:none;stroke:currentColor;stroke-width:6"/><circle cx="62" cy="56" r="20" style="fill:none;stroke:currentColor;stroke-width:6"/><path d="M56 24l6-8 6 8-6 8z"/>' },
  star: { label: 'Estrella', svg: '<path d="M50 12l11 24 26 3-19 18 5 26-23-13-23 13 5-26-19-18 26-3z"/>' },
  flower: { label: 'Flor', svg: '<g transform="translate(50 50)"><circle r="12" cy="-20"/><circle r="12" cy="20"/><circle r="12" cx="-20"/><circle r="12" cx="20"/><circle r="12" cx="-14" cy="-14"/><circle r="12" cx="14" cy="14"/><circle r="12" cx="14" cy="-14"/><circle r="12" cx="-14" cy="14"/><circle r="10" style="fill:var(--seal)"/></g>' },
  crown: { label: 'Corona', svg: '<path d="M16 72l-4-42 22 18 16-28 16 28 22-18-4 42z"/><rect x="16" y="76" width="68" height="8" rx="3"/>' },
  balloon: { label: 'Globo', svg: '<ellipse cx="50" cy="40" rx="22" ry="26"/><path d="M46 66h8l-4 6z"/><path d="M50 72c-6 8 6 12 0 22" style="fill:none;stroke:currentColor;stroke-width:3"/>' },
  dove: { label: 'Paloma', svg: '<path d="M18 58c10-2 20-10 26-22 2 10 0 18-6 24 14-2 26-10 34-22 2 14-6 28-22 34-8 3-18 3-24 0l-10 8 2-12c-2-2-1-8 0-10z"/><circle cx="72" cy="40" r="2" style="fill:var(--seal)"/>' },
};

export function sealIcon(name) {
  const ic = SEAL_ICONS[name] || SEAL_ICONS.heart;
  return `<svg viewBox="0 0 100 100" aria-hidden="true" style="fill:currentColor">${ic.svg}</svg>`;
}

// Ornament above the title + divider between sections, per decor style.
const ORNAMENTS = {
  heart: `<svg viewBox="0 0 160 70" aria-hidden="true" ${P}>
    <path d="M80 26c-4-12-20-15-25-4-6 12 10 26 25 36 15-10 31-24 25-36-5-11-21-8-25 4z" style="stroke-width:1.6;fill:none;stroke:var(--primary)"/>
    <path d="M79 28c-5-10-18-12-22-3-5 10 9 22 23 31" style="stroke-width:.9;opacity:.6;fill:none;stroke:var(--primary)"/>
    <path d="M6 44c20-2 34 4 44-4M154 44c-20-2-34 4-44-4" style="stroke-width:1.1;fill:none;stroke:var(--primary)"/></svg>`,
  cap: `<svg viewBox="0 0 160 70" aria-hidden="true">
    <g style="fill:var(--primary)"><path d="M80 10l40 15-40 15-40-15z"/><path d="M58 32v12c0 8 44 8 44 0V32l-22 8z"/></g>
    <path d="M114 27v18" style="stroke:var(--primary);stroke-width:2"/><circle cx="114" cy="48" r="3" style="fill:var(--primary)"/>
    <g style="fill:var(--primary);opacity:.8"><path d="M20 30l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><path d="M140 18l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6z"/><path d="M146 50l1.2 3.3 3.3 1.2-3.3 1.2-1.2 3.3-1.2-3.3-3.3-1.2 3.3-1.2z"/></g></svg>`,
  flowers: `<svg viewBox="0 0 200 80" aria-hidden="true"><defs><filter id="wc" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>
    <g filter="url(#wc)">
      <ellipse cx="62" cy="52" rx="16" ry="6" transform="rotate(-25 62 52)" style="fill:var(--secondary);opacity:.7"/>
      <ellipse cx="138" cy="52" rx="16" ry="6" transform="rotate(25 138 52)" style="fill:var(--secondary);opacity:.7"/>
      <ellipse cx="44" cy="40" rx="12" ry="5" transform="rotate(20 44 40)" style="fill:var(--secondary);opacity:.55"/>
      <ellipse cx="156" cy="40" rx="12" ry="5" transform="rotate(-20 156 40)" style="fill:var(--secondary);opacity:.55"/>
      <circle cx="100" cy="40" r="20" style="fill:var(--primary);opacity:.55"/><circle cx="88" cy="46" r="12" style="fill:var(--primary);opacity:.5"/>
      <circle cx="112" cy="46" r="12" style="fill:var(--primary);opacity:.45"/><circle cx="76" cy="38" r="9" style="fill:var(--primary);opacity:.35"/>
      <circle cx="124" cy="38" r="9" style="fill:var(--primary);opacity:.35"/>
    </g><circle cx="100" cy="40" r="4" style="fill:var(--paper);opacity:.8"/></svg>`,
  line: `<svg viewBox="0 0 160 30" aria-hidden="true"><path d="M30 15h100" style="stroke:var(--primary);stroke-width:1"/><circle cx="80" cy="15" r="3" style="fill:var(--primary)"/></svg>`,
  shapes: `<svg viewBox="0 0 200 80" aria-hidden="true">
    <ellipse cx="60" cy="32" rx="14" ry="17" style="fill:var(--primary)"/><path d="M60 49c-4 8 4 12 0 22" style="stroke:var(--muted);fill:none;stroke-width:1.5"/>
    <ellipse cx="100" cy="26" rx="15" ry="18" style="fill:var(--secondary)"/><path d="M100 44c-4 8 4 12 0 26" style="stroke:var(--muted);fill:none;stroke-width:1.5"/>
    <ellipse cx="140" cy="34" rx="13" ry="16" style="fill:#ffd166"/><path d="M140 50c-4 8 4 12 0 20" style="stroke:var(--muted);fill:none;stroke-width:1.5"/>
    <path d="M24 40l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" style="fill:#ffd166"/><circle cx="176" cy="22" r="5" style="fill:var(--primary)"/><circle cx="182" cy="52" r="3.5" style="fill:var(--secondary)"/></svg>`,
  deco: `<svg viewBox="0 0 200 60" aria-hidden="true" style="fill:none;stroke:var(--primary);stroke-width:1.2">
    <path d="M100 8l14 22-14 22-14-22z"/><path d="M100 18l7 12-7 12-7-12z" style="fill:var(--primary)"/>
    <path d="M10 30h66M124 30h66M30 24h40M130 24h40M30 36h40M130 36h40"/></svg>`,
};

export const ornament = decor => ORNAMENTS[decor] || ORNAMENTS.line;

export function divider(decor) {
  if (decor === 'heart') return `<svg viewBox="0 0 160 20" aria-hidden="true"><path d="M20 10c30-6 40 6 60 0s30-6 60 0" style="fill:none;stroke:var(--primary);stroke-width:1;stroke-linecap:round"/></svg>`;
  if (decor === 'cap' || decor === 'deco') return `<svg viewBox="0 0 160 20" aria-hidden="true"><path d="M20 10h50M90 10h50" style="stroke:var(--primary);stroke-width:1"/><path d="M80 4l6 6-6 6-6-6z" style="fill:var(--primary)"/></svg>`;
  if (decor === 'flowers') return `<svg viewBox="0 0 160 20" aria-hidden="true"><path d="M30 10h100" style="stroke:var(--secondary);stroke-width:1"/><circle cx="80" cy="10" r="5" style="fill:var(--primary);opacity:.6"/><circle cx="70" cy="10" r="2.5" style="fill:var(--secondary)"/><circle cx="90" cy="10" r="2.5" style="fill:var(--secondary)"/></svg>`;
  if (decor === 'shapes') return `<svg viewBox="0 0 160 20" aria-hidden="true"><circle cx="62" cy="10" r="4" style="fill:var(--primary)"/><circle cx="80" cy="10" r="4" style="fill:var(--secondary)"/><circle cx="98" cy="10" r="4" style="fill:#ffd166"/></svg>`;
  return `<svg viewBox="0 0 160 20" aria-hidden="true"><path d="M50 10h60" style="stroke:var(--primary);stroke-width:1"/></svg>`;
}

// Small line icons for date / time / place / etc.
export const ICONS = {
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
  dress: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3l3 3 3-3M9 3 7 8l3 2-5 11h14l-5-11 3-2-2-5"/></svg>',
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 21 3l-8 18-2-8z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17l9-10"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M12 12.5v5M9.5 15h5"/></svg>',
  music: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" style="fill:currentColor"/></svg>',
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor;stroke:none"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.7 11.7 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.3z"/></svg>',
  arrowL: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>',
  arrowR: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
};
