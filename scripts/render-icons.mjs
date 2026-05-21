#!/usr/bin/env node
// Render the desktop icon binaries (build/icon.png, build/icon.icns,
// build/icon.ico) from the design-system SVG master so the rebrand
// stays sourced from a single vector.
//
// One-time generation, not run in CI. Operator runs `npm run icons`
// after a brand asset change, then commits the regenerated PNG/ICNS/ICO
// binaries on top.
//
// Steps:
//   1. Render a 1024x1024 PNG from the SVG (rsvg-convert or imagemagick).
//   2. electron-icon-builder turns that into the .png, .icns, .ico
//      ladder under build/icons/.
//   3. Move the three we ship into build/.

import { execSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SVG = process.env.OMNIZEN_ICON_SVG
  ?? resolve(ROOT, '../omnizen-app/design-system/assets/svg/omnizen-app-icon.svg')
const BUILD = resolve(ROOT, 'build')
const TMP_PNG = '/tmp/omnizen-app-icon-1024.png'

function have(cmd) {
  return spawnSync('which', [cmd], { stdio: 'ignore' }).status === 0
}

function renderSvgTo1024() {
  if (!existsSync(SVG)) {
    console.error(`No SVG master at ${SVG} - set OMNIZEN_ICON_SVG or check out the design-system repo next to this one`)
    process.exit(1)
  }
  if (have('rsvg-convert')) {
    execSync(`rsvg-convert -w 1024 -h 1024 "${SVG}" -o "${TMP_PNG}"`, { stdio: 'inherit' })
    return
  }
  if (have('convert')) {
    // ImageMagick fallback. Density high so the SVG rasterises cleanly.
    execSync(`convert -background none -density 600 -resize 1024x1024 "${SVG}" "${TMP_PNG}"`, { stdio: 'inherit' })
    return
  }
  console.error('Need either `rsvg-convert` (librsvg2-bin) or `convert` (imagemagick) on PATH')
  process.exit(1)
}

function buildIconLadder() {
  // electron-icon-builder writes a `icons/` subfolder full of PNGs +
  // icon.icns + icon.ico. --flatten drops the per-size subfolders.
  execSync(
    `npx --yes electron-icon-builder --input="${TMP_PNG}" --output="${BUILD}" --flatten`,
    { stdio: 'inherit' }
  )
}

function moveOutputs() {
  const icons = join(BUILD, 'icons')
  const moves = [
    ['1024.png', 'icon.png'],
    ['icon.icns', 'icon.icns'],
    ['icon.ico', 'icon.ico'],
  ]
  for (const [from, to] of moves) {
    const src = join(icons, from)
    const dst = join(BUILD, to)
    if (!existsSync(src)) continue
    renameSync(src, dst)
    console.log(`✓ ${to}`)
  }
  // Tidy the intermediate ladder so it doesn't end up in git.
  if (existsSync(icons)) rmSync(icons, { recursive: true, force: true })
}

mkdirSync(BUILD, { recursive: true })
renderSvgTo1024()
buildIconLadder()
moveOutputs()
console.log('\nDone. Commit the three icon files under build/.')
