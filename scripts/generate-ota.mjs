// 构建后自动生成 version.json 和 dist.zip（用于OTA更新）
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { readdir, stat } from 'fs/promises'
import { join, relative } from 'path'
import JSZip from 'jszip'

const DIST_DIR = join(process.cwd(), 'dist')
const VERSION_FILE = join(DIST_DIR, 'version.json')
const ZIP_FILE = join(DIST_DIR, 'dist.zip')
const UPDATE_SERVER = 'http://10.6.4.111:3016'

const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))

async function walkDir(dir) {
  const files = []
  const entries = await readdir(dir)
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const s = await stat(fullPath)
    if (s.isDirectory()) {
      files.push(...await walkDir(fullPath))
    } else {
      files.push(relative(DIST_DIR, fullPath))
    }
  }
  return files
}

async function main() {
  if (!existsSync(DIST_DIR)) {
    console.error('dist/ 目录不存在，请先运行 npm run build')
    process.exit(1)
  }

  const version = pkg.version || '1.0.0'
  const buildTime = new Date().toISOString()

  // 生成 version.json
  const versionData = { version, buildTime }
  writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2))
  console.log(`✓ version.json: ${version} (${buildTime})`)

  // 生成 dist.zip
  const files = await walkDir(DIST_DIR)
  const zip = new JSZip()
  for (const file of files) {
    // 排除 version.json 和 dist.zip 本身
    if (file === 'version.json' || file === 'dist.zip') continue
    const content = readFileSync(join(DIST_DIR, file))
    zip.file(file, content)
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  writeFileSync(ZIP_FILE, zipBuffer)
  console.log(`✓ dist.zip: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`)

  console.log('\nOTA 更新文件已生成！')
  console.log(`  将 dist/ 目录部署到 ${UPDATE_SERVER} 即可远程更新`)
}

main().catch(err => { console.error(err); process.exit(1) })
