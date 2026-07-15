// 从 package.json 同步 version 到 src/utils/version.ts 和 android/app/build.gradle
// 在每次 build 前跑一遍,避免版本号漂移
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))
const ver = pkg.version // e.g. "0.0.12"

// 1. 同步 version.ts
const target = join(process.cwd(), 'src', 'utils', 'version.ts')
const content = `// 应用版本号 (由 scripts/sync-version.mjs 从 package.json 自动同步,勿手动改)
export const APP_VERSION = '${ver}'
`
writeFileSync(target, content)
console.log(`✓ src/utils/version.ts synced to ${ver}`)

// 2. 同步 build.gradle 的 versionCode 和 versionName
//    versionCode = 用版本号的数字拼接,确保递增 (0.0.12 → 12, 0.1.0 → 100, 1.0.0 → 10000)
//    versionName = package.json 的 version 字符串
const parts = ver.split('.').map(Number)
const versionCode = parts.reduce((acc, n) => acc * 100 + n, 0)

const gradlePath = join(process.cwd(), 'android', 'app', 'build.gradle')
let gradle = readFileSync(gradlePath, 'utf-8')
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${ver}"`)
writeFileSync(gradlePath, gradle)
console.log(`✓ android/app/build.gradle synced: versionCode=${versionCode}, versionName="${ver}"`)
