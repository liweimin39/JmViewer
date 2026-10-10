// 临时脚本：把 5 套主题 icon PNG 写入 iOS alternate appiconset（备用图标，运行时可切换）
import { mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const themes = ['blue', 'green', 'purple', 'gray', 'dark']
const base = 'ios/App/App/Assets.xcassets'

for (const t of themes) {
  const dir = `${base}/AppIcon-${t}.appiconset`
  mkdirSync(dir, { recursive: true })
  await sharp(`assets/icon_${t}.png`).png().toFile(`${dir}/icon-1024.png`)
  writeFileSync(
    `${dir}/Contents.json`,
    JSON.stringify(
      {
        images: [{ idiom: 'universal', platform: 'ios', size: '1024x1024', filename: 'icon-1024.png' }],
        info: { author: 'xcode', version: 1 },
      },
      null,
      2
    )
  )
  console.log('done', t)
}
console.log('ALL DONE')
