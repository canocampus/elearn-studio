/**
 * Block Manager panel — T010.6
 * GrapesJS BlockManager appends to this div (via `appendTo: '#gjs-block-manager'`).
 * T012 will register actual blocks (text, image, button, question types…).
 */

export function BlockManagerPanel() {
  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>Widgets</div>
      {/* GrapesJS BlockManager renders inside this div */}
      <div id="gjs-block-manager" style={styles.container} />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
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
    // GrapesJS block manager styles use .gjs-blocks-c, .gjs-block etc.
    // Override defaults in index.css if needed
  },
}
