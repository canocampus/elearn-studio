/**
 * TD-010: Centralised "no panel matches" fallback for the Props tab.
 *
 * Per-widget PropertiesPanels (Question / PhaserSim / Button / MediaPlayer /
 * AudioNarration / ProgressBar / VolumeControl) each `return null` when their
 * widget type does not apply. `PropsEmptyState` renders ONE friendly message
 * when either no widget is selected, or the selected widget has no custom
 * panel (text, image, rectangle, score-* — styled via the Styles tab).
 *
 * Lives in a standalone module (not AppLayout.tsx) so unit tests can import
 * these two helpers without pulling in Konva / GrapesJS transitive deps via
 * AppLayout's SimulationEditor import.
 */

import { isQuestionWidgetType } from '../../types/questions'
import { isPhaserSimWidgetType } from '../../types/phaserSim'
import { isButtonWidgetType } from '../sidebar/ButtonPropertiesPanel'
import { isMediaPlayerWidgetType } from '../sidebar/MediaPlayerPropertiesPanel'
import { isAudioNarrationWidgetType } from '../sidebar/AudioNarrationPropertiesPanel'
import { isProgressBarWidgetType } from '../sidebar/ProgressBarPropertiesPanel'
import { isVolumeControlWidgetType } from '../sidebar/VolumeControlPropertiesPanel'

export function hasCustomPropsPanel(type: string | null): boolean {
  if (!type) return false
  return (
    isQuestionWidgetType(type) ||
    isPhaserSimWidgetType(type) ||
    isButtonWidgetType(type) ||
    isMediaPlayerWidgetType(type) ||
    isAudioNarrationWidgetType(type) ||
    isProgressBarWidgetType(type) ||
    isVolumeControlWidgetType(type)
  )
}

interface PropsEmptyStateProps {
  selectedType: string | null
}

export function PropsEmptyState({ selectedType }: PropsEmptyStateProps) {
  const message = selectedType
    ? 'This widget has no dedicated properties. Use the Styles tab to change its appearance.'
    : 'Select a widget on the canvas to edit its properties.'
  return (
    <div
      data-testid="props-empty-state"
      role="status"
      aria-live="polite"
      style={{
        padding: 16,
        color: '#6c7086',
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 1.6,
      }}
    >
      {message}
    </div>
  )
}
