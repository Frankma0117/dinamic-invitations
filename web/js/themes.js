// Theme presets, Google Fonts catalog, paper textures. applyTheme() turns a config into CSS variables.

// Google Fonts with the axes each one really has (asking for a weight a font lacks makes Google reject the request).
export const FONTS = {
  // Serif
  'Cormorant Garamond': { kind: 'serif', axes: 'ital,wght@0,300;0,400;0,600;1,300;1,400' },
  'EB Garamond': { kind: 'serif', axes: 'ital,wght@0,400;0,600;1,400' },
  'Playfair Display': { kind: 'serif', axes: 'ital,wght@0,400;0,600;0,700;1,400' },
  'Lora': { kind: 'serif', axes: 'ital,wght@0,400;0,600;1,400' },
  'Cinzel': { kind: 'serif', axes: 'wght@400;600;700' },
  'Italiana': { kind: 'serif', axes: '' },
  'Bodoni Moda': { kind: 'serif', axes: 'ital,wght@0,400;0,600;1,400' },
  'DM Serif Display': { kind: 'serif', axes: 'ital@0;1' },
  'Libre Baskerville': { kind: 'serif', axes: 'ital,wght@0,400;0,700;1,400' },
  'Cormorant': { kind: 'serif', axes: 'ital,wght@0,400;0,600;1,400' },
  'Prata': { kind: 'serif', axes: '' },
  'Marcellus': { kind: 'serif', axes: '' },
  'Gilda Display': { kind: 'serif', axes: '' },
  'Forum': { kind: 'serif', axes: '' },
  'Cinzel Decorative': { kind: 'serif', axes: 'wght@400;700' },
  'Abril Fatface': { kind: 'serif', axes: '' },
  'Yeseva One': { kind: 'serif', axes: '' },
  'Old Standard TT': { kind: 'serif', axes: 'ital,wght@0,400;0,700;1,400' },
  // Sans
  'Montserrat': { kind: 'sans', axes: 'ital,wght@0,300;0,400;0,600;1,400' },
  'Raleway': { kind: 'sans', axes: 'wght@300;400;600' },
  'Josefin Sans': { kind: 'sans', axes: 'wght@300;400;600' },
  'Inter': { kind: 'sans', axes: 'wght@300;400;600' },
  'Poppins': { kind: 'sans', axes: 'wght@300;400;600' },
  'Lato': { kind: 'sans', axes: 'wght@300;400;700' },
  'Nunito': { kind: 'sans', axes: 'wght@400;600;800' },
  'Quicksand': { kind: 'sans', axes: 'wght@400;600' },
  'Fredoka': { kind: 'sans', axes: 'wght@400;600' },
  'Baloo 2': { kind: 'sans', axes: 'wght@400;600;800' },
  'Jost': { kind: 'sans', axes: 'wght@300;400;600' },
  'Tenor Sans': { kind: 'sans', axes: '' },
  'Outfit': { kind: 'sans', axes: 'wght@300;400;600' },
  'Work Sans': { kind: 'sans', axes: 'wght@300;400;600' },
  'Manrope': { kind: 'sans', axes: 'wght@300;400;600' },
  'DM Sans': { kind: 'sans', axes: 'wght@400;600' },
  'Lexend': { kind: 'sans', axes: 'wght@300;400;600' },
  'Comfortaa': { kind: 'sans', axes: 'wght@400;600' },
  // Handwriting / script
  'Great Vibes': { kind: 'script', axes: '' },
  'Parisienne': { kind: 'script', axes: '' },
  'Dancing Script': { kind: 'script', axes: 'wght@400;600' },
  'Sacramento': { kind: 'script', axes: '' },
  'Allura': { kind: 'script', axes: '' },
  'Alex Brush': { kind: 'script', axes: '' },
  'Pinyon Script': { kind: 'script', axes: '' },
  'Caveat': { kind: 'script', axes: 'wght@400;600' },
  'Pacifico': { kind: 'script', axes: '' },
  'Homemade Apple': { kind: 'script', axes: '' },
  'Mrs Saint Delafield': { kind: 'script', axes: '' },
  'Tangerine': { kind: 'script', axes: 'wght@400;700' },
  'Italianno': { kind: 'script', axes: '' },
  'Monsieur La Doulaise': { kind: 'script', axes: '' },
  'Rouge Script': { kind: 'script', axes: '' },
  'Herr Von Muellerhoff': { kind: 'script', axes: '' },
  'Petit Formal Script': { kind: 'script', axes: '' },
  'Imperial Script': { kind: 'script', axes: '' },
  'WindSong': { kind: 'script', axes: '' },
  'Ephesis': { kind: 'script', axes: '' },
  'Birthstone': { kind: 'script', axes: '' },
  'Satisfy': { kind: 'script', axes: '' },
  'Kaushan Script': { kind: 'script', axes: '' },
  'Cookie': { kind: 'script', axes: '' },
  'La Belle Aurore': { kind: 'script', axes: '' },
  'Reenie Beanie': { kind: 'script', axes: '' },
};

