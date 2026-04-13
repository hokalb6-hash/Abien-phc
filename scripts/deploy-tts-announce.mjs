import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadProjectRef() {
  const fromEnv = process.env.SUPABASE_PROJECT_REF?.trim()
  if (fromEnv) return fromEnv
  const envPath = join(root, '.env')
  if (!existsSync(envPath)) {
    console.error('ضع SUPABASE_PROJECT_REF أو أضف VITE_SUPABASE_URL في ملف .env')
    process.exit(1)
  }
  const raw = readFileSync(envPath, 'utf8')
  const line = raw.split(/\r?\n/).find((l) => l.startsWith('VITE_SUPABASE_URL='))
  if (!line) {
    console.error('ملف .env لا يحتوي VITE_SUPABASE_URL')
    process.exit(1)
  }
  const val = line.slice('VITE_SUPABASE_URL='.length).trim().replace(/^["']|["']$/g, '')
  const m = val.match(/https?:\/\/([^.]+)\.supabase\.co/i)
  if (!m) {
    console.error('عنوان Supabase غير متوقع في VITE_SUPABASE_URL')
    process.exit(1)
  }
  return m[1]
}

function supabaseBin() {
  const name = process.platform === 'win32' ? 'supabase.exe' : 'supabase'
  return join(root, 'node_modules', 'supabase', 'bin', name)
}

const bin = supabaseBin()
if (!existsSync(bin)) {
  console.error('لم يُعثر على Supabase CLI. نفّذ: npm install supabase --save-dev')
  process.exit(1)
}

const ref = loadProjectRef()
const r = spawnSync(bin, ['functions', 'deploy', 'tts-announce', '--project-ref', ref], {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
})
process.exit(typeof r.status === 'number' ? r.status : 1)
