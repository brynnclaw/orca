import { describe, expect, it } from 'vitest'
import {
  agentSessionOperationKey,
  evaluateAgentSessionOperation,
  type AgentSessionOperationRow
} from '../../../../shared/agent-session-operation-ledger'
import { agentSessionRefusalNotice } from '../../../../shared/agent-session-refusal-notice'
import { refuse } from '../../../../shared/agent-session-wire-refusals'
import { agentSessionRefusalFailure } from '../../../../shared/agent-session-write-failure'
import { agentSessionWriteFailureText } from './agent-session-write-notice-text'

const NOW = 1_800_000_000_000
const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function operationId(timestamp: number, suffix: string): string {
  return `${String(timestamp).padStart(13, '0')}-${suffix.repeat(32)}`
}

/** A full ledger (limit 2) and the refusal a third request meets, as it crosses the wire. */
function fullLedgerRefusal() {
  const rows = new Map<string, AgentSessionOperationRow>()
  const placed: AgentSessionOperationRow[] = []
  for (const [at, suffix] of [
    [NOW - 2 * HOUR, 'b'],
    [NOW - HOUR, 'c']
  ] as const) {
    const decision = evaluateAgentSessionOperation({
      rows,
      callerKey: 'client-1',
      operationId: operationId(at, suffix),
      fingerprint: 'fp',
      now: at,
      perClientLimit: 2
    })
    if (decision.decision !== 'admit') {
      throw new Error(`expected admit, got ${decision.decision}`)
    }
    rows.set(agentSessionOperationKey('client-1', decision.row.operationId), decision.row)
    placed.push(decision.row)
  }
  const refused = evaluateAgentSessionOperation({
    rows,
    callerKey: 'client-1',
    operationId: operationId(NOW, 'd'),
    fingerprint: 'fp',
    now: NOW,
    perClientLimit: 2
  })
  if (refused.decision !== 'refused' || refused.code !== 'agent_session_operation_capacity') {
    throw new Error(`expected a capacity refusal, got ${refused.decision}`)
  }
  const wire: unknown = JSON.parse(
    JSON.stringify(refuse(refused.code, refused.details, 'Operation was refused.'))
  )
  return { wire, oldest: placed[0], newest: placed[1] }
}

describe('the notice a full operation ledger gives', () => {
  it('says when Orca takes new requests again: when the oldest counted request ages out', () => {
    const { wire, oldest, newest } = fullLedgerRefusal()
    const returnsAt = clockTime(oldest.expiresAt)
    expect(returnsAt).not.toBe(clockTime(newest.expiresAt))
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: built by `refuse` above and only round-tripped through JSON, as the wire does.
    const refusal = wire as Parameters<typeof agentSessionRefusalNotice>[0]

    expect(agentSessionRefusalNotice(refusal, 'send')).toBe(
      `Orca has received too many requests in the last day. Your message was not sent. Orca can take new requests again at ${returnsAt}.`
    )
    expect(agentSessionWriteFailureText(agentSessionRefusalFailure(refusal), 'send')).toBe(
      agentSessionRefusalNotice(refusal, 'send')
    )
  })

  it('rounds up to the minute, so the time shown is never before capacity returns', () => {
    const minute = NOW + 25 * HOUR
    expect(
      agentSessionRefusalNotice(
        {
          code: 'agent_session_operation_capacity',
          message: 'capacity',
          details: { reason: 'operationCapacity', capacityReturnsAt: minute + 1 }
        },
        'send'
      )
    ).toContain(`again at ${clockTime(minute + MINUTE)}.`)
  })

  it('keeps the words it had when a refusal carries no time', () => {
    expect(
      agentSessionRefusalNotice(
        {
          code: 'agent_session_operation_capacity',
          message: 'capacity',
          details: { reason: 'operationCapacity' }
        },
        'answer'
      )
    ).toBe('Orca has received too many requests in the last day. Your answer was not sent.')
  })
})
