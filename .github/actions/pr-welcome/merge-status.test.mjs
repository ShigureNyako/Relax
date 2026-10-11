import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadMergeStatus, renderMergeStatus } from './merge-status.mjs'

const oldTime = '2026-09-27T18:21:26Z'
const newTime = '2026-09-27T18:22:09Z'
const appId = 15368

function checkRun(conclusion, overrides = {}) {
  return {
    __typename: 'CheckRun',
    name: 'required',
    databaseId: 1,
    startedAt: oldTime,
    status: 'COMPLETED',
    conclusion,
    isRequired: true,
    checkSuite: {
      createdAt: oldTime,
      app: { databaseId: appId },
      workflowRun: {
        runNumber: 1,
        runAttempt: 1,
        event: 'pull_request',
        workflow: { id: 'workflow-ci', name: 'CI' },
      },
    },
    ...overrides,
  }
}

function statusContext(state, overrides = {}) {
  return {
    __typename: 'StatusContext',
    context: 'required',
    state,
    createdAt: oldTime,
    isRequired: true,
    ...overrides,
  }
}

function snapshot(checks, required = [{ context: 'required', integration_id: appId }]) {
  return {
    pr: { user: { login: 'author' }, draft: false },
    state: { mergeable: 'MERGEABLE', mergeStateStatus: 'BLOCKED' },
    rules: [
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: 1,
          required_reviewers: [
            { reviewer: { type: 'Team', id: 10 }, minimum_approvals: 1, file_patterns: ['*'] },
          ],
        },
      },
      { type: 'required_status_checks', parameters: { required_status_checks: required } },
    ],
    reviews: [],
    checks,
    teams: new Map([[10, { slug: 'reviewers', members: ['author', 'reviewer'] }]]),
    warnings: [],
  }
}

function expectCI(checks, expected, required) {
  const input = snapshot(checks, required)
  const before = structuredClone(input)
  const body = renderMergeStatus(input)
  assert.ok(body.includes(`| CI | ${expected} |`), body)
  assert.match(body, /\*\*GitHub：⏳ 合入条件未满足\*\*/)
  assert.match(body, /\| 审批人数 \| ⏳ 0\/1/)
  assert.match(body, /\| 团队审批（`reviewers`） \| ⏳ 0\/1 · 可联系：`reviewer` \|/)
  assert.deepEqual(input, before, 'rendering must not mutate the snapshot')
}

function expectEitherOrder(records, expected, required) {
  expectCI([records], expected, required)
  expectCI([records.toReversed()], expected, required)
}

test('old cancellation does not override the latest success', () => {
  expectEitherOrder(
    [checkRun('CANCELLED'), checkRun('SUCCESS', { databaseId: 2, startedAt: newTime })],
    '✅ 已通过'
  )
})

for (const conclusion of [
  'FAILURE',
  'CANCELLED',
  'TIMED_OUT',
  'ACTION_REQUIRED',
  'STARTUP_FAILURE',
  'STALE',
  'UNKNOWN',
  null,
]) {
  test(`latest ${conclusion} is not masked by an old success`, () => {
    expectEitherOrder(
      [checkRun('SUCCESS'), checkRun(conclusion, { databaseId: 2, startedAt: newTime })],
      '❌ 未通过'
    )
  })
}

for (const status of ['QUEUED', 'WAITING', 'IN_PROGRESS', 'PENDING', 'REQUESTED']) {
  test(`latest ${status} is not masked by an old success`, () => {
    const latest = checkRun(null, { databaseId: 2, startedAt: null, status })
    latest.checkSuite.workflowRun.runAttempt = 2
    expectEitherOrder([checkRun('SUCCESS'), latest], '⏳ 等待通过')
  })
}

test('a new queued check wins within the same suite and parent run attempt', () => {
  expectEitherOrder(
    [checkRun('SUCCESS'), checkRun(null, { databaseId: 2, startedAt: null, status: 'QUEUED' })],
    '⏳ 等待通过'
  )
})

