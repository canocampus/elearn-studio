/**
 * Phaser Simulation Widget — T035
 *
 * Dynamically imports the Phaser bundle (kept out of the main player bundle)
 * and mounts a Phaser.Game inside the provided container element.
 *
 * The Phaser sim dispatches `elearn:widgetScore` on the window when it
 * completes; the main player listens and forwards scores to SCORM.
 *
 * Bundle size constraint: dynamic import keeps the main player.js under 150KB.
 */

export interface PhaserSimConfig {
  widgetId: string
  simType: string
  mode: string
  passingScore: number
  sceneDef: Record<string, unknown> | null
  width: number
  height: number
}

/** Minimal Phaser.Game shape we need at this call-site. */
interface PhaserGame {
  destroy(removeCanvas: boolean): void
  events: {
    on(event: string, fn: (data: unknown) => void): void
  }
}

/** Minimal Phaser namespace shape from the dynamic bundle. */
interface PhaserModule {
  Game: new (config: Record<string, unknown>) => PhaserGame
  AUTO: number
}

/**
 * Mount a Phaser game into `container`.
 *
 * @returns Cleanup function that destroys the game instance.
 */
export async function mountPhaserSim(
  container: HTMLElement,
  config: PhaserSimConfig,
): Promise<() => void> {
  let Phaser: PhaserModule

  try {
    // Dynamic import keeps the Phaser bundle (~1 MB) out of the main player.js.
    // The SCORM packager copies phaser-bundle.js alongside player.js only when
    // the course contains at least one phaser-sim widget (see scorm-packager T035).
    // Using a variable to prevent TypeScript static analysis from complaining about
    // the missing module (the file only exists in the deployed SCORM package).
    const bundlePath = './phaser-bundle.js'
    Phaser = (await import(/* @vite-ignore */ bundlePath)) as PhaserModule
  } catch (err) {
    console.error('[PhaserSimWidget] Failed to load phaser-bundle.js:', err)
    container.innerHTML =
      '<p style="color:red;padding:12px;">Phaser bundle not available.</p>'
    return () => { /* nothing to clean up */ }
  }

  const sceneConfig = buildSceneConfig(config)

  let game: PhaserGame
  try {
    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: config.width,
      height: config.height,
      backgroundColor: '#1a1a2e',
      scene: sceneConfig,
      scale: { mode: 0 /* NONE */ },
    })
  } catch (err) {
    console.error('[PhaserSimWidget] Phaser.Game constructor failed:', err)
    container.innerHTML = '<p style="color:red;padding:12px;">Simulation failed to initialize.</p>'
    return () => { /* nothing to clean up */ }
  }

  // Bridge: Phaser sim fires 'sim-complete' with a 0-100 score value.
  // Dispatch as a DOM CustomEvent so the player's SCORM bridge can catch it.
  game.events.on('sim-complete', (score: unknown) => {
    const numScore = typeof score === 'number' ? score : 0
    window.dispatchEvent(new CustomEvent('elearn:widgetScore', {
      detail: { widgetId: config.widgetId, score: numScore / 100 }, // normalise to [0,1]
    }))
  })

  return () => {
    game.destroy(true)
  }
}

// ─── Placeholder scene (used until real sceneDef-driven scenes are authored) ──

/**
 * Build a Phaser scene config from the widget's sceneDef.
 * Falls back to a minimal placeholder scene when no sceneDef is provided.
 */
function buildSceneConfig(config: PhaserSimConfig): Record<string, unknown> {
  if (!config.sceneDef) {
    return makePlaceholderScene(config)
  }
  // TODO: T036 — delegate to per-simType scene builders (ProcessFlowScene, InteractiveDiagramScene, …)
  // All sceneDef-driven sims use the placeholder scene until T036 scene builders are implemented.
  return makePlaceholderScene(config)
}

function makePlaceholderScene(config: PhaserSimConfig): Record<string, unknown> {
  const label = `${config.simType} — ${config.mode}`
  return {
    preload() { /* no assets */ },
    create(this: { add: { text: (x: number, y: number, s: string, style: Record<string, unknown>) => unknown }; events: { emit: (e: string, v: unknown) => void }; time: { delayedCall: (d: number, fn: () => void) => void } }) {
      this.add.text(config.width / 2, config.height / 2, label, {
        fontSize: '18px',
        color: '#cdd6f4',
        align: 'center',
        wordWrap: { width: config.width - 40 },
      })

      // Auto-complete after 2 seconds in demo mode so courses can progress.
      if (config.mode === 'demo') {
        this.time.delayedCall(2000, () => {
          this.events.emit('sim-complete', 100)
        })
      }
    },
  }
}
