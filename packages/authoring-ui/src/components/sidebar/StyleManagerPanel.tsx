/**
 * Style Manager panel — T010.8
 * GrapesJS StyleManager appends to this div (via `appendTo: '#gjs-style-manager'`).
 * Shows position, size, typography, background, border properties for selected widget.
 */

export function StyleManagerPanel() {
  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>Properties</div>
      {/* GrapesJS StyleManager renders inside this div */}
      <div id="gjs-style-manager" style={styles.container} />
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
