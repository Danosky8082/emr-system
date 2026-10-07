// src/components/Skeleton.jsx
//
// Reusable loading placeholders.
//
// Usage:
//   <Skeleton.Text width="60%" />
//   <Skeleton.Table rows={5} cols={4} />
//   <Skeleton.Card />
//   <Skeleton.StatCard />
//   <Skeleton.Rows count={3} height={40} />
//
import React from 'react';

const baseStyle = (width, height) => ({
  width,
  height,
  borderRadius: 6,
});

const Skeleton = ({ width = '100%', height = 16, style = {} }) => (
  <div className="skeleton" style={{ ...baseStyle(width, height), ...style }} />
);

Skeleton.Text = ({ width = '100%', style = {} }) => (
  <Skeleton width={width} height={14} style={style} />
);

Skeleton.Title = ({ width = '40%', style = {} }) => (
  <Skeleton width={width} height={24} style={style} />
);

Skeleton.Rows = ({ count = 3, height = 20, gap = 10, style = {} }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton
        key={i}
        width={i === count - 1 ? '60%' : '100%'}
        height={height}
      />
    ))}
  </div>
);

Skeleton.Card = ({ style = {} }) => (
  <div
    style={{
      background: 'white',
      borderRadius: 12,
      padding: 24,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      ...style,
    }}
  >
    <Skeleton.Title width="50%" style={{ marginBottom: 16 }} />
    <Skeleton.Rows count={3} height={14} />
  </div>
);

Skeleton.StatCard = () => (
  <div
    style={{
      background: 'white',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}
  >
    <Skeleton width={44} height={44} style={{ borderRadius: 12 }} />
    <div style={{ flex: 1 }}>
      <Skeleton width={70} height={22} style={{ marginBottom: 8 }} />
      <Skeleton width={110} height={12} />
    </div>
  </div>
);

Skeleton.TableRow = ({ cols = 4 }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} style={{ padding: '12px 16px' }}>
        <Skeleton width={i === 0 ? '60%' : '85%'} height={14} />
      </td>
    ))}
  </tr>
);

Skeleton.Table = ({ rows = 6, cols = 4 }) => (
  <div className="table-container">
    <table>
      <thead>
        <tr>
          {Array.from({ length: cols }).map((_, i) => (
            <th key={i}>
              <Skeleton width="60%" height={12} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton.TableRow key={i} cols={cols} />
        ))}
      </tbody>
    </table>
  </div>
);

export default Skeleton;