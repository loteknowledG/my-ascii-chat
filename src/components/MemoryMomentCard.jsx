export default function MemoryMomentCard({
  title,
  accent = '#78b8ff',
  children,
  onFullscreen,
  fullscreenLabel = 'Fullscreen',
  extraActions = null,
  draggable = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  dragged = false,
  snapped = false,
  className = '',
  style = {},
}) {
  const shellStyle = {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    minHeight: '168px',
    aspectRatio: '1 / 1',
    padding: '10px',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '18px',
    background: 'linear-gradient(180deg, rgba(11,11,11,0.985), rgba(6,6,6,0.985))',
    overflow: 'hidden',
    cursor: draggable ? 'grab' : 'default',
    transform: dragged
      ? 'translateY(-7px) scale(1.015)'
      : snapped
        ? 'translateY(1px) scale(0.99)'
        : 'none',
    boxShadow: dragged
      ? '0 18px 30px rgba(0,0,0,0.32), 0 0 0 1px rgba(155,255,155,0.12) inset'
      : snapped
        ? 'inset 0 0 0 1px rgba(255,255,255,0.10), 0 6px 14px rgba(0,0,0,0.18)'
        : '0 10px 24px rgba(0, 0, 0, 0.22)',
    transition: 'transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease',
    opacity: dragged ? 0.94 : 1,
    willChange: dragged ? 'transform' : 'auto',
    ...style,
  };

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={className}
      style={shellStyle}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <div style={{ color: accent, fontSize: '10px', letterSpacing: '0.08em' }}>{title}</div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {extraActions}
          {onFullscreen ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFullscreen();
              }}
              aria-label={fullscreenLabel}
              title="Fullscreen"
              style={{
                width: '22px',
                height: '22px',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#111',
                border: '1px solid #2a2a2a',
                color: '#78b8ff',
                cursor: 'pointer',
                borderRadius: '6px',
                flex: '0 0 auto'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
      <div style={{ color: '#bbb', fontSize: '9px', lineHeight: 1.45, overflowY: 'auto', flex: 1 }}>
        {children}
      </div>
    </div>
  );
}
