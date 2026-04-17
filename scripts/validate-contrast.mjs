#!/usr/bin/env node

const MIN_CONTRAST = 4.5

const palettes = {
  dark: {
    colorBg: '#0f1722',
    colorSurface: '#172132',
    colorSurfaceElevated: '#1f2c42',
    colorTextPrimary: '#e6edf7',
    colorTextSecondary: '#b6c2d4',
    colorTextDanger: '#fca5a5',
    colorActionPrimaryBg: '#2563eb',
    colorActionPrimaryBgHover: '#1d4ed8',
    colorActionPrimaryText: '#ffffff',
    colorActionSecondaryBg: '#1f2c42',
    colorActionSecondaryBgHover: '#2a3a54',
    colorActionSecondaryText: '#dbeafe',
  },
  light: {
    colorBg: '#f8fafc',
    colorSurface: '#ffffff',
    colorSurfaceElevated: '#eef2f7',
    colorTextPrimary: '#111827',
    colorTextSecondary: '#334155',
    colorTextDanger: '#b91c1c',
    colorActionPrimaryBg: '#1d4ed8',
    colorActionPrimaryBgHover: '#1e40af',
    colorActionPrimaryText: '#ffffff',
    colorActionSecondaryBg: '#e2e8f0',
    colorActionSecondaryBgHover: '#cbd5e1',
    colorActionSecondaryText: '#0f172a',
  },
}

const checks = [
  ['Primary text on page', 'colorTextPrimary', 'colorBg'],
  ['Secondary text on page', 'colorTextSecondary', 'colorBg'],
  ['Primary text on surface', 'colorTextPrimary', 'colorSurface'],
  ['Secondary text on surface', 'colorTextSecondary', 'colorSurface'],
  ['Danger text on page', 'colorTextDanger', 'colorBg'],
  ['Primary button text', 'colorActionPrimaryText', 'colorActionPrimaryBg'],
  ['Primary button text hover', 'colorActionPrimaryText', 'colorActionPrimaryBgHover'],
  ['Secondary button text', 'colorActionSecondaryText', 'colorActionSecondaryBg'],
  ['Secondary button text hover', 'colorActionSecondaryText', 'colorActionSecondaryBgHover'],
]

const toRgb = (hex) => {
  const normalized = hex.replace('#', '')
  const full = normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized

  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ]
}

const linearize = (channel) => {
  const normalized = channel / 255
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

const luminance = (hex) => {
  const [r, g, b] = toRgb(hex).map(linearize)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrastRatio = (fgHex, bgHex) => {
  const fg = luminance(fgHex)
  const bg = luminance(bgHex)
  const lighter = Math.max(fg, bg)
  const darker = Math.min(fg, bg)
  return (lighter + 0.05) / (darker + 0.05)
}

let hasFailures = false

for (const [paletteName, palette] of Object.entries(palettes)) {
  console.log(`\nPalette: ${paletteName}`)

  for (const [label, fgToken, bgToken] of checks) {
    const fg = palette[fgToken]
    const bg = palette[bgToken]
    const ratio = contrastRatio(fg, bg)
    const pass = ratio >= MIN_CONTRAST

    if (!pass) {
      hasFailures = true
    }

    const ratioDisplay = ratio.toFixed(2)
    const status = pass ? 'PASS' : 'FAIL'
    console.log(`- ${label}: ${ratioDisplay}:1 (${status})`)
  }
}

if (hasFailures) {
  console.error(`\nContrast validation failed. All text + interactive checks must be at least ${MIN_CONTRAST}:1.`)
  process.exit(1)
}

console.log('\nContrast validation passed for all configured palettes.')