test('a newer workflow run remains pending before its check starts', () => {
  const latest = checkRun(null, { databaseId: 2, startedAt: null, status: 'QUEUED' })
  latest.checkSuite.createdAt = newTime
  latest.checkSuite.workflowRun.runNumber = 2
  expectEitherOrder([checkRun('SUCCESS'), latest], '⏳ 等待通过')
})

test('a previously queued record does not mask a newer success', () => {
  expectEitherOrder(
    [
      checkRun(null, { startedAt: null, status: 'QUEUED' }),
      checkRun('SUCCESS', { databaseId: 2, startedAt: newTime }),
    ],
    '✅ 已通过'
  )
})

test('an external app rerun is pending even without workflow metadata', () => {
  const previous = checkRun('SUCCESS')
  const latest = checkRun(null, { databaseId: 2, startedAt: null, status: 'QUEUED' })
  previous.checkSuite.workflowRun = null
  latest.checkSuite.workflowRun = null
  expectEitherOrder([previous, latest], '⏳ 等待通过')
})

test('a pending check without ordering metadata cannot be guessed as a pass', () => {
  expectEitherOrder(
    [checkRun('SUCCESS'), checkRun(null, { databaseId: null, startedAt: null, status: 'QUEUED' })],
    '⏳ 等待通过'
  )
})

test('a later-started rerun of an older workflow is still the current result', () => {
  const previous = checkRun('SUCCESS')
  previous.checkSuite.workflowRun.runNumber = 2
  const latest = checkRun('FAILURE', { databaseId: 2, startedAt: newTime })
  expectEitherOrder([previous, latest], '❌ 未通过')
})

test('provider-reported start times cannot mask a newer failed check', () => {
  expectEitherOrder(
    [
      checkRun('SUCCESS', { startedAt: newTime }),
      checkRun('FAILURE', { databaseId: 2, startedAt: oldTime }),
    ],
    '❌ 未通过'
  )
})

test('equal start times use the newer check identity, not list order', () => {
  expectEitherOrder([checkRun('SUCCESS'), checkRun('CANCELLED', { databaseId: 2 })], '❌ 未通过')
})

test('an older check finishing later does not replace the newer result', () => {
  expectEitherOrder(
    [
      checkRun('FAILURE', { completedAt: '2026-09-27T19:00:00Z' }),
      checkRun('SUCCESS', { databaseId: 2, startedAt: newTime, completedAt: newTime }),
    ],
    '✅ 已通过'
  )
})

for (const conclusion of ['SUCCESS', 'NEUTRAL', 'SKIPPED']) {
  test(`effective ${conclusion} passes`, () => {
    expectCI([[checkRun(conclusion)]], '✅ 已通过')
  })
}

test('missing required contexts and non-required successes remain pending', () => {
  expectCI([[]], '⏳ 等待通过')
  expectCI([[checkRun('SUCCESS', { isRequired: false })]], '⏳ 等待通过')
  expectCI([[checkRun('SUCCESS')]], '⏳ 等待通过', [
    { context: 'required', integration_id: appId },
    { context: 'missing', integration_id: appId },
  ])
})

test('a latest non-required record cannot leave a stale required success effective', () => {
  expectEitherOrder(
    [
      checkRun('SUCCESS'),
      checkRun('SUCCESS', { databaseId: 2, startedAt: newTime, isRequired: false }),
    ],
    '⏳ 等待通过'
  )
})

test('test-merge contexts take priority per requirement, otherwise use head', () => {
  expectCI([[checkRun('SUCCESS')], [checkRun('FAILURE')]], '❌ 未通过')
  expectCI([[checkRun('FAILURE')], [checkRun('SUCCESS')]], '✅ 已通过')
  expectCI([[checkRun('SUCCESS')], []], '✅ 已通过')
  expectCI([[checkRun('SUCCESS')], [checkRun('FAILURE', { name: 'unrelated' })]], '✅ 已通过')
  const pending = checkRun(null, { startedAt: null, status: 'QUEUED' })
  expectCI([[checkRun('SUCCESS')], [pending]], '⏳ 等待通过')
})

