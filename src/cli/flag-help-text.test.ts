import { describe, expect, it } from 'vitest'

import { GLOBAL_FLAGS } from './args'
import { formatCommandHelp } from './help'
import { COMMAND_SPECS } from './specs'

// Flags from #19016 that `--help` listed as a bare name with no description.
const DESCRIBED_FLAGS = ['environment', 'pairing-code', 'wait-submit', 'retry-request']

function spec(path: string): (typeof COMMAND_SPECS)[number] {
  const found = COMMAND_SPECS.find((entry) => entry.path.join(' ') === path)
  if (!found) {
    throw new Error(`Missing command spec: ${path}`)
  }
  return found
}

function optionRow(help: string, flag: string): string {
  const row = help.split('\n').find((line) => new RegExp(`^  --${flag}(\\s|$)`).test(line))
  if (!row) {
    throw new Error(`No Options row for --${flag}`)
  }
  return row
}

function optionDescription(help: string, flag: string): string {
  const match = optionRow(help, flag).match(new RegExp(`^  --${flag}(?: <[^>]+>)?\\s+(\\S.*)$`))
  return match?.[1] ?? ''
}

describe('flag help text', () => {
  it('describes every global flag', () => {
    const help = formatCommandHelp(spec('terminal list'))
    for (const flag of GLOBAL_FLAGS) {
      expect(optionDescription(help, flag), `--${flag}`).not.toBe('')
    }
  })

  it('describes --environment, --pairing-code, --wait-submit and --retry-request on terminal send', () => {
    const help = formatCommandHelp(spec('terminal send'))
    for (const flag of DESCRIBED_FLAGS) {
      expect(optionDescription(help, flag), `--${flag}`).not.toBe('')
    }
  })

  it('describes those flags on every command that accepts them', () => {
    // Why: passthrough commands forward argv untouched and render no Options block.
    for (const entry of COMMAND_SPECS.filter((item) => item.argumentMode !== 'passthrough')) {
      const help = formatCommandHelp(entry)
      for (const flag of DESCRIBED_FLAGS.filter((name) => entry.allowedFlags.includes(name))) {
        expect(optionDescription(help, flag), `${entry.path.join(' ')} --${flag}`).not.toBe('')
      }
    }
  })

  // Why: a row that states the opposite of the handler would pass the "has a description" checks.
  it('states the behaviour each new description rests on', () => {
    const help = formatCommandHelp(spec('terminal send'))
    expect(optionDescription(help, 'environment')).toMatch(/saved environment id or name/)
    expect(optionDescription(help, 'pairing-code')).toMatch(/orca:\/\/pair\?/)
    expect(optionDescription(help, 'wait-submit')).toMatch(/without resending/)
    expect(optionDescription(help, 'wait-submit')).toMatch(/max 3600/)
    expect(optionDescription(help, 'wait-submit')).toMatch(/no --interrupt/)
    expect(optionDescription(help, 'retry-request')).toMatch(/idempotent/)
  })

  it('shows the value placeholder the usage lines use', () => {
    const help = formatCommandHelp(spec('terminal send'))
    expect(optionRow(help, 'environment')).toMatch(/^ {2}--environment <selector> /)
    expect(optionRow(help, 'pairing-code')).toMatch(/^ {2}--pairing-code <code> /)
    expect(optionRow(help, 'wait-submit')).toMatch(/^ {2}--wait-submit <seconds> /)
    expect(optionRow(help, 'retry-request')).toMatch(/^ {2}--retry-request <id> /)
  })

  // Why: on these commands the flag names the saved environment to act on, not a runtime to route to.
  it('gives environment add, show and rm their own meaning for the selection flags', () => {
    expect(optionDescription(formatCommandHelp(spec('environment add')), 'pairing-code')).toMatch(
      /to save/
    )
    expect(optionDescription(formatCommandHelp(spec('environment show')), 'environment')).toMatch(
      /to show/
    )
    expect(optionDescription(formatCommandHelp(spec('environment rm')), 'environment')).toMatch(
      /to remove/
    )
  })

  // Why: these commands never route, so the global "Connect ..." wording would be false here.
  it('says the unused selection flag is not used on environment add, show and rm', () => {
    expect(optionDescription(formatCommandHelp(spec('environment add')), 'environment')).toMatch(
      /^Not used/
    )
    for (const path of ['environment show', 'environment rm']) {
      expect(optionDescription(formatCommandHelp(spec(path)), 'pairing-code')).toMatch(/^Not used/)
    }
  })

  // Why: these handlers throw on either selection flag, as their Notes say.
  it('says environment list and host list reject the selection flags', () => {
    for (const path of ['environment list', 'host list']) {
      const help = formatCommandHelp(spec(path))
      for (const flag of ['environment', 'pairing-code']) {
        expect(optionDescription(help, flag), `${path} --${flag}`).toMatch(/^Rejected/)
      }
    }
  })
})
