export const toolConfig = {
  id: 'totp-authenticator-widget',
  name: 'Totp Authenticator Widget',
  category: 'Utility',
  description:
    'Generate time-based one-time passwords (TOTP) locally in the browser from a secret key, with live countdown and copy-to-clipboard.',
  version: '1.0.0',
  exportFormats: ['json' as const],
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#2563eb',
    accentHover: '#1d4ed8',
    accentSubtle: 'rgba(37, 99, 235, 0.12)',
    brand: 'Totp Authenticator Widget',
    icon: '🔐',
  },
};

export default toolConfig;
