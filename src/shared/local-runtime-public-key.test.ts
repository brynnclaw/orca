import { existsSync, mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  E2EE_KEYPAIR_FILENAME,
  MAX_KEYPAIR_FILE_BYTES,
  readLocalRuntimePublicKeyB64
} from './local-runtime-public-key'

describe('readLocalRuntimePublicKeyB64', () => {
  const tempDirs: string[] = []

  function makeUserDataPath(): string {
    const userDataPath = mkdtempSync(join(tmpdir(), 'orca-local-key-'))
    tempDirs.push(userDataPath)
    return userDataPath
  }

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reads the public key the runtime server stores in userData', () => {
    const userDataPath = makeUserDataPath()
    writeFileSync(
      join(userDataPath, E2EE_KEYPAIR_FILENAME),
      JSON.stringify({ v: 1, publicKeyB64: 'public-key', secretKeyB64: 'secret-key' })
    )

    expect(E2EE_KEYPAIR_FILENAME).toBe('orca-e2ee-keypair.json')
    expect(readLocalRuntimePublicKeyB64(userDataPath)).toBe('public-key')
  })

  it('returns null without creating a keypair when none exists yet', () => {
    const userDataPath = makeUserDataPath()

    expect(readLocalRuntimePublicKeyB64(userDataPath)).toBeNull()
    expect(existsSync(join(userDataPath, E2EE_KEYPAIR_FILENAME))).toBe(false)
  })

  it.each([
    ['malformed JSON', 'not json'],
    ['a missing public key', JSON.stringify({ v: 1, secretKeyB64: 'secret-key' })],
    ['a non-string public key', JSON.stringify({ v: 1, publicKeyB64: 7 })],
    ['a JSON null', 'null']
  ])('returns null for %s instead of throwing', (_label, contents) => {
    const userDataPath = makeUserDataPath()
    writeFileSync(join(userDataPath, E2EE_KEYPAIR_FILENAME), contents)

    expect(readLocalRuntimePublicKeyB64(userDataPath)).toBeNull()
  })

  it('returns null for an oversized sparse keypair without reading it whole', () => {
    const userDataPath = makeUserDataPath()
    const path = join(userDataPath, E2EE_KEYPAIR_FILENAME)
    writeFileSync(path, JSON.stringify({ v: 1, publicKeyB64: 'public-key' }))
    truncateSync(path, MAX_KEYPAIR_FILE_BYTES + 1)

    expect(readLocalRuntimePublicKeyB64(userDataPath)).toBeNull()
  })
})
