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

    // Forward the sim-complete event to SCORM via ScoreTracker
    this.game.events.on('sim-complete', () => {
      this.tracker?.complete()
    })
  }

  destroy(): void {
    if (this.game) {
      this.game.destroy(true)
      this.game = null
    }
    this.tracker = null
    this.controller = null
  }

  /** Exposed for testing and authoring preview. */
  getTracker(): ScoreTracker | null {
    return this.tracker
  }

  /** Exposed for testing and scene use. */
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
        return new ProcessFlowScene(sceneDef, this.tracker, this.controller) as unknown as typeof Phaser.Scene
      }
      case 'interactive-diagram': {
        const { InteractiveDiagramScene } = await import('./scenes/InteractiveDiagramScene')
        if (!this.tracker || !this.controller) throw new Error('PhaserSimWidget: tracker/controller not initialised')
        return new InteractiveDiagramScene(sceneDef, this.tracker, this.controller) as unknown as typeof Phaser.Scene
      }
      case 'gamified-quiz': {
        const { GamifiedQuizScene } = await import('./scenes/GamifiedQuizScene')
        if (!this.tracker || !this.controller) throw new Error('PhaserSimWidget: tracker/controller not initialised')
        return new GamifiedQuizScene(sceneDef, this.tracker, this.controller) as unknown as typeof Phaser.Scene
      }
      default: {
        throw new Error(`Unknown simType: ${(sceneDef as { simType: string }).simType}`)
      }
    }
  }
}
