export default function Avatar({ name, size = 36, t }) {
  const initials = (name || '??').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
  const colors = ['#0284c7','#16a34a','#d97706','#7c3aed','#db2777','#0891b2'];
  const idx = name ? (name.charCodeAt(0) + name.charCodeAt(name.length - 1)) % colors.length : 0;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: colors[idx] + '22', border: `1.5px solid ${colors[idx]}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.33, fontWeight: 700, color: colors[idx], flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}
