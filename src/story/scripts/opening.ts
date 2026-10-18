import type { Script } from '@/story/types'
import { STARTERS } from '../starters.ts'

/*
 * The opening, short and our own: the adventure starts in Prof Pi's lab at the foot
 * of the Tower of Code. Your name; your first line of Python (the course's first
 * lesson, which ends with "choose your Codémon" in code); the egg hatches into the
 * Codémon you chose; a friendly battle against Zap; the Codédex; off to the tower.
 *
 * Each stage is skipped once its flag is set, so a reload picks up where it stopped:
 * named → lesson_intro → got_starter → hatched → zap_battle → has_codedex → opening_done.
 */

const STARTER_NAMES: Record<(typeof STARTERS)[number], string> = { aqua: 'AQUACHU', pyro: 'PYROCHU', flora: 'FLORACHU' }

export const OPENING: Record<string, Script> = {
  opening: [
    { op: 'if', when: { none: ['named'] }, then: [
      { op: 'wait', ms: 250 },
      { op: 'emote', actor: 'profpi', kind: '!' },
      { op: 'say', key: 'pi_welcome' },
      { op: 'name', key: 'pi_name_ask' },
      { op: 'setFlag', flag: 'named' },
      { op: 'save' },
    ] },
    { op: 'if', when: { none: ['lesson_intro'] }, then: [
      { op: 'say', key: 'pi_lesson_intro' },
      { op: 'lesson', chapters: ['intro-python/hello-world'] },
      { op: 'setFlag', flag: 'lesson_intro' },
    ] },
    { op: 'if', when: { none: ['got_starter'] }, then: [
      {
        op: 'ask', key: 'pi_which_codemon', required: true,
        choices: STARTERS.map(id => STARTER_NAMES[id]),
        branches: STARTERS.map(id => [
          { op: 'chooseStarter', codemon: id },
          { op: 'setFlag', flag: 'got_starter' },
        ]),
      },
    ] },
    { op: 'if', when: { none: ['hatched'] }, then: [
      { op: 'say', key: 'pi_egg' },
      { op: 'hatch', codemon: '$starter' },
      { op: 'say', key: 'pi_hatched' },
      { op: 'picture', codemon: null },
      { op: 'setFlag', flag: 'hatched' },
      { op: 'save' },
    ] },
    { op: 'if', when: { none: ['zap_battle'] }, then: [
      { op: 'face', actor: 'zap', dir: { actor: 'player' } },
      { op: 'say', key: 'pi_test_battle' },
      {
        op: 'battle', trainer: 'profpi', name: 'PROF. PI', codemon: 'zap',
        chapter: 'variables-types/what_are_variables', questions: 3, blackout: false,
        win: [{ op: 'say', key: 'pi_battle_won' }],
        lose: [{ op: 'say', key: 'pi_battle_lost' }],
      },
      { op: 'heal' },
      { op: 'setFlag', flag: 'zap_battle' },
    ] },
    { op: 'face', actor: 'zap', dir: 'down' },
    { op: 'say', key: 'pi_codedex' },
    { op: 'setFlag', flag: 'has_codedex' },
    { op: 'say', key: ['got_codedex', 'pi_go_tower'] },
    { op: 'setFlag', flag: 'opening_done' },
    { op: 'save' },
  ],

  /** Prof Pi at his table, afterwards */
  pi_talk: [
    { op: 'say', key: 'pi_later' },
  ],

  /** The aide at the big machine: heals, and this becomes where you wake up */
  lab_heal: [
    { op: 'say', key: 'aide_heal' },
    { op: 'fade', to: 'black' },
    { op: 'heal', respawn: true },
    { op: 'fade', to: 'clear' },
    { op: 'say', key: 'aide_healed' },
  ],
}
