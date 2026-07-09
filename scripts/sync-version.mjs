// 从 package.json 同步 version 到 src/utils/version.ts
// 在每次 build 前跑一遍,避免版本号漂移
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))
const target = join(process.cwd(), 'src', 'utils', 'version.ts')

const content = `// 应用版本号 (由 scripts/sync-version.mjs 从 package.json 自动同步,勿手动改)
export const APP_VERSION = '${pkg.version}'
`

writeFileSync(target, content)
console.log(`✓ src/utils/version.ts synced to ${pkg.version}`)
