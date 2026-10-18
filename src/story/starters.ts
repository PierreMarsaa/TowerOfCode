/** The three Codémon that can hatch in Prof Pi's lab */
export const STARTERS = ['aqua', 'pyro', 'flora'] as const
export type StarterId = (typeof STARTERS)[number]

export function isStarter(id: string | null | undefined): id is StarterId {
  return !!id && (STARTERS as readonly string[]).includes(id)
}
