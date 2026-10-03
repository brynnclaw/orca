import { describe, expect, it } from 'vitest'
import { aiVaultSessionDeleteBlockedReason } from './ai-vault-session-deletability'

// translate() with no loaded catalog returns the English fallback, so these
// assertions pin the English copy as well as the gate order.
const onHost = (host: string): string =>
  `This session is on ${host}. Orca can only delete sessions on this device, so copy its log path and delete that log on ${host}.`
const SYNTHETIC = "This session can't be deleted from Orca."

const localGeminiSession = {
  agent: 'gemini' as const,
  executionHostId: 'local' as const,
  filePath: '/home/user/.gemini/sessions/log.jsonl'
}

describe('aiVaultSessionDeleteBlockedReason', () => {
  it('offers Delete for a deletable agent on a local, real path', () => {
    expect(aiVaultSessionDeleteBlockedReason(localGeminiSession)).toBeNull()
  })

  it('offers Delete for a directory-shaped agent (claude)', () => {
    expect(
      aiVaultSessionDeleteBlockedReason({
        agent: 'claude',
        executionHostId: 'local',
        filePath: '/home/user/.claude/projects/-proj/sess-1.jsonl'
      })
    ).toBeNull()
  })

  it('blocks ssh- and runtime-hosted sessions regardless of agent, naming the owning host', () => {
    for (const [executionHostId, host] of [
      ['ssh:dev-box', 'dev-box'],
      ['runtime:gpu-box', 'gpu-box']
    ] as const) {
      expect(aiVaultSessionDeleteBlockedReason({ ...localGeminiSession, executionHostId })).toBe(
        onHost(host)
      )
    }
  })

  it('names an SSH host whose target id was URI-encoded in the host id', () => {
    expect(
      aiVaultSessionDeleteBlockedReason({
        ...localGeminiSession,
        executionHostId: 'ssh:ubuntu%40build%20box'
      })
    ).toBe(onHost('ubuntu@build box'))
  })

  it('blocks a synthetic OpenCode SQLite row identity', () => {
    expect(
      aiVaultSessionDeleteBlockedReason({
        agent: 'opencode',
        executionHostId: 'local',
        filePath: '/home/user/.opencode/db.sqlite#sess_123'
      })
    ).toBe(SYNTHETIC)
  })

  it('names the agent without explaining why it is unsupported', () => {
    expect(
      aiVaultSessionDeleteBlockedReason({
        agent: 'opencode',
        executionHostId: 'local',
        filePath: '/home/user/.opencode/sessions/log.jsonl'
      })
    ).toBe("OpenCode sessions can't be deleted from Orca.")
  })

  it('gives a multi-cause agent (antigravity) the same single sentence', () => {
    expect(
      aiVaultSessionDeleteBlockedReason({
        agent: 'antigravity',
        executionHostId: 'local',
        filePath: '/home/user/.antigravity/brain/conv-1/.system_generated/logs/transcript.jsonl'
      })
    ).toBe("Antigravity sessions can't be deleted from Orca.")
  })

  it('prioritizes the host gate over the unsupported-agent reason', () => {
    expect(
      aiVaultSessionDeleteBlockedReason({
        agent: 'claude',
        executionHostId: 'ssh:dev-box',
        filePath: '/home/user/.claude/sessions/sess-dir/log.jsonl'
      })
    ).toBe(onHost('dev-box'))
  })
})