const FALLBACK = { serif: 'Georgia, "Times New Roman", serif', sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', script: 'cursive' };
export const fontStack = name => `"${name}", ${FALLBACK[FONTS[name]?.kind || 'serif']}`;

const loaded = new Set();
export function loadFonts(names) {
  const todo = [...new Set(names)].filter(n => FONTS[n] && !loaded.has(n));
  if (!todo.length) return;
  todo.forEach(n => loaded.add(n));
  const fams = todo.map(n => `family=${n.replace(/ /g, '+')}${FONTS[n].axes ? ':' + FONTS[n].axes : ''}`).join('&');
  document.head.append(Object.assign(document.createElement('link'), {
    rel: 'stylesheet', href: `https://fonts.googleapis.com/css2?${fams}&display=swap`,
  }));
}

export const THEMES = {
  crema: {
    label: 'Elegante crema', bg: '#efe6d6', paper: '#f9f3e7', ink: '#4a3a2a', muted: '#86705a',
    primary: '#b08d57', secondary: '#d9c3a3', envelope: '#e9dcc4', envelopeInner: '#d6c3a2', seal: '#9b2f3b', sealInk: '#f2d8a4',
    curtain: '#7a2430', fontTitle: 'Cormorant Garamond', fontBody: 'EB Garamond', fontScript: 'Great Vibes',
    texture: 'paper', decor: 'heart', particles: 'none', dark: false,
  },
  grado: {
    label: 'Grado', bg: '#0b1734', paper: '#10224a', ink: '#f4ead5', muted: '#b9c3dc',
    primary: '#d6b25e', secondary: '#7f9bd3', envelope: '#24407f', envelopeInner: '#172d61', seal: '#c79a3a', sealInk: '#fff4d6',
    curtain: '#14275a', fontTitle: 'Cinzel', fontBody: 'Montserrat', fontScript: 'Great Vibes',
    texture: 'paper', decor: 'cap', particles: 'sparkles', dark: true,
  },
  romantico: {
    label: 'Romántico', bg: '#f6e4e2', paper: '#fdf5f3', ink: '#6a3d45', muted: '#9c727a',
    primary: '#c27a86', secondary: '#9fb39a', envelope: '#f0d2d0', envelopeInner: '#e5bcbc', seal: '#b4606f', sealInk: '#fde9ea',
    curtain: '#b4606f', fontTitle: 'Playfair Display', fontBody: 'Lora', fontScript: 'Parisienne',
    texture: 'watercolor', decor: 'flowers', particles: 'petals', dark: false,
  },
  moderno: {
    label: 'Moderno minimalista', bg: '#f2f2f0', paper: '#ffffff', ink: '#141414', muted: '#666666',
    primary: '#141414', secondary: '#b5b5b5', envelope: '#ffffff', envelopeInner: '#e9e9e9', seal: '#141414', sealInk: '#ffffff',
    curtain: '#141414', fontTitle: 'Josefin Sans', fontBody: 'Inter', fontScript: 'Caveat',
    texture: 'none', decor: 'line', particles: 'none', dark: false,
  },
  infantil: {
    label: 'Infantil', bg: '#fff4dc', paper: '#fffaf0', ink: '#3b3770', muted: '#6d6a9c',
    primary: '#ff7f9f', secondary: '#5cc4e6', envelope: '#ffd36e', envelopeInner: '#ffbe3d', seal: '#ff7f9f', sealInk: '#ffffff',
    curtain: '#5cc4e6', fontTitle: 'Fredoka', fontBody: 'Nunito', fontScript: 'Pacifico',
    texture: 'dots', decor: 'shapes', particles: 'confetti', dark: false,
  },
  gala: {
    label: 'Noche de gala', bg: '#0a0a0a', paper: '#141312', ink: '#f3e7c6', muted: '#bfb294',
    primary: '#d4af37', secondary: '#8c6e2a', envelope: '#1c1b19', envelopeInner: '#111', seal: '#b8902f', sealInk: '#1a1405',
    curtain: '#3a0d12', fontTitle: 'Playfair Display', fontBody: 'Raleway', fontScript: 'Pinyon Script',
    texture: 'linen', decor: 'deco', particles: 'sparkles', dark: true,
  },
  botanico: {
    label: 'Botánico', bg: '#ece6d8', paper: '#f5f0e4', ink: '#2e3a30', muted: '#6e7466',
    primary: '#2f4a39', secondary: '#9fae93', envelope: '#2f4a39', envelopeInner: '#233a2c', envelopeInk: '#efe3c4',
    seal: '#b8955a', sealInk: '#6e5325', curtain: '#2f4a39', fontTitle: 'Bodoni Moda', fontBody: 'Montserrat', fontScript: 'Homemade Apple',
    texture: 'paper', decor: 'botanical', particles: 'none', dark: false,
  },
};

export const TEXTURES = {
  none: 'Ninguna', paper: 'Papel', linen: 'Lino', dots: 'Puntos', watercolor: 'Acuarela',
};

export const PARTICLES = {
  none: 'Ninguno', sparkles: 'Destellos', confetti: 'Confeti', petals: 'Pétalos cayendo', stars: 'Estrellas',
};

const svgUrl = s => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

function textureImage(kind, t) {
  if (kind === 'paper') {
    return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='${t.dark ? '.10' : '.13'}'/></svg>`);
  }
  if (kind === 'linen') {
    return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><path d='M0 .5H8M.5 0V8' stroke='${t.dark ? '#fff' : '#000'}' stroke-opacity='.05'/></svg>`);
  }
  if (kind === 'dots') {
    return `radial-gradient(color-mix(in srgb, ${t.secondary} 35%, transparent) 1.6px, transparent 1.8px)`;
  }
  if (kind === 'watercolor') {
    return [
      `radial-gradient(40% 30% at 8% 6%, color-mix(in srgb, ${t.primary} 22%, transparent), transparent 70%)`,
      `radial-gradient(35% 28% at 95% 18%, color-mix(in srgb, ${t.secondary} 25%, transparent), transparent 70%)`,
      `radial-gradient(45% 30% at 90% 96%, color-mix(in srgb, ${t.primary} 18%, transparent), transparent 70%)`,
      `radial-gradient(35% 25% at 5% 85%, color-mix(in srgb, ${t.secondary} 22%, transparent), transparent 70%)`,
    ].join(',');
  }
  return 'none';
}

