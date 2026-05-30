import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const apkPath = resolve(root, 'public/downloads/labs-burger-pos-debug.apk')
const hiddenPath = resolve(root, 'public/downloads/.labs-burger-pos-debug.apk.tmp')

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  if (result.status !== 0) process.exit(result.status || 1)
}

mkdirSync(dirname(apkPath), { recursive: true })

const hadApk = existsSync(apkPath)
if (hadApk) renameSync(apkPath, hiddenPath)

try {
  run('vite', ['build'])
} finally {
  if (existsSync(hiddenPath)) renameSync(hiddenPath, apkPath)
}
