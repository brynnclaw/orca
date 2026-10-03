import type { OrchestrationDb } from '../../../../orchestration/db'
import {
  applyWaitForSetupOutcome,
  type WorkerEffect,
  type WorkerSetupReceipt
} from './worker-topology'

function residualWorkerEffects(effects: WorkerEffect[]): WorkerEffect[] {
  // 'reused_agent_terminal' is the retired verb agent-first creation used for its own agent
  // terminal; rows persisted before the rename still carry it.
  return effects.filter(
    (effect) => effect.action?.startsWith('created') || effect.action === 'reused_agent_terminal'
  )
}

type WorkerSetupStageArgs = {
  db: OrchestrationDb
  dispatchId: string
  worktreeId: string
  terminalHandle: string
  setup: WorkerSetupReceipt
  effects: WorkerEffect[]
}

export function persistWorkerReadinessStage(args: WorkerSetupStageArgs): void {
  args.db.recordWorkerStage({
    dispatchId: args.dispatchId,
    stage: 'terminal_readying',
    worktreeId: args.worktreeId,
    terminalHandle: args.terminalHandle,
    setupState: args.setup.state,
    effects: args.effects,
    residualResources: residualWorkerEffects(args.effects)
  })
}

export function persistGatedSetupSpawnFailure(args: WorkerSetupStageArgs): boolean {
  if (args.setup.startupPolicy !== 'wait-for-setup' || args.setup.state !== 'spawn_failed') {
    return false
  }
  args.db.recordWorkerStage({
    dispatchId: args.dispatchId,
    stage: 'setup_start',
    worktreeId: args.worktreeId,
    terminalHandle: args.terminalHandle,
    setupState: args.setup.state,
    effects: args.effects,
    residualResources: residualWorkerEffects(args.effects)
  })
  return true
}

export function persistWorkerSetupWaitOutcome(
  args: WorkerSetupStageArgs & { wait: { satisfied: boolean; status: string } }
): void {
  applyWaitForSetupOutcome(args.setup, args.effects, args.wait)
  if (args.setup.startupPolicy !== 'wait-for-setup') {
    return
  }
  args.db.recordWorkerStage({
    dispatchId: args.dispatchId,
    stage: args.setup.state === 'failed' ? 'setup_failed' : 'setup_settled',
    worktreeId: args.worktreeId,
    terminalHandle: args.terminalHandle,
    setupState: args.setup.state,
    effects: args.effects,
    residualResources: residualWorkerEffects(args.effects)
  })
}

/** Under wait-for-setup the agent cannot become ready before setup exits, so a readiness budget
 *  that runs out while setup is still running is the setup gate's timeout, not the agent's. */
export function setupStillRunningAtTimeout(
  setup: WorkerSetupReceipt,
  timedOut: boolean,
  timeoutMs: number
): Error | null {
  if (!timedOut || setup.startupPolicy !== 'wait-for-setup' || setup.state !== 'running') {
    return null
  }
  return new Error(
    `Setup was still running after ${timeoutMs} ms (startup policy wait-for-setup), so the agent could not start. Retry with a larger --timeout-ms.`
  )
}