/** Everything the editor can change on top of a preset (empty = the preset's value). */
export const THEME_KEYS = ['primary', 'secondary', 'bg', 'paper', 'ink', 'envelope', 'envelopeInner', 'envelopeInk', 'seal', 'sealInk', 'curtain',
  'fontTitle', 'fontBody', 'fontScript', 'fontName', 'texture', 'particles'];

/** Preset + the user's overrides (empty values keep the preset's). */
export function resolveTheme(themeCfg = {}) {
  const base = THEMES[themeCfg.preset] || THEMES.crema;
  const t = { ...base, fontName: base.fontName || base.fontScript, envelopeInk: base.envelopeInk || (base.dark ? base.primary : base.ink) };
  for (const k of THEME_KEYS) if (themeCfg[k]) t[k] = themeCfg[k];
  if (themeCfg.ink && !themeCfg.muted) t.muted = `color-mix(in srgb, ${t.ink} 68%, ${t.paper})`;
  return t;
}

export function applyTheme(themeCfg, root = document.documentElement) {
  const t = resolveTheme(themeCfg);
  const vars = {
    '--bg': t.bg, '--paper': t.paper, '--ink': t.ink, '--muted': t.muted,
    '--primary': t.primary, '--secondary': t.secondary,
    '--envelope': t.envelope, '--envelope-inner': t.envelopeInner,
    '--seal': t.seal, '--seal-ink': t.sealInk, '--curtain': t.curtain,
    '--envelope-ink': t.envelopeInk,
    '--font-name': fontStack(t.fontName),
    '--font-title': fontStack(t.fontTitle), '--font-body': fontStack(t.fontBody), '--font-script': fontStack(t.fontScript),
    '--texture': textureImage(t.texture, t),
    '--texture-size': t.texture === 'dots' ? '22px 22px' : t.texture === 'watercolor' ? '100% 100%' : 'auto',
  };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.dataset.dark = t.dark ? '1' : '0';
  root.dataset.decor = t.decor;
  loadFonts([t.fontTitle, t.fontBody, t.fontScript, t.fontName]);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = t.bg;
  return t;
}
