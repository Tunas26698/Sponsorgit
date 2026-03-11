const express = require('express')
const app = express()
const PORT = 3000

// ─── Ad "database" (hardcoded for test) ───────────────────────────────────────
const ADS = {
  'sponsorgit': {
    sponsor: 'PublicFail',
    tagline: 'The Startup Cemetery — Learn from 462+ failures',
    bg: '#0a0a0c',
    textColor: '#ffffff',
    accentColor: '#a855f7',
    redirectUrl: 'https://www.publicfail.com',
  },
}

const DEFAULT_AD = ADS['sponsorgit']

// ─── Badge endpoint ──────────────────────────────────────────────────────────
app.get('/v1/badge/:repoId', (req, res) => {
  const { repoId } = req.params
  const ad = ADS[repoId] || DEFAULT_AD

  console.log(`\n[${new Date().toISOString()}] 🖼️  Badge fetched for repo: "${repoId}"`)
  console.log(`   User-Agent: ${req.headers['user-agent']}`)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 60" width="540" height="60" style="max-width:100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#0a0a0c"/>
      <stop offset="100%" style="stop-color:#1a1a2e"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#a855f7"/>
      <stop offset="100%" style="stop-color:#3b82f6"/>
    </linearGradient>
  </defs>

  <!-- Background — inset 0.5px to avoid border clipping -->
  <rect x="0.5" y="0.5" width="539" height="59" rx="7.5" fill="url(#bg)"/>
  <rect x="0.5" y="0.5" width="539" height="59" rx="7.5" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>

  <!-- Accent left bar -->
  <rect x="0" y="0" width="4" height="60" rx="3" fill="url(#accent)"/>

  <!-- Sponsored label -->
  <text x="20" y="22" font-family="Arial, sans-serif" font-size="9" font-weight="600"
    fill="#a855f7" letter-spacing="1.5">♥ SPONSORED</text>

  <!-- Brand name -->
  <text x="20" y="42" font-family="Arial, sans-serif" font-size="15" font-weight="700"
    fill="#ffffff">${ad.sponsor}</text>

  <!-- Divider -->
  <line x1="130" y1="15" x2="130" y2="45" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>

  <!-- Tagline -->
  <text x="146" y="35" font-family="Arial, sans-serif" font-size="12"
    fill="rgba(255,255,255,0.7)">${ad.tagline}</text>
</svg>`

  res.setHeader('Content-Type', 'image/svg+xml')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.send(svg)
})

// ─── Click tracking + redirect ───────────────────────────────────────────────
app.get('/click/:repoId', (req, res) => {
  const { repoId } = req.params
  const ad = ADS[repoId] || DEFAULT_AD

  console.log(`\n[${new Date().toISOString()}] 🖱️  CLICK on repo: "${repoId}"`)
  console.log(`   Redirecting to: ${ad.redirectUrl}`)

  res.redirect(302, ad.redirectUrl)
})

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    endpoints: {
      badge: '/v1/badge/:repoId',
      click: '/click/:repoId',
    },
    test_url: `http://localhost:${PORT}/v1/badge/sponsorgit`,
  })
})

app.listen(PORT, () => {
  console.log(`\n🚀 SponsorGit Test Server running at http://localhost:${PORT}`)
  console.log(`\n📋 Endpoints:`)
  console.log(`   Badge:  http://localhost:${PORT}/v1/badge/sponsorgit`)
  console.log(`   Click:  http://localhost:${PORT}/click/sponsorgit`)
  console.log(`\n⏳ Waiting for requests...\n`)
})
