import Phaser from 'phaser'
import { i18n } from '@/i18n/I18nManager'
import { SCENE } from '@/utils/constants'
import type { BattlePlan } from '@/systems/TrainerBattle'
import type { ChallengeSceneData } from '@/scenes/ChallengeScene'
import { preloadUi, registerUi } from '@/ui/kit/assets'
import { PadInput } from '@/ui/kit/input'
import { TextBox } from '@/ui/kit/TextBox'
import { askChoice, askYesNo } from '@/ui/kit/Menu'
import { pickName } from '@/ui/kit/NameEntry'
import { battleIntro } from '@/ui/kit/fade'

export interface DialogSceneData {
  dialogKey?: string
  /** Kept for callers; the name tag comes from a "NAME : " prefix on the line itself */
  npcName?: string
  /** Set when this NPC is a trainer: the battle that follows the dialog */
  plan?: BattlePlan
  /** The trainer was already beaten: offer a rematch instead of fighting right away */
  defeated?: boolean
  /** Values for {placeholders} in the dialog lines (e.g. {chapter}) */
  dialogParams?: Record<string, string | number>
  /** Lines to show directly, instead of (or before) dialogKey's */
  lines?: string[]
  /** Ask a question after the last line: OUI/NON, or a list of answers */
  choices?: 'yesno' | string[]
  /** What B answers for a list of choices (default: null = no answer) */
  cancelChoice?: number | null
  /** B can't skip the question (a list of choices) */
  required?: boolean
  /** After the last line, the name entry (suggestions + letter grid) */
  askName?: { presets: string[]; title: string }
  /** The scene to resume afterwards (default GameScene) */
  returnScene?: string
}

/** Sent with 'dialog-closed' to the scene that opened the dialog */
export interface DialogResult {
  /** The answer's index (OUI = 0, NON = 1), null when cancelled, undefined without a question */
  choice?: number | null
  /** The dialog handed over to a battle or a lesson instead of resuming the scene */
  battle?: boolean
  /** The name entered (askName) */
  name?: string
}

/**
 * Text over the paused map, in the text box. Then, depending on the data: a battle
 * (trainer), a rematch question (beaten trainer), a question or the name entry
 * (scripts), or back to the map.
 */
export class DialogScene extends Phaser.Scene {
  private sceneData!: DialogSceneData
  private input2!: PadInput
  private box!: TextBox
  private closed = false

  constructor() {
    super({ key: SCENE.DIALOG })
  }

  preload(): void {
    preloadUi(this)
  }

  create(data: DialogSceneData): void {
    registerUi(this)
    this.sceneData = data
    this.closed = false
    this.input2 = new PadInput(this)
    this.box = new TextBox(this, this.input2)
    void this.run()
  }

  /** What test hooks read: the visible text */
  get dialogText(): { text: string } {
    return { text: String(this.box?.state().text ?? '') }
  }

  private lines(): string[] {
    const data = this.sceneData
    const fromKey = data.dialogKey ? i18n.getDialog(data.dialogKey, data.npcName, data.dialogParams).map(l => l.text) : []
    return [...(data.lines ?? []), ...fromKey]
  }

  private async run(): Promise<void> {
    const data = this.sceneData
    const lines = this.lines()
    const asks = !!data.choices || !!data.askName || (!!data.plan && !!data.defeated)
    if (lines.length) await this.box.say(lines, { holdLast: asks && !data.defeated })
    if (this.closed) return

    if (data.plan) {
      if (data.defeated) {
        await this.box.say([i18n.t('battle_rematch_prompt')], { holdLast: true })
        if (await askYesNo(this, this.input2)) await this.startBattle()
        else this.close({ choice: 1 })
      } else {
        await this.startBattle()
      }
      return
    }

    if (data.askName) {
      const name = await pickName(this, this.input2, data.askName)
      this.close({ name })
    } else if (data.choices === 'yesno') {
      const yes = await askYesNo(this, this.input2)
      this.close({ choice: yes ? 0 : 1 })
    } else if (data.choices) {
      const choice = await askChoice(this, this.input2, data.choices, { cancel: data.cancelChoice ?? null, noCancel: data.required })
      this.close({ choice })
    } else {
      this.close({})
    }
  }

  /** The battle transition (none for a lesson: nothing to fight), then the challenge scene */
  private async startBattle(): Promise<void> {
    const plan = this.sceneData.plan
    if (!plan || this.closed) return
    this.closed = true
    if (plan.gradedSteps > 0) {
      this.box.setVisible(false)
      await battleIntro(this)
    }
    const returnScene = this.sceneData.returnScene ?? SCENE.GAME
    this.scene.get(returnScene)?.events.emit('dialog-closed', { battle: true } satisfies DialogResult)
    const next: ChallengeSceneData = { plan, returnScene }
    this.scene.stop()
    this.scene.launch(SCENE.CHALLENGE, next)
  }

  private close(result: DialogResult): void {
    if (this.closed) return
    this.closed = true
    const returnScene = this.sceneData.returnScene ?? SCENE.GAME
    this.scene.get(returnScene)?.events.emit('dialog-closed', result)
    this.scene.stop()
    this.scene.resume(returnScene)
  }
}
