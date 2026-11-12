import { renameSync } from 'node:fs'

import { appendContextForTest as appendContext, promptForTest as promptFor } from './index.js'
import { readBrief, renderBrief } from './context.js'
import { refresh, upstreamSummary, BREVITY_RULE, DSH_RULES } from './upstream.js'

const checks = []
const ok = (label, condition, detail) => {
  checks.push({ label, pass: Boolean(condition), detail })
  console.log((condition ? 'PASS ' : 'FAIL ') + label + (detail === undefined ? '' : '  ->  ' + detail))
}

const zh = '帮我把设置页面的“保存”按钮改一下，点了没反应，用户说很慢'
const en = 'can you look at the sidebar thing when it breaks sometimes thanks'

const synced = await refresh({ force: true })
ok('upstream refresh succeeded', synced.ok === true, JSON.stringify(synced))
ok('six templates cached', upstreamSummary().templates === 6, String(upstreamSummary().templates))

for (const [mode, expected] of [
  ['auto', 'user-prompt-basic'],
  ['structured', 'user-prompt-planning'],
  ['concise', 'user-prompt-basic'],
  ['professional', 'user-prompt-professional'],
]) {
  const p = promptFor(mode, zh)
  ok(mode + ' uses the upstream template', p.template.source === 'upstream' && p.template.id === expected, p.template.id)
  ok(
    mode + ' system carries the DSH rules',
    p.system.includes(DSH_RULES.split('\n')[0]) && p.system.includes('This rewrite is written for DSH'),
  )
  ok(mode + ' user message carries the draft', p.user.includes(zh) && !p.user.includes('{{'))
  ok(mode + ' brevity rule matches the mode', p.system.includes(BREVITY_RULE) === (mode === 'concise'))
}

const pEn = promptFor('auto', en)
ok('an English draft picks the English template', pEn.template.id === 'user-prompt-basic_en', pEn.template.id)
ok(
  'the English template is English',
  /Output|prompt|optimiz/i.test(pEn.system) && !/[\u4e00-\u9fff]/u.test(pEn.system.slice(0, 400)),
)

// ---- context excerpt ------------------------------------------------------
const message = (role, ...texts) => ({ role, content: texts.map((text) => ({ type: 'text', text })) })

function fakeContext({ messages = [], title, goal, cwd = 'D:/work/site' } = {}) {
  const session = {
    header: { cwd },
    deriveMessages: () => messages,
    snapshotEvents: () => [],
  }
  const services = {
    sessions: { get: (id) => (id === 'session-1' ? session : undefined) },
    sessionTitle: { get: () => (title === undefined ? undefined : { title }) },
    agents: { get: () => ({ id: 'session-1' }) },
    goals: { get: () => (goal === undefined ? undefined : goal) },
  }
  return { get: (key) => services[key] }
}

ok('no brief for an unknown session', readBrief(fakeContext(), 'session-9') === null)
ok('no brief for an anonymous request', readBrief(fakeContext(), '') === null)
ok('no brief when the services are absent', readBrief({ get: () => undefined }, 'session-1') === null)

const emptyBrief = readBrief(fakeContext(), 'session-1')
ok('an empty session yields no brief', emptyBrief === null, JSON.stringify(emptyBrief))

const brief = readBrief(
  fakeContext({
    messages: [message('user', '看一下设置页'), message('assistant', '好的，我先读 Settings.tsx'), message('tool', 'ignored')],
    title: '设置页按钮',
    goal: { phase: 'active', objective: '把设置页的保存按钮修好' },
  }),
  'session-1',
)
ok('the excerpt keeps the conversation turns', brief !== null && brief.turns.length === 2, JSON.stringify(brief && brief.turns.length))
ok('the excerpt carries the title', brief !== null && brief.title === '设置页按钮', brief && brief.title)
ok('the excerpt carries the active goal', brief !== null && brief.goal === '把设置页的保存按钮修好', brief && brief.goal)
ok('the excerpt carries the workspace', brief !== null && brief.cwd === 'D:/work/site', brief && brief.cwd)

const rendered = renderBrief(brief)
ok('the block names the session', rendered.startsWith('<session_context>') && rendered.includes('Session: 设置页按钮'))
ok('the block names the goal', rendered.includes('Goal: 把设置页的保存按钮修好'))
ok('the block labels each turn', rendered.includes('User: 看一下设置页') && rendered.includes('Assistant: 好的，我先读 Settings.tsx'))
ok('tool traffic never reaches the prompt', !rendered.includes('ignored'))
ok('the block closes', rendered.trimEnd().endsWith('</session_context>'))

const paused = readBrief(
  fakeContext({ messages: [message('user', 'hi')], goal: { phase: 'paused', objective: 'later' } }),
  'session-1',
)
ok('a paused goal is not quoted', paused !== null && paused.goal === undefined, paused && String(paused.goal))

const long = readBrief(fakeContext({ messages: [message('user', 'x'.repeat(5000))] }), 'session-1')
ok('a long message is clipped', long !== null && long.turns[0].text.length <= 600 && long.turns[0].text.endsWith('…'), String(long && long.turns[0].text.length))

const many = readBrief(
  fakeContext({ messages: Array.from({ length: 20 }, (_, index) => message(index % 2 === 0 ? 'user' : 'assistant', 'turn ' + index)) }),
  'session-1',
)
ok('at most six turns are kept', many !== null && many.turns.length === 6, String(many && many.turns.length))
ok('the newest turns are the ones kept', many !== null && many.turns[5].text === 'turn 19', many && many.turns[5].text)

// ---- prompt assembly ------------------------------------------------------
const bare = promptFor('auto', zh)
ok('a request without a session keeps the prompt untouched', appendContext(bare.system, null) === bare.system)

const withBrief = appendContext(bare.system, brief)
ok('the excerpt is appended after the mode rules', withBrief.startsWith(bare.system) && withBrief.length > bare.system.length)
ok('the context rules are appended', withBrief.includes('Use it as background only') && withBrief.includes('<session_context>'))
ok('the draft stays out of the system prompt', !withBrief.includes(zh))
ok('appendContext is idempotent for an empty brief', appendContext(bare.system, { ...brief, turns: [] }).includes('Session:'))

// Fallback: hide the cache and confirm the built-in prompt takes over.
const statePath = new URL('./.state/upstream.json', import.meta.url)
const hidden = new URL('./.state/upstream.json.hidden', import.meta.url)
renameSync(statePath, hidden)
try {
  const builtin = promptFor('auto', zh)
  ok('no cache falls back to the built-in prompt', builtin.template.source === 'builtin' && builtin.user.startsWith('<draft>'))
  ok('the built-in prompt still mentions DSH', builtin.system.includes('DSH, a coding agent'))
} finally {
  renameSync(hidden, statePath)
}
const restored = promptFor('auto', zh)
ok('the cache is used again once it is back', restored.template.source === 'upstream', restored.template.ref)

const failed = checks.filter((c) => !c.pass)
console.log('\n' + (failed.length === 0 ? 'ALL PASS (' + checks.length + ' checks)' : failed.length + ' FAILED'))
process.exit(failed.length === 0 ? 0 : 1)
