/**
 * Minimalist, uniform SVG icon set for the POS UI.
 * All icons share the same stroke-based style for visual consistency.
 * Default size: 20px. Pass `size` and `color` props to customize.
 */

const defaults = { size: 20, color: 'currentColor', strokeWidth: 1.8 }

const I = ({ size = defaults.size, color = defaults.color, sw = defaults.strokeWidth, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {children}
  </svg>
)

// --- Navigation ---
export const IconGrid = (p) => <I {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></I>
export const IconClock = (p) => <I {...p}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></I>
export const IconChart = (p) => <I {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></I>
export const IconBox = (p) => <I {...p}><path d="M21 8L12 2 3 8v8l9 6 9-6V8z"/><polyline points="3 8 12 14 21 8"/><line x1="12" y1="14" x2="12" y2="22"/></I>
export const IconReceipt = (p) => <I {...p}><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2l-3 2-3-2-3 2-3-2-3 2z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/></I>
export const IconCalendar = (p) => <I {...p}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></I>

// --- Actions ---
export const IconSearch = (p) => <I {...p}><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></I>
export const IconX = (p) => <I {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></I>
export const IconCheck = (p) => <I {...p}><polyline points="20 6 9 17 4 12"/></I>
export const IconArrowLeft = (p) => <I {...p}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></I>
export const IconBackspace = (p) => <I {...p}><path d="M21 4H8l-7 8 7 8h13a1 1 0 001-1V5a1 1 0 00-1-1z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></I>
export const IconPlus = (p) => <I {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></I>
export const IconMinus = (p) => <I {...p}><line x1="5" y1="12" x2="19" y2="12"/></I>
export const IconLogout = (p) => <I {...p}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></I>
export const IconUsers = (p) => <I {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></I>
export const IconPrinter = (p) => <I {...p}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></I>

// --- Product placeholder icons (minimalist food outlines) ---
export const IconBurger = (p) => <I {...p}><path d="M3 11h18a1 1 0 010 2H3a1 1 0 010-2z"/><path d="M5 11c0-4 3.1-7 7-7s7 3 7 7"/><path d="M5 13c0 3 3.1 5 7 5s7-2 7-5"/><line x1="7" y1="14.5" x2="8" y2="14.5"/><line x1="11" y1="15" x2="13" y2="15"/><line x1="16" y1="14.5" x2="17" y2="14.5"/></I>
export const IconFries = (p) => <I {...p}><rect x="6" y="13" width="12" height="8" rx="2"/><line x1="9" y1="13" x2="8" y2="4"/><line x1="12" y1="13" x2="12" y2="3"/><line x1="15" y1="13" x2="16" y2="4"/></I>
export const IconDrink = (p) => <I {...p}><path d="M8 2h8l-1.5 18H9.5L8 2z"/><line x1="7" y1="6" x2="17" y2="6"/><line x1="12" y1="6" x2="12" y2="2"/></I>
export const IconCheese = (p) => <I {...p}><path d="M21 12l-9-9L3 12h18z"/><rect x="3" y="12" width="18" height="6" rx="1"/><circle cx="8" cy="15" r="1.5" fill="currentColor" opacity="0.3"/><circle cx="15" cy="15" r="1" fill="currentColor" opacity="0.3"/></I>
export const IconMeat = (p) => <I {...p}><ellipse cx="12" cy="12" rx="9" ry="6"/><path d="M7 9c1-2 3-3 5-3s4 1 5 3"/></I>
export const IconCombo = (p) => <I {...p}><circle cx="8" cy="8" r="5"/><circle cx="16" cy="16" r="5"/><line x1="11.5" y1="4.5" x2="19.5" y2="12.5"/></I>
export const IconActivity = (p) => <I {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></I>
export const IconClipboardList = (p) => <I {...p}><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><path d="M9 12l2 2 4-4"/><path d="M9 16h6"/></I>
export const IconLayoutDashboard = (p) => <I {...p}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></I>
export const IconTrendingUp = (p) => <I {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></I>
export const IconAlertCircle = (p) => <I {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></I>
export const IconUser = (p) => <I {...p}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></I>
export const IconRotateCcw = (p) => <I {...p}><path d="M2.5 2v6h6M3.5 10a9 9 0 1 1 2.1-9l-2.1 3"/></I>
export const IconTrash = (p) => <I {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></I>
