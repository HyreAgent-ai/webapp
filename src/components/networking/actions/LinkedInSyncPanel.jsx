export default function LinkedInSyncPanel({ t }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 8, background: t.hover,
      border: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: t.tx, marginBottom: 2 }}>
          🔄 LinkedIn Sync
        </div>
        <div style={{ fontSize: 11.5, color: t.muted }}>
          Run the sync script to update statuses and add new contacts from your LinkedIn export.
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: t.sub, marginTop: 6,
          background: t.bg, padding: '4px 8px', borderRadius: 4, display: 'inline-block' }}>
          python linkedin_intelligence_v2.py --zip ~/Desktop/Basic_LinkedInDataExport_*.zip
        </div>
      </div>
    </div>
  );
}
