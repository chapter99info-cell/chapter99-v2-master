/**
 * Blocks accidental deploys to chapter99-v4-complete from this Trip2Talk workspace.
 * Run via: npm run deploy:trip2talk
 */
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TRIP2TALK_PROJECT_ID = 'prj_WBhMyIWaqCOvGx13gEPhFDhFghz2'
const CHAPTER99_PROJECT_ID = 'prj_HEo1m0nLxstIv0s1k5QGHcnr0DKz'
const EXPECTED_NAME = 'trip2talk-v4'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function resolveLinkedProject() {
  const projectJson = join(ROOT, '.vercel', 'project.json')
  if (existsSync(projectJson)) {
    const j = readJson(projectJson)
    return { id: j.projectId, name: j.projectName }
  }
  const repoJson = join(ROOT, '.vercel', 'repo.json')
  if (existsSync(repoJson)) {
    const j = readJson(repoJson)
    const p = j.projects?.[0]
    if (p) return { id: p.id, name: p.name }
  }
  return null
}

const linked = resolveLinkedProject()
if (!linked?.id) {
  console.error(
    '\n❌ No Vercel project link found. Run:\n   npx vercel link --yes --project trip2talk-v4\n',
  )
  process.exit(1)
}

if (linked.id === CHAPTER99_PROJECT_ID || linked.name === 'chapter99-v4-complete') {
  console.error(
    `\n❌ BLOCKED: This folder is linked to "${linked.name}" (Mira Thai / chapter99info.tech).\n` +
      `   Trip2Talk code must deploy only to trip2talk-v4.\n\n` +
      `   Fix: npx vercel link --yes --project trip2talk-v4\n`,
  )
  process.exit(1)
}

if (linked.id !== TRIP2TALK_PROJECT_ID || linked.name !== EXPECTED_NAME) {
  console.error(
    `\n❌ Unexpected Vercel project: ${linked.name} (${linked.id})\n` +
      `   Expected: ${EXPECTED_NAME} (${TRIP2TALK_PROJECT_ID})\n\n` +
      `   Fix: npx vercel link --yes --project trip2talk-v4\n`,
  )
  process.exit(1)
}

console.log(`✓ Vercel link OK → ${EXPECTED_NAME}`)
