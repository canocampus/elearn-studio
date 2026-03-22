/**
 * Layer Manager panel — T010.7
 * GrapesJS LayerManager appends to this div (via `appendTo: '#gjs-layer-manager'`).
 * Shows z-order of all widgets on the current slide.
 */

export function LayerManagerPanel() {
  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>Layers</div>
      {/* GrapesJS LayerManager renders inside this div */}
      <div id="gjs-layer-manager" style={styles.container} />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flex: 1,
  },
  header: {
    padding: '8px 12px 6px',
    fontSize: 11,
    fontWeight: 600,
    color: '#6c7086',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: '1px solid #313244',
    flexShrink: 0,
  },
  container: {
    flex: 1,
    overflowY: 'auto',
  },
}
