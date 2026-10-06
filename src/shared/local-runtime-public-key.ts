// Why: the runtime server's E2EE public key is the stable identity of an Orca
// server. Reading it from userData lets every pairing entry point — desktop IPC,
// the CLI, and ephemeral-VM wiring — recognize an offer that points back at this
// same server without importing main-process modules.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readNodeFileSyncWithinLimit } from './node-bounded-file-reader'

export const E2EE_KEYPAIR_FILENAME = 'orca-e2ee-keypair.json'

export const MAX_KEYPAIR_FILE_BYTES = 8 * 1024

/**
 * Reads this host's runtime E2EE public key from `userDataPath`, or null when
 * no server has generated one yet or the file is unusable. Never creates the
 * keypair: callers only compare identities, and generating one here would race
 * the runtime server that owns it.
 */
export function readLocalRuntimePublicKeyB64(userDataPath: string): string | null {
  const filePath = join(userDataPath, E2EE_KEYPAIR_FILENAME)
  if (!existsSync(filePath)) {
    return null
  }
  try {
    const raw = readNodeFileSyncWithinLimit(filePath, MAX_KEYPAIR_FILE_BYTES).buffer.toString(
      'utf8'
    )
    const parsed: unknown = JSON.parse(raw)
    const publicKeyB64 = (parsed as { publicKeyB64?: unknown } | null)?.publicKeyB64
    return typeof publicKeyB64 === 'string' && publicKeyB64.length > 0 ? publicKeyB64 : null
  } catch {
    // Why: an unreadable keypair must not block pairing with genuinely remote servers.
    return null
  }
}
