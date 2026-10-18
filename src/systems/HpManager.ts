type Listener = () => void

/**
 * PV of the player's side in battles.
 * - Story maps: the lead's PV bar, in half-hits (max 8 = 4 hits), kept in the save
 *   between battles; a wrong answer costs a hit (2), half when the lead resists.
 * - Editor maps: hearts from the map (`startingHp`), one per wrong answer;
 *   none = infinite.
 */
export class HpManager {
  private _hp: number
  private _maxHp: number
  private _infinite: boolean
  /** Points a wrong answer costs (story: 2 half-hits; editor hearts: 1) */
  readonly damagePerHit: number
  /** Story PV (a bar) rather than editor hearts */
  readonly isBar: boolean
  private listeners: Listener[] = []

  constructor(startingHp?: number, opts?: { current?: number; damagePerHit?: number; bar?: boolean }) {
    this._infinite = !startingHp || startingHp <= 0
    this._maxHp = this._infinite ? 0 : startingHp!
    this._hp = this._infinite ? 0 : Math.min(this._maxHp, Math.max(0, opts?.current ?? this._maxHp))
    this.damagePerHit = opts?.damagePerHit ?? 1
    this.isBar = !!opts?.bar
  }

  get hp(): number { return this._hp }
  get maxHp(): number { return this._maxHp }
  get isInfinite(): boolean { return this._infinite }
  get isDead(): boolean { return !this._infinite && this._hp <= 0 }

  /** Returns true if damage was applied (false if infinite) */
  takeDamage(amount = this.damagePerHit): boolean {
    if (this._infinite) return false
    this._hp = Math.max(0, this._hp - amount)
    this.emit()
    return true
  }

  /** Returns true if healing was applied */
  heal(amount = 1): boolean {
    if (this._infinite) return false
    if (this._hp >= this._maxHp) return false
    this._hp = Math.min(this._maxHp, this._hp + amount)
    this.emit()
    return true
  }

  /** Back to full (Codémon Center, Mom, an aide, a story battle you may lose) */
  refill(): void {
    if (this._infinite || this._hp === this._maxHp) return
    this._hp = this._maxHp
    this.emit()
  }

  onChange(fn: Listener): void {
    this.listeners.push(fn)
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}
