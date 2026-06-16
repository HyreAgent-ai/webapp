const STATUS_COLORS = {
  'Sent':             { bg: '#f1f5f9', bd: '#cbd5e1', tx: '#64748b' },
  'Accepted':         { bg: '#fef3c7', bd: '#fcd34d', tx: '#d97706' },
  'Replied':          { bg: '#dcfce7', bd: '#86efac', tx: '#16a34a' },
  'Coffee Chat':      { bg: '#ede9fe', bd: '#c4b5fd', tx: '#7c3aed' },
  'Referral Secured': { bg: '#fce7f3', bd: '#f9a8d4', tx: '#db2777' },
  'Cold':             { bg: '#f0f4f8', bd: '#94a3b8', tx: '#475569' },
};

export { STATUS_COLORS };

export default function StatusBadge({ status }) {
  const sc = STATUS_COLORS[status] || STATUS_COLORS['Sent'];
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
      background: sc.bg, border: `1px solid ${sc.bd}`, color: sc.tx,
    }}>
      {status || 'Sent'}
    </span>
  );
}
