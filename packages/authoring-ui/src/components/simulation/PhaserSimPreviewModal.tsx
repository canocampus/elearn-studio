/**
 * Phaser Simulation Preview Modal (T034).
 *
 * Displays a full-screen overlay when a phaser-sim widget is double-clicked
 * from the canvas or the Preview button is pressed in PhaserSimPropertiesPanel.
 *
 * The modal shows:
 *   - Sim config summary (type, mode, passing score, dimensions)
 *   - SceneDef JSON viewer
 *   - A Phaser runtime placeholder (actual Phaser init happens in runtime-player — T035)
 */

import { usePhaserSimStore } from '../../store/phaserSimStore'
import type { PhaserSimExtendedProps } from '../../types/phaserSim'
import { PHASER_SIM_TYPES } from '../../types/phaserSim'

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  color: '#94a3b8',
  marginBottom: 2,
  display: 'block',
}

const VALUE_STYLE: React.CSSProperties = {
  fontSize: 13,
  color: '#cdd6f4',
  fontWeight: 500,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function simTypeLabel(id: PhaserSimExtendedProps['simType']): string {
  return PHASER_SIM_TYPES.find(t => t.id === id)?.label ?? id
}

function modeLabel(mode: PhaserSimExtendedProps['mode']): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1)
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PhaserSimPreviewModal() {
  const previewOpen = usePhaserSimStore(s => s.previewOpen)
  const config = usePhaserSimStore(s => s.config)
  const closePreview = usePhaserSimStore(s => s.closePreview)

  if (!previewOpen || !config) return null

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>): void {
    if (e.target === e.currentTarget) closePreview()
  }

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#1e1e2e',
          border: '1px solid #313244',
          borderRadius: 8,
          width: Math.min(config.width ?? 800, window.innerWidth - 64),
          maxHeight: window.innerHeight - 64,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #313244',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#cdd6f4' }}>
            Phaser Simulation Preview
          </div>
          <button
            onClick={closePreview}
            aria-label="Close preview"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6c7086',
              fontSize: 18,
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0 4px',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left: Phaser canvas placeholder */}
          <div
            style={{
              flex: 1,
              background: '#0d0d1a',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              minHeight: Math.min(config.height ?? 500, window.innerHeight - 160),
              color: '#a6e3a1',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="#a6e3a1" strokeWidth="1.5">
              <rect x="2" y="6" width="20" height="12" rx="3"/>
              <circle cx="8" cy="12" r="2"/>
              <line x1="14" y1="10" x2="14" y2="14"/>
              <line x1="12" y1="12" x2="16" y2="12"/>
            </svg>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {simTypeLabel(config.simType)}
            </div>
            <div style={{ fontSize: 12, color: '#6c7086', textAlign: 'center', maxWidth: 320, lineHeight: 1.5 }}>
              Phaser runtime preview is available in the published player (T035).
              Configure the scene definition in the Properties panel.
            </div>
          </div>

          {/* Right: Config summary */}
          <div style={{
            width: 220,
            background: '#181825',
            borderLeft: '1px solid #313244',
            padding: 16,
            overflowY: 'auto',
            flexShrink: 0,
          }}>
            <ConfigRow label="Sim Type" value={simTypeLabel(config.simType)} />
            <ConfigRow label="Mode" value={modeLabel(config.mode)} />
            <ConfigRow label="Passing Score" value={`${config.passingScore}%`} />
            <ConfigRow label="Canvas" value={`${config.width ?? 800} × ${config.height ?? 500}`} />

            {config.sceneDef && (
              <div style={{ marginTop: 16 }}>
                <div style={{ ...LABEL_STYLE, marginBottom: 6 }}>Scene Definition</div>
                <pre style={{
                  margin: 0,
                  background: '#313244',
                  border: '1px solid #45475a',
                  borderRadius: 4,
                  padding: 8,
                  fontSize: 10,
                  color: '#cdd6f4',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: 300,
                  overflowY: 'auto',
                }}>
                  {JSON.stringify(config.sceneDef, null, 2)}
                </pre>
              </div>
            )}

            {!config.sceneDef && (
              <div style={{ marginTop: 16, fontSize: 11, color: '#6c7086' }}>
                No scene definition set. Add JSON in the Properties panel.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

interface ConfigRowProps {
  label: string
  value: string
}

function ConfigRow({ label, value }: ConfigRowProps) {
  return (
    <div style={{ marginBottom: 12 }}>
      <span style={LABEL_STYLE}>{label}</span>
      <span style={VALUE_STYLE}>{value}</span>
    </div>
  )
}
