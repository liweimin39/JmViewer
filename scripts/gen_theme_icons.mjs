// 临时脚本：生成 6 套主题 icon/splash SVG + PNG 到 assets/
import { writeFileSync, readFileSync } from 'node:fs'
import sharp from 'sharp'

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"

// 渐变取色自 themes.css 各主题 accent 系
const themes = [
  { name: 'pink', g1: '#ffb0cb', g2: '#ff5a88', text: '#ffffff', splashBg: '#ffffff' },
  { name: 'blue', g1: '#bcdcf5', g2: '#3b8ede', text: '#ffffff', splashBg: '#ffffff' },
  { name: 'green', g1: '#bdebd5', g2: '#2fae72', text: '#ffffff', splashBg: '#ffffff' },
  { name: 'purple', g1: '#d9c6f5', g2: '#8a4ede', text: '#ffffff', splashBg: '#ffffff' },
  { name: 'gray', g1: '#e0e0e0', g2: '#8a8a8a', text: '#ffffff', splashBg: '#ffffff' },
  { name: 'dark', g1: '#3a2830', g2: '#1b1518', text: '#ff9ec0', splashBg: '#1b1518' },
]

const iconSvg = (t) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${t.g1}"/>
      <stop offset="100%" stop-color="${t.g2}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1024" height="1024" fill="url(#bg)"/>
  <text x="512" y="545"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="${FONT}"
        font-size="460"
        font-weight="800"
        letter-spacing="-30"
        fill="${t.text}">Jm</text>
</svg>`

const splashSvg = (t) => `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <defs>
    <linearGradient id="bg2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${t.g1}"/>
      <stop offset="100%" stop-color="${t.g2}"/>
    </linearGradient>
  </defs>
  <rect width="2732" height="2732" fill="${t.splashBg}"/>
  <text x="1366" y="1400"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="${FONT}"
        font-size="480"
        font-weight="800"
        letter-spacing="-30"
        fill="url(#bg2)">Jm</text>
</svg>`

for (const t of themes) {
  const iSvg = iconSvg(t)
  const sSvg = splashSvg(t)
  writeFileSync(`assets/icon_${t.name}.svg`, iSvg)
  writeFileSync(`assets/splash_${t.name}.svg`, sSvg)
  await sharp(Buffer.from(iSvg), { density: 300 }).png().toFile(`assets/icon_${t.name}.png`)
  await sharp(Buffer.from(sSvg), { density: 300 }).png().toFile(`assets/splash_${t.name}.png`)
  console.log('done', t.name)
}

// pink 版同时作为默认 assets/icon.png / splash.png（capacitor-assets 读取默认名）
await sharp(Buffer.from(iconSvg(themes[0])), { density: 300 }).png().toFile('assets/icon.png')
await sharp(Buffer.from(splashSvg(themes[0])), { density: 300 }).png().toFile('assets/splash.png')
console.log('ALL DONE')
