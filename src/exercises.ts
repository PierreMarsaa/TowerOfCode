import Phaser from 'phaser'
import { getAllChallenges, getChapterOf } from '@/data/challenges'
import { createChallenge } from '@/challenges/ChallengeRegistry'
import type { IChallenge } from '@/challenges/IChallenge'
import { saveManager } from '@/systems/SaveManager'
import { i18n } from '@/i18n/I18nManager'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/game.config'
import { resolveText } from '@/utils/i18n-helpers'

// ── Populate exercise table ──

// Same language as the game (the save is shared with it)
i18n.setLanguage(saveManager.getData().language)

const challenges = getAllChallenges()
const tbody = document.getElementById('exercise-table')!

challenges.forEach((config, index) => {
  const tr = document.createElement('tr')

  const typeLabel = config.type
  const name = resolveText(config.title)

  tr.innerHTML = `
    <td class="id-cell">${escapeHtml(config.id)}</td>
    <td class="type-cell">${typeLabel}</td>
    <td class="chapter-cell">${escapeHtml(getChapterOf(config.id)?.key ?? '—')}</td>
    <td class="title-cell">${escapeHtml(name)}</td>
  `
  tr.addEventListener('click', () => openChallenge(index))
  tbody.appendChild(tr)
})

function escapeHtml(s: string): string {
  const el = document.createElement('span')
  el.textContent = s
  return el.innerHTML
}

// ── Challenge launcher ──

let game: Phaser.Game | null = null
let activeChallenge: IChallenge | null = null

const listView = document.getElementById('list-view')!
const challengeView = document.getElementById('challenge-view')!
const backBtn = document.getElementById('challenge-back')! as HTMLButtonElement

function openChallenge(index: number) {
  const config = challenges[index]
  if (!config) return

  listView.style.display = 'none'
  challengeView.style.display = 'block'
  backBtn.style.display = 'block'

  // Minimal Phaser game with just the challenge
  game = new Phaser.Game({
    type: Phaser.AUTO,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: '#111122',
    parent: 'challenge-view',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
      keyboard: { target: window },
    },
    scene: {
      key: 'ExerciseChallenge',
      create: function (this: Phaser.Scene) {
        const scene = this
        const cam = scene.cameras.main
        // Background
        scene.add.rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x111122)
          .setDepth(10)

        // Title
        scene.add.text(cam.centerX, 20, i18n.t('challenge_title'), {
          fontSize: '18px',
          color: '#ffdd44',
          fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(11)

        // Create challenge
        activeChallenge = createChallenge(config.type, config)
        activeChallenge.create(scene, config, (success) => {
          if (success) {
            saveManager.completeChallenge(config.id)
          }
          closeChallenge()
        })
      },
      update: function () {
        if (activeChallenge) activeChallenge.update()
      },
    },
  })
}

function closeChallenge() {
  // Destroy the challenge first: it owns a DOM overlay and a document key handler
  if (activeChallenge) {
    activeChallenge.destroy()
    activeChallenge = null
  }
  if (game) {
    game.destroy(true)
    game = null
  }
  challengeView.style.display = 'none'
  backBtn.style.display = 'none'
  listView.style.display = 'block'
}

backBtn.addEventListener('click', closeChallenge)

// ESC on the page level (when no Phaser game is running) goes back to list
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !game) {
    window.location.href = import.meta.env.BASE_URL
  }
})