test('same-named status and check must both pass, not replace each other', () => {
  expectEitherOrder([checkRun('SUCCESS'), statusContext('FAILURE')], '❌ 未通过')
  expectEitherOrder([checkRun('FAILURE'), statusContext('SUCCESS')], '❌ 未通过')
  expectEitherOrder([checkRun('SUCCESS'), statusContext('PENDING')], '⏳ 等待通过')
})

for (const state of ['SUCCESS', 'FAILURE', 'ERROR', 'PENDING', 'EXPECTED']) {
  test(`the latest legacy status ${state} replaces its previous value`, () => {
    expectEitherOrder(
      [statusContext('SUCCESS'), statusContext(state, { createdAt: newTime })],
      state === 'SUCCESS'
        ? '✅ 已通过'
        : ['PENDING', 'EXPECTED'].includes(state)
          ? '⏳ 等待通过'
          : '❌ 未通过'
    )
  })
}

test('a latest legacy success replaces an older failure', () => {
  expectEitherOrder(
    [statusContext('FAILURE'), statusContext('SUCCESS', { createdAt: newTime })],
    '✅ 已通过'
  )
})

test('same-time conflicting legacy statuses cannot produce an order-dependent green', () => {
  expectEitherOrder([statusContext('SUCCESS'), statusContext('FAILURE')], '❌ 未通过')
})

test('different workflows, events and providers are not historical reruns of each other', () => {
  for (const field of ['workflow', 'event', 'app']) {
    const other = checkRun('SUCCESS', { databaseId: 2, startedAt: newTime })
    if (field === 'workflow') other.checkSuite.workflowRun.workflow.id = 'other-workflow'
    if (field === 'event') other.checkSuite.workflowRun.event = 'push'
    if (field === 'app') other.checkSuite.app.databaseId = 123
    expectEitherOrder([checkRun('FAILURE'), other], '❌ 未通过', [{ context: 'required' }])
  }
})

test('workflow identity survives renaming and separates equal display names', () => {
  const renamed = checkRun('SUCCESS', { databaseId: 2 })
  renamed.checkSuite.workflowRun.workflow.name = 'Renamed CI'
  expectEitherOrder([checkRun('CANCELLED'), renamed], '✅ 已通过')
  renamed.checkSuite.workflowRun.workflow.name = 'CI'
  renamed.checkSuite.workflowRun.workflow.id = 'other-workflow'
  expectEitherOrder([checkRun('FAILURE'), renamed], '❌ 未通过')
})

test('workflow_dispatch success does not override an eligible required pending check', () => {
  const dispatched = checkRun('SUCCESS', { databaseId: 2, isRequired: false })
  dispatched.checkSuite.workflowRun.event = 'workflow_dispatch'
  expectEitherOrder([checkRun(null, { status: 'PENDING' }), dispatched], '⏳ 等待通过')
})

test('tuple identity is not confused by slash-containing workflow/event names', () => {
  const previous = checkRun('FAILURE')
  previous.checkSuite.workflowRun.workflow = { name: 'CI/pull' }
  previous.checkSuite.workflowRun.event = 'request'
  const other = checkRun('SUCCESS', { databaseId: 2 })
  other.checkSuite.workflowRun.workflow = { name: 'CI' }
  other.checkSuite.workflowRun.event = 'pull/request'
  expectEitherOrder([previous, other], '❌ 未通过')
})

test('a provider pin cannot be satisfied or overridden by another check app', () => {
  const other = checkRun('SUCCESS', { databaseId: 2, startedAt: newTime })
  other.checkSuite.app.databaseId = 123
  expectCI([[other]], '⏳ 等待通过')
  expectEitherOrder([checkRun('FAILURE'), other], '❌ 未通过')
  other.conclusion = 'FAILURE'
  expectEitherOrder([checkRun('SUCCESS'), other], '✅ 已通过')
  expectCI([[checkRun('SUCCESS')], [other]], '✅ 已通过')
})

test('classic any-app (-1) and ruleset unpinned checks accept any provider', () => {
  const other = checkRun('SUCCESS')
  other.checkSuite.app.databaseId = 123
  for (const integration_id of [-1, null, undefined]) {
    expectCI([[other]], '✅ 已通过', [{ context: 'required', integration_id }])
  }
})

