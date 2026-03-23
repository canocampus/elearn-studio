import type { PhaserSimConfig } from './types'
import { ScoreTracker } from './ScoreTracker'
import { ModeController } from './ModeController'

/**
 * PhaserSimWidget — lifecycle manager for a Phaser simulation.
 *
 * The runtime-player calls `mount()` when the slide is shown and `destroy()`
 * when the learner navigates away. Phaser is imported dynamically so the main
 * runtime-player bundle stays under 150 KB gzipped.
 *
 * Usage:
 *   const widget = new PhaserSimWidget()
 *   await widget.mount(containerEl, config)
 *   // later…
 *   widget.destroy()
 */
export class PhaserSimWidget {
  private game: import('phaser').Game | null = null
  private tracker: ScoreTracker | null = null
  private controller: ModeController | null = null

  /**
   * Mount a Phaser simulation into the given container element.
   *
   * @param container - Host DOM element; Phaser creates a canvas inside it.
   * @param config    - Simulation configuration (type, mode, scene definition).
   * @returns Promise that resolves when the game is initialised.
   */
  async mount(container: HTMLElement, config: PhaserSimConfig): Promise<void> {
    if (this.game) {
      this.destroy()
    }

    this.tracker = new ScoreTracker(config.widgetId, config.passingScore)
    this.controller = new ModeController(config.mode)

    // Dynamic import keeps Phaser out of the main player bundle.
    // The browser caches the module after the first load within the session.
    const Phaser = await import('phaser')

    const scene = await this.buildScene(Phaser, config)

    try {
      this.game = new Phaser.Game({
        parent: container,
        width: config.width ?? 800,
        height: config.height ?? 500,
        backgroundColor: '#1a1a2e',
        scene,
        physics: { default: 'arcade' },
        // Disable the Phaser banner in the console
        banner: false,
      })
    } catch (err) {
      console.error('[PhaserSimWidget] Phaser.Game constructor failed:', err)
      container.innerHTML = '<p style="color:red;padding:12px;">Simulation failed to initialize.</p>'
      return
    }

    // Forward the sim-complete event to SCORM via ScoreTracker.
    // Safety: tracker is guaranteed set above; game events fire after mount() completes.
    this.game.events.on('sim-complete', () => {
      this.tracker?.complete()
    })
  }

  /**
   * Destroy the Phaser game instance and release all resources.
   * Safe to call multiple times.
   */
  destroy(): void {
    if (this.game) {
      this.game.destroy(true)
      this.game = null
    }
    this.tracker = null
    this.controller = null
  }

  /**
   * Returns the ScoreTracker for this simulation.
   * Null before mount() or after destroy().
   *
   * @returns Active ScoreTracker, or null if not mounted.
   */
  getTracker(): ScoreTracker | null {
    return this.tracker
  }

  /**
   * Returns the ModeController for this simulation.
   * Null before mount() or after destroy().
   *
   * @returns Active ModeController, or null if not mounted.
   */
  getController(): ModeController | null {
    return this.controller
  }

  private async buildScene(
    Phaser: typeof import('phaser'),
    config: PhaserSimConfig,
  ): Promise<typeof Phaser.Scene> {
    const { sceneDef } = config

    switch (sceneDef.simType) {
      case 'process-flow': {
        const { ProcessFlowScene } = await import('./scenes/ProcessFlowScene')
        if (!this.tracker || !this.controller) throw new Error('PhaserSimWidget: tracker/controller not initialised')
        // Safety: scene instances satisfy Phaser.Scene at runtime; typed as unknown first
        // because TypeScript cannot verify structural compatibility without the full Phaser types.
        return new ProcessFlowScene(sceneDef, this.tracker, this.controller) as unknown as typeof Phaser.Scene
      }
      case 'interactive-diagram': {
        const { InteractiveDiagramScene } = await import('./scenes/InteractiveDiagramScene')
        if (!this.tracker || !this.controller) throw new Error('PhaserSimWidget: tracker/controller not initialised')
        // Safety: same structural cast as process-flow above.
        return new InteractiveDiagramScene(sceneDef, this.tracker, this.controller) as unknown as typeof Phaser.Scene
      }
      case 'gamified-quiz': {
        const { GamifiedQuizScene } = await import('./scenes/GamifiedQuizScene')
        if (!this.tracker || !this.controller) throw new Error('PhaserSimWidget: tracker/controller not initialised')
        // Safety: same structural cast as process-flow above.
        return new GamifiedQuizScene(sceneDef, this.tracker, this.controller) as unknown as typeof Phaser.Scene
      }
      // TODO: T033 — physics-demo scene builder
      // TODO: T034 — concept-animator scene builder
      default: {
        throw new Error(`Unknown simType: ${(sceneDef as { simType: string }).simType}`)
      }
    }
  }
}
