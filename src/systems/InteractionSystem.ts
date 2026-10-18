import type Phaser from 'phaser'
import type { NPC } from '@/entities/NPC'
import type { Player } from '@/entities/Player'
import type { SignData } from '@/data/types'
import type { GridMovementSystem } from '@/systems/GridMovementSystem'
import type { PadInput } from '@/ui/kit/input'

/** A: talk to the character you face, or read the sign in front of you */
export class InteractionSystem {
  private scene: Phaser.Scene
  private npcs: NPC[]
  private player: Player
  private gridMovement: GridMovementSystem
  private canInteract = true
  private signs: readonly SignData[]
  private pressed = false

  constructor(
    scene: Phaser.Scene,
    npcs: NPC[],
    gridMovement: GridMovementSystem,
    player: Player,
    input: PadInput,
    signs: readonly SignData[] = [],
  ) {
    this.scene = scene
    this.npcs = npcs
    this.player = player
    this.gridMovement = gridMovement
    this.signs = signs
    input.on(b => { if (b === 'a') this.pressed = true })
  }

  /** Acts on an A press seen since the last frame (the scene's update decides when it may) */
  update(): void {
    const pressed = this.pressed
    this.pressed = false
    if (pressed && this.canInteract) this.tryInteract()
  }

  setEnabled(enabled: boolean): void {
    this.canInteract = enabled
    this.pressed = false
  }

  private tryInteract(): void {
    if (this.gridMovement.moving || this.gridMovement.frozen) return

    const facingTile = this.gridMovement.getFacingTile()
    const npc = this.findNPCAt(facingTile.x, facingTile.y)

    if (npc) {
      const playerTile = this.gridMovement.getPlayerTile()
      npc.facePlayer(playerTile.x, playerTile.y)
      this.player.faceToward(npc.data.tileX, npc.data.tileY)
      this.scene.events.emit('npc-interact', npc)
      return
    }
    const sign = this.signs.find(s => s.tileX === facingTile.x && s.tileY === facingTile.y)
    if (sign) this.scene.events.emit('sign-read', sign)
  }

  private findNPCAt(tileX: number, tileY: number): NPC | null {
    return this.npcs.find(
      npc => npc.data.tileX === tileX && npc.data.tileY === tileY && npc.sprite.visible
    ) ?? null
  }
}