test('unknown provider identity cannot mask a potentially required failure', () => {
  const previous = checkRun('FAILURE')
  const latest = checkRun('SUCCESS', { databaseId: 2 })
  previous.checkSuite.app = null
  latest.checkSuite.app = null
  expectEitherOrder([previous, latest], '❌ 未通过', [{ context: 'required' }])
})

test('a pinned pending check is not replaced by an unrequired provider success', () => {
  const previous = checkRun(null, { status: 'PENDING' })
  const other = checkRun('SUCCESS', { databaseId: 2, isRequired: false })
  other.checkSuite.app.databaseId = 123
  expectEitherOrder([previous, other], '⏳ 等待通过')
})

test('a pinned provider with missing app metadata remains pending', () => {
  const check = checkRun('SUCCESS')
  check.checkSuite.app = null
  expectCI([[check]], '⏳ 等待通过')
})

test('one provider cannot satisfy two provider pins with the same context', () => {
  const required = [
    { context: 'required', integration_id: appId },
    { context: 'required', integration_id: 123 },
  ]
  expectCI([[checkRun('SUCCESS')]], '⏳ 等待通过', required)
  expectCI([[statusContext('SUCCESS')]], '⏳ 等待通过', required)
  const other = checkRun('SUCCESS')
  other.checkSuite.app.databaseId = 123
  expectCI([[checkRun('SUCCESS'), other]], '✅ 已通过', required)
})

test('effective failure still dominates waiting and missing requirements', () => {
  expectCI([[checkRun('FAILURE')]], '❌ 未通过', [
    { context: 'required', integration_id: appId },
    { context: 'missing', integration_id: appId },
  ])
})

test('legacy statuses retain GitHub isRequired as their provider authority', () => {
  expectCI([[statusContext('SUCCESS')]], '✅ 已通过')
  expectCI([[statusContext('SUCCESS', { isRequired: false })]], '⏳ 等待通过')
})

test('loading paginates contexts and retains metadata before required selection', async () => {
  const pr = { head: { sha: 'head' }, base: { ref: 'main' } }
  const pages = [
    [checkRun('CANCELLED')],
    [
      checkRun('SUCCESS', { databaseId: 2, startedAt: newTime }),
      checkRun('SUCCESS', { name: 'optional', isRequired: false }),
    ],
  ]
  const calls = []
  const github = {
    rest: {
      pulls: { get: async () => ({ data: pr }) },
      repos: { getBranchProtection: async () => ({ data: null }) },
    },
    paginate: async () => [],
    graphql: async (query, variables) => {
      calls.push({ query, variables })
      if (!variables.ref) {
        return {
          repository: {
            pullRequest: {
              headRefOid: 'head',
              baseRefName: 'main',
              potentialMergeCommit: { oid: 'merge' },
              latestOpinionatedReviews: { nodes: [], pageInfo: { hasNextPage: false } },
            },
          },
        }
      }
      const page = variables.cursor ? 1 : 0
      const contexts = {
        nodes: variables.ref === 'head' ? pages[page] : [],
        pageInfo: { hasNextPage: variables.ref === 'head' && page === 0, endCursor: 'next' },
      }
      return { repository: { object: { statusCheckRollup: { contexts } } } }
    },
  }
  const loaded = await loadMergeStatus({
    github,
    repo: { owner: 'owner', repo: 'repo' },
    number: 1,
  })
  assert.equal(loaded.checks[0].length, 3)
  assert.deepEqual(loaded.checks[1], [])
  assert.deepEqual(
    calls.filter((call) => call.variables.ref === 'head').map((call) => call.variables.cursor),
    [undefined, 'next']
  )
  const query = calls.find((call) => call.variables.ref).query
  for (const field of ['databaseId', 'createdAt', 'app', 'workflowRun', 'workflow', 'event']) {
    assert.ok(query.includes(field), `missing selection metadata: ${field}`)
  }
  assert.match(query, /workflow \{ id name \}/)
  expectCI(loaded.checks, '✅ 已通过')
})
