import { useEffect, useMemo, useRef, useState } from 'react';

export default function JustifiedMasonry({
  items,
  targetRowHeight = 180,
  itemSpacing = 10,
  rowSpacing = 10,
  className = '',
  style = {},
  getId = (item) => item.id,
  getAspectRatio = () => 1,
  renderItem,
}) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const rect = el.getBoundingClientRect?.();
      const width = rect?.width || 0;
      if (width) setContainerWidth(width);
    };

    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const obs = new ResizeObserver(() => updateWidth());
      obs.observe(el);
      return () => obs.disconnect();
    }

    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const layout = useMemo(() => {
    if (!items?.length || !containerWidth) return [];

    const result = [];
    let row = [];
    let rowWidthAtTarget = 0;
    let rowIndex = 0;

    const flushRow = (isLast = false) => {
      if (!row.length) return;
      const spacing = itemSpacing * (row.length - 1);
      let rowHeight = targetRowHeight;
      let rowWidth = row.reduce((sum, entry) => sum + (entry.aspectRatio * targetRowHeight), 0);

      if (!isLast && rowWidth > 0) {
        const availableWidth = Math.max(containerWidth - spacing, 0);
        const scale = availableWidth / rowWidth;
        if (scale < 1) {
          rowHeight = targetRowHeight * Math.max(scale, 0.5);
          rowWidth *= scale;
        }
      }

      row.forEach((entry) => {
        const widthPx = entry.aspectRatio * rowHeight;
        const widthPercent = (widthPx / containerWidth) * 100;
        result.push({ item: entry.item, rowIndex, widthPercent });
      });

      row = [];
      rowWidthAtTarget = 0;
      rowIndex += 1;
    };

    items.forEach((item, index) => {
      const aspectRatio = Math.max(0.1, Number(getAspectRatio(item)) || 1);
      const itemWidthAtTarget = aspectRatio * targetRowHeight;
      const spacing = itemSpacing * row.length;

      if (row.length > 0 && rowWidthAtTarget + itemWidthAtTarget + spacing > containerWidth) {
        flushRow(false);
      }

      row.push({ item, aspectRatio });
      rowWidthAtTarget += itemWidthAtTarget;

      if (index === items.length - 1) {
        flushRow(true);
      }
    });

    return result;
  }, [items, containerWidth, targetRowHeight, itemSpacing, getId, getAspectRatio]);

  const groupedRows = useMemo(() => {
    const map = new Map();
    for (const entry of layout) {
      const row = map.get(entry.rowIndex) || [];
      row.push(entry);
      map.set(entry.rowIndex, row);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, row]) => row);
  }, [layout]);

  return (
    <div ref={containerRef} className={className} style={{ width: '100%', ...style }}>
      {groupedRows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          style={{
            display: 'flex',
            columnGap: `${itemSpacing}px`,
            marginBottom: rowIdx === groupedRows.length - 1 ? 0 : `${rowSpacing}px`,
          }}
        >
          {row.map((entry) => (
            <div
              key={getId(entry.item)}
              style={{
                width: `${entry.widthPercent}%`,
                flex: '0 0 auto',
              }}
            >
              {renderItem(entry.item, { width: '100%' })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
