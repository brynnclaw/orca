import { isAiVaultDeletableAgent } from '../../../../shared/ai-vault-session-deletion'
import { getExecutionHostLabel } from '../../../../shared/execution-host'
import type { AiVaultSession } from '../../../../shared/ai-vault-types'
import { translate } from '@/i18n/i18n'
import { agentLabel } from './ai-vault-session-filters'
import {
  canUseLocalAiVaultSessionPathActions,
  isSyntheticAiVaultSessionPath
} from './ai-vault-session-path-actions'

/**
 * Why Delete is unavailable for this session, as the tooltip text to show — or
 * null when it is offered. Each message says which sessions are affected, never
 * why: a provider's storage layout is Orca's problem, not the reader's. A remote
 * session's message names its host and the way to delete it there (#23556): no
 * runtime can yet validate a delete target on the owning host, so routing the
 * delete there would skip main's path checks.
 *
 * NOT the security boundary — main re-validates the path on disk regardless.
 * The two sides agree on deletable-or-not but deliberately not on the order they
 * check, so an SSH session reads as "remote" rather than "unsupported agent".
 * What must hold is that renderer-deletable is a subset of main-deletable, and
 * it does: both consult the same shared agent set and host/synthetic predicates.
 */
export function aiVaultSessionDeleteBlockedReason(
  session: Pick<AiVaultSession, 'agent' | 'executionHostId' | 'filePath'>
): string | null {
  if (!canUseLocalAiVaultSessionPathActions(session.executionHostId)) {
    return translate(
      'auto.components.right.sidebar.AiVaultSessionRow.deleteReasonRemoteHost',
      'This session is on {{value0}}. Orca can only delete sessions on this device, so copy its log path and delete that log on {{value0}}.',
      { value0: getExecutionHostLabel(session.executionHostId) }
    )
  }
  if (isSyntheticAiVaultSessionPath(session.filePath)) {
    return translate(
      'auto.components.right.sidebar.AiVaultSessionRow.deleteReasonSyntheticPath',
      "This session can't be deleted from Orca."
    )
  }
  if (!isAiVaultDeletableAgent(session.agent)) {
    return translate(
      'auto.components.right.sidebar.AiVaultSessionRow.deleteReasonUnsupportedAgent',
      "{{value0}} sessions can't be deleted from Orca.",
      { value0: agentLabel(session.agent) }
    )
  }
  return null
}
