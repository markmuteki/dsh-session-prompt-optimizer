// Manifest sanity: keeps package.json, cordis.patch.yml and the files list in
// agreement. Runs in CI and before a release; no network, no state.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (p) => readFileSync(join(root, p), 'utf8')
const pkg = JSON.parse(read('package.json'))

const failures = []
const ok = (label, condition, detail) => {
  console.log((condition ? 'PASS ' : 'FAIL ') + label + (detail === undefined ? '' : '  ->  ' + detail))
  if (!condition) {
    failures.push(label)
  }
}

// 1. The bundle patch exists and inserts the same id/name as the package.
const patchPath = pkg.dsh?.bundle?.patch
ok('dsh.bundle.patch declared', typeof patchPath === 'string', patchPath)
if (typeof patchPath === 'string') {
  ok('bundle patch file exists', existsSync(join(root, patchPath)), patchPath)
  const patch = read(patchPath)
  const id = patch.match(/^\s*- id:\s*(\S+)\s*$/m)?.[1]
  const name = patch.match(/^\s*name:\s*['"]?([^'"\n]+)['"]?\s*$/m)?.[1]
  ok('patch id matches package name', id === pkg.name, `${id} vs ${pkg.name}`)
  ok('patch name matches package name', name === pkg.name, `${name} vs ${pkg.name}`)
}

// 2. The client entry the host will load actually exists.
ok('dsh.client.platform is web', pkg.dsh?.client?.platform === 'web')
const clientEntry = typeof pkg.exports?.['./client'] === 'string' ? pkg.exports['./client'] : null
ok('client entry exported', Boolean(clientEntry), clientEntry)
if (clientEntry) {
  ok('client entry exists', existsSync(join(root, clientEntry)), clientEntry)
}

// 3. Everything the package promises to ship is present on disk.
for (const entry of pkg.files ?? []) {
  if (entry.includes('*')) {
    // A glob is satisfied by an existing directory that actually has matches.
    const dir = join(root, dirname(entry))
    const suffix = entry.slice(entry.lastIndexOf('*') + 1)
    const hits = existsSync(dir)
      ? readdirSync(dir).filter((f) => f.endsWith(suffix))
      : []
    ok(`files glob matches: ${entry}`, hits.length > 0, `${dir} -> ${hits.length}`)
    continue
  }
  const target = join(root, entry)
  ok(`files entry exists: ${entry}`, existsSync(target), target)
}

// 4. Export targets resolve (published package must not point at missing files).
const exportsMap = pkg.exports ?? {}
for (const [key, value] of Object.entries(exportsMap)) {
  if (typeof value !== 'string') {
    continue
  }
  if (value.includes('*')) {
    const dir = join(root, dirname(value.split('*')[0]))
    ok(`export ${key} directory exists`, existsSync(dir), dir)
  } else {
    ok(`export ${key} exists`, existsSync(join(root, value)), value)
  }
}

// 5. Nothing that is machine-local may be shipped.
for (const banned of ['.state', 'node_modules']) {
  ok(`${banned} is not shipped`, !(pkg.files ?? []).includes(banned))
}
if (existsSync(join(root, 'LICENSE'))) {
  ok('LICENSE is not empty', statSync(join(root, 'LICENSE')).size > 100)
}

if (failures.length > 0) {
  console.error(`\n${failures.length} manifest check(s) failed`)
  process.exit(1)
}
console.log('\nmanifest OK')
