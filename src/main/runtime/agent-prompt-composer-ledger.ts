import type { AgentPromptOwnPaste } from './agent-prompt-composer-residue'

// Why: right after Orca's own Enter the emulator can still paint the prompt it just submitted.
const AGENT_PROMPT_COMPOSER_SETTLE_MS = 1_000
// Why: a turn start proves the agent took the prompt, so its text still on screen is a late repaint;
// long after that, the same text is someone's recalled draft again.
const AGENT_PROMPT_LANDED_REPAINT_MS = 10_000

/** Per pane: Orca's own last prompt paste and Enter, the evidence a composer verdict rests on. */
export class AgentPromptComposerLedger {
  private readonly submittedAtByPtyId = new Map<string, { generation: number; at: number }>()
  private readonly lastPasteByPtyId = new Map<
    string,
    { generation: number; payload: string; landedAt: number | null }
  >()

  markSubmitted(ptyId: string, generation: number): void {
    const now = Date.now()
    // Why prune here: only Enters inside the settle window matter, so the map stays tiny.
    for (const [id, submitted] of this.submittedAtByPtyId) {
      if (now - submitted.at >= AGENT_PROMPT_COMPOSER_SETTLE_MS) {
        this.submittedAtByPtyId.delete(id)
      }
    }
    this.submittedAtByPtyId.set(ptyId, { generation, at: now })
  }

  /** How long a composer read must still wait for Orca's own Enter to clear the screen. */
  settleMsLeft(ptyId: string, generation: number): number {
    const submitted = this.submittedAtByPtyId.get(ptyId)
    if (submitted?.generation !== generation) {
      return 0
    }
    return Math.max(0, submitted.at + AGENT_PROMPT_COMPOSER_SETTLE_MS - Date.now())
  }

  rememberPaste(
    ptyId: string,
    generation: number,
    payload: string,
    isLivePty: (ptyId: string) => boolean
  ): void {
    // Why prune here: only live panes can be judged again, so the map stays one entry per pane.
    for (const id of this.lastPasteByPtyId.keys()) {
      if (!isLivePty(id)) {
        this.lastPasteByPtyId.delete(id)
      }
    }
    this.lastPasteByPtyId.set(ptyId, { generation, payload, landedAt: null })
  }

  markLanded(ptyId: string, generation: number, payload: string): void {
    const paste = this.lastPasteByPtyId.get(ptyId)
    if (paste?.generation === generation && paste.payload === payload) {
      paste.landedAt = Date.now()
    }
  }

  getOwnPaste(ptyId: string, generation: number): AgentPromptOwnPaste | null {
    const paste = this.lastPasteByPtyId.get(ptyId)
    if (paste?.generation !== generation) {
      return null
    }
    if (paste.landedAt === null) {
      return { payload: paste.payload, landed: false }
    }
    return Date.now() - paste.landedAt < AGENT_PROMPT_LANDED_REPAINT_MS
      ? { payload: paste.payload, landed: true }
      : null
  }
}
