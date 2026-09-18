// Application Configuration & Limits
export const APP_CONFIG = {
  SITE_PASSCODE: import.meta.env.VITE_SITE_PASSCODE || '7940',
  MAX_FILE_SIZE_MB: Number(import.meta.env.VITE_MAX_FILE_SIZE_MB) || 100,
  MAX_DURATION_SEC: Number(import.meta.env.VITE_MAX_DURATION_SEC) || 300, // 5 minutes
  APP_TITLE: import.meta.env.VITE_APP_TITLE || 'ZEN CAPTION AI STUDIO'
};

// Available Fonts (Local system & web-safe creative fonts)
export const FONTS = [
  { id: 'Inter', name: 'Inter (Modern Sans)', family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" },
  { id: 'Montserrat', name: 'Montserrat (Bold Clean)', family: "'Montserrat', sans-serif" },
  { id: 'Roboto', name: 'Roboto (Universal)', family: "'Roboto', sans-serif" },
  { id: 'Impact', name: 'Impact (Viral Meme / TikTok)', family: "Impact, 'Arial Black', sans-serif" },
  { id: 'BebasNeue', name: 'Bebas Neue (Cinematic Tall)', family: "'Bebas Neue', Impact, sans-serif" },
  { id: 'Oswald', name: 'Oswald (Punchy Bold)', family: "'Oswald', sans-serif" },
  { id: 'Outfit', name: 'Outfit (Futuristic Tech)', family: "'Outfit', sans-serif" },
  { id: 'Bangers', name: 'Bangers (Comic / Dynamic)', family: "'Bangers', cursive, Impact" },
  { id: 'CourierNew', name: 'Courier New (Terminal Typewriter)', family: "'Courier New', monospace" },
  { id: 'Arial', name: 'Arial (Common Clean)', family: "Arial, Helvetica, sans-serif" }
];

// 9 Caption Positions on the video (Complete 3x3 Matrix)
export const CAPTION_POSITIONS = [
  { id: 'top', label: 'Top', x: '50%', y: '5%', align: 'center', transform: 'translate(-50%, 0)' },
  { id: 'bottom', label: 'Bottom', x: '50%', y: '93%', align: 'center', transform: 'translate(-50%, -100%)' },
  { id: 'middle', label: 'Middle', x: '50%', y: '50%', align: 'center', transform: 'translate(-50%, -50%)' },
  { id: 'middle-left', label: 'Middle Left', x: '5%', y: '50%', align: 'left', transform: 'translate(0, -50%)' },
  { id: 'middle-right', label: 'Middle Right', x: '95%', y: '50%', align: 'right', transform: 'translate(-100%, -50%)' },
  { id: 'top-left', label: 'Top Left', x: '5%', y: '5%', align: 'left', transform: 'translate(0, 0)' },
  { id: 'top-right', label: 'Top Right', x: '95%', y: '5%', align: 'right', transform: 'translate(-100%, 0)' },
  { id: 'bottom-left', label: 'Bottom Left', x: '5%', y: '93%', align: 'left', transform: 'translate(0, -100%)' },
  { id: 'bottom-right', label: 'Bottom Right', x: '95%', y: '93%', align: 'right', transform: 'translate(-100%, -100%)' }
];

// 15+ Caption Animation Styles
export const CAPTION_ANIMATIONS = [
  { id: 'anim-left-right', name: 'Left to Right', description: 'Smooth slide-in from left', cssClass: 'anim-slide-left-right' },
  { id: 'anim-right-left', name: 'Right to Left', description: 'Smooth slide-in from right', cssClass: 'anim-slide-right-left' },
  { id: 'anim-top-bottom', name: 'Top to Bottom', description: 'Descend smoothly into frame', cssClass: 'anim-slide-top-bottom' },
  { id: 'anim-bottom-top', name: 'Bottom to Top', description: 'Ascend punchy from bottom', cssClass: 'anim-slide-bottom-top' },
  { id: 'anim-blink', name: 'Blink / Flash', description: 'Attention-grabbing double flash', cssClass: 'anim-blink' },
  { id: 'anim-typewriter', name: 'Typewriter', description: 'Word by word typewriter reveal', cssClass: 'anim-typewriter' },
  { id: 'anim-pop', name: 'Pop / Scale Bounce', description: 'Viral TikTok / Reels bouncy pop', cssClass: 'anim-pop' },
  { id: 'anim-karaoke-glow', name: 'Karaoke Glow', description: 'Active word neon highlighter', cssClass: 'anim-karaoke-glow' },
  { id: 'anim-wave', name: 'Wave / Bob', description: 'Gentle harmonic text wave', cssClass: 'anim-wave' },
  { id: 'anim-fade', name: 'Smooth Fade', description: 'Cinematic subtle dissolve', cssClass: 'anim-fade' },
  { id: 'anim-blur', name: 'Blur Unveil', description: 'Optic defocus into sharp focus', cssClass: 'anim-blur' },
  { id: 'anim-neon-pulse', name: 'Neon Pulse', description: 'Cyberpunk oscillating light emission', cssClass: 'anim-neon-pulse' },
  { id: 'anim-glitch', name: 'Glitch Cyber', description: 'Digital chromatic glitch twitch', cssClass: 'anim-glitch' },
  { id: 'anim-flip3d', name: '3D Flip In', description: 'Tumbling 3D perspective rotation', cssClass: 'anim-flip3d' },
  { id: 'anim-zoom-impact', name: 'Zoom Impact', description: 'Sudden explosive scale punch', cssClass: 'anim-zoom-impact' }
];

// Default configuration for Landscape (16:9)
export const DEFAULT_LANDSCAPE_CONFIG = {
  fontFamily: 'Inter',
  fontSize: 30, // 1 - 100 scale
  position: 'bottom', // default 9-positions matrix within screen bounds
  textColor: '#FFE600', // User preset default: Vivid Yellow
  outlineColor: '#000000', // Default black outline
  outlineWidth: 1, // User preset default: 1px outline
  shadowColor: 'rgba(0,0,0,0.85)',
  shadowBlur: 8,
  animation: 'anim-blur', // User preset default: Blur Unveil
  uppercase: true,
  karaokeHighlightColor: '#00F0FF',
  enableLastWordColor: true,
  lastWordColor: '#00F0FF', // Distinct accent color for the last word of line
  timeIntervalColors: [
    { start: 0, end: 15, color: '#FFE600', label: '00:00 - 00:15' },
    { start: 15, end: 35, color: '#FFFFFF', label: '00:15 - 00:35' },
    { start: 35, end: 300, color: '#00F0FF', label: '00:35 - 05:00' }
  ],
  maxWordsPerLine: 6,
  progressiveDisplay: true
};

// Default configuration for Portrait (9:16 Shorts/Reels)
export const DEFAULT_PORTRAIT_CONFIG = {
  fontFamily: 'Impact',
  fontSize: 32, // Adjusted for clean vertical screen balance
  position: 'bottom', // Bottom position
  textColor: '#FFE600', // User preset default: Vivid Yellow
  outlineColor: '#000000', // Default black outline
  outlineWidth: 1, // User preset default: 1px outline
  shadowColor: 'rgba(0,0,0,0.95)',
  shadowBlur: 10,
  animation: 'anim-blur', // User preset default: Blur Unveil
  uppercase: true,
  karaokeHighlightColor: '#FF0055',
  enableLastWordColor: true,
  lastWordColor: '#00F0FF', // Distinct accent color for the last word of line
  timeIntervalColors: [
    { start: 0, end: 10, color: '#FFE600', label: '00:00 - 00:10' },
    { start: 10, end: 30, color: '#FF3366', label: '00:10 - 00:30' },
    { start: 30, end: 300, color: '#00FF99', label: '00:30 - 05:00' }
  ],
  maxWordsPerLine: 4,
  progressiveDisplay: true
};
