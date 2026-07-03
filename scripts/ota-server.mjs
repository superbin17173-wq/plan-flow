// OTA 更新服务器 - 将 dist/ 目录作为静态文件服务
// 用法: node scripts/ota-server.mjs [端口]
import { createServer } from 'http'
import { createReadStream, existsSync, statSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DIST_DIR = join(__dirname, '..', 'dist')
const PORT = Number(process.argv[2]) || 3017

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.zip': 'application/zip',
}

const server = createServer((req, res) => {
  // CORS 头（允许APP跨域请求）
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  let urlPath = req.url.split('?')[0]
  if (urlPath === '/') urlPath = '/index.html'

  const filePath = join(DIST_DIR, urlPath)

  // 安全检查：防止目录遍历
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
    return
  }

  const s = statSync(filePath)
  if (s.isDirectory()) {
    res.writeHead(302, { Location: urlPath + '/' })
    res.end()
    return
  }

  const ext = extname(filePath).toLowerCase()
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': s.size,
    'Cache-Control': ext === '.html' || ext === '.json' ? 'no-cache' : 'public, max-age=31536000',
  })

  createReadStream(filePath).pipe(res)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n OTA 更新服务器已启动`)
  console.log(`   地址: http://0.0.0.0:${PORT}`)
  console.log(`   目录: ${DIST_DIR}`)
  console.log(`\n📱 手机访问: http://<你的IP>:${PORT}`)
  console.log(`\n📦 OTA更新文件:`)
  console.log(`   version.json: http://localhost:${PORT}/version.json`)
  console.log(`   dist.zip:     http://localhost:${PORT}/dist.zip`)
  console.log(`\n按 Ctrl+C 停止\n`)
})
