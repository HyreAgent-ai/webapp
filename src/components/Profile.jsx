import { useState, useEffect } from 'react';
import { Save, Plus, X } from 'lucide-react';
import {
  fetchUserProfile,
  upsertUserProfile,
  fetchRoleTargets,
  upsertRoleTarget,
  deleteRoleTarget,
} from '../lib/storage';

export default function Profile({ t }) {
  const [profile, setProfile]         = useState({});
  const [roleTargets, setRoleTargets] = useState([]);
  const [saving, setSaving]           = useState('');
  const [loading, setLoading]         = useState(true);
  const [newRole, setNewRole]         = useState({ title: '', cluster: 'manufacturing', priority: 1 });
  const [expBullets, setExpBullets]   = useState([]);
  const [toolInput, setToolInput]     = useState('');

  useEffect(() => {
    Promise.all([fetchUserProfile(), fetchRoleTargets()]).then(([prof, roles]) => {
      if (prof) {
        setProfile(prof);
        setToolInput(Array.isArray(prof.tool_list) ? prof.tool_list.join(', ') : '');
        setExpBullets(Array.isArray(prof.experience_bullets) ? prof.experience_bullets : []);
      }
      setRoleTargets(roles || []);
      setLoading(false);
    });
  }, []);

  async function saveProfile() {
    setSaving('Saving...');
    try {
      await upsertUserProfile({
        full_name:            profile.full_name || '',
        degree:               profile.degree || '',
        graduation_year:      profile.graduation_year ? parseInt(profile.graduation_year) : null,
        visa_status:          profile.visa_status || '',
        visa_years_remaining: profile.visa_years_remaining ? parseInt(profile.visa_years_remaining) : null,
        domain_family:        profile.domain_family || '',
        linkedin_url:         profile.linkedin_url || null,
        experience_bullets:   expBullets,
        tool_list:            toolInput.split(',').map(s => s.trim()).filter(Boolean),
      });
      setSaving('Saved!');
      setTimeout(() => setSaving(''), 2500);
    } catch (err) {
      setSaving('Error: ' + (err.message || 'Unknown error'));
    }
  }

  async function addRoleTarget() {
    if (!newRole.title.trim()) return;
    const saved = await upsertRoleTarget({ title: newRole.title.trim(), cluster: newRole.cluster, priority: newRole.priority });
    if (saved) {
      setRoleTargets(prev => [...prev, saved]);
    } else {
      // refetch to stay in sync
      const roles = await fetchRoleTargets();
      setRoleTargets(roles || []);
    }
    setNewRole({ title: '', cluster: 'manufacturing', priority: 1 });
  }

  async function removeRoleTarget(id) {
    await deleteRoleTarget(id);
    setRoleTargets(prev => prev.filter(r => r.id !== id));
  }

  function addExpBullet() {
    setExpBullets(prev => [...prev, { id: Date.now(), company: '', role: '', metric: '', tools: '' }]);
  }

  function updateExpBullet(id, field, value) {
    setExpBullets(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  }

  function removeExpBullet(id) {
    setExpBullets(prev => prev.filter(b => b.id !== id));
  }

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    background: t.bg,
    border: `1px solid ${t.border}`,
    borderRadius: 6,
    color: t.tx,
    fontSize: 14,
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 13,
    color: t.sub,
    marginBottom: 4,
    fontWeight: 500,
  };

  const cardStyle = {
    background: t.card,
    border: `1px solid ${t.border}`,
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    boxShadow: t.shadow,
  };

  const sectionTitleStyle = {
    fontSize: 16,
    fontWeight: 700,
    color: t.tx,
    marginBottom: 4,
  };

  const sectionSubStyle = {
    fontSize: 13,
    color: t.muted,
    marginBottom: 16,
  };

  const btnPrimary = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    background: t.pri,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  };

  const btnGhost = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 10px',
    background: 'transparent',
    color: t.muted,
    border: `1px solid ${t.border}`,
    borderRadius: 6,
    fontSize: 13,
    cursor: 'pointer',
  };

  const clusterOptions = [
    'manufacturing',
    'process',
    'quality',
    'composites',
    'materials',
    'industrial',
    'industrial_operations',
    'mechanical_thermal',
    'tooling_inspection',
    'startup_manufacturing',
  ];

  if (loading) {
    return (
      <div style={{ color: t.muted, padding: 40, textAlign: 'center' }}>Loading profile...</div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: t.tx, margin: 0 }}>Profile</h2>
          <p style={{ fontSize: 14, color: t.muted, margin: '4px 0 0' }}>
            Your identity layer — used in onboarding, feed filtering, and resume pre-fill.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {saving && (
            <span style={{
              fontSize: 13,
              color: saving.startsWith('Error') ? t.red : saving === 'Saved!' ? t.green : t.muted,
            }}>
              {saving}
            </span>
          )}
          <button style={btnPrimary} onClick={saveProfile}>
            <Save size={14} />
            Save Profile
          </button>
        </div>
      </div>

      {/* Section 1: Basic Information */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Basic Information</div>
        <div style={sectionSubStyle}></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>

          <div>
            <label style={labelStyle}>Full Name</label>
            <input
              type="text"
              style={inputStyle}
              value={profile.full_name || ''}
              onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
            />
          </div>

          <div>
            <label style={labelStyle}>LinkedIn URL</label>
            <input
              type="text"
              style={inputStyle}
              placeholder="https://linkedin.com/in/..."
              value={profile.linkedin_url || ''}
              onChange={e => setProfile(p => ({ ...p, linkedin_url: e.target.value }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Highest Degree</label>
            <select
              style={inputStyle}
              value={profile.degree || ''}
              onChange={e => setProfile(p => ({ ...p, degree: e.target.value }))}
            >
              <option value="">— Select —</option>
              <option value="B.S.">B.S.</option>
              <option value="B.E.">B.E.</option>
              <option value="M.S.">M.S.</option>
              <option value="M.E.">M.E.</option>
              <option value="Ph.D.">Ph.D.</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Graduation Year</label>
            <input
              type="number"
              style={inputStyle}
              value={profile.graduation_year || ''}
              onChange={e => setProfile(p => ({ ...p, graduation_year: e.target.value }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Visa / Work Auth</label>
            <select
              style={inputStyle}
              value={profile.visa_status || ''}
              onChange={e => setProfile(p => ({ ...p, visa_status: e.target.value }))}
            >
              <option value="">— Select —</option>
              <option value="US Citizen">US Citizen</option>
              <option value="Green Card">Green Card</option>
              <option value="H-1B">H-1B</option>
              <option value="OPT/STEM OPT">OPT/STEM OPT</option>
              <option value="TN Visa">TN Visa</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Years on Current Visa</label>
            <input
              type="number"
              style={inputStyle}
              value={profile.visa_years_remaining || ''}
              onChange={e => setProfile(p => ({ ...p, visa_years_remaining: e.target.value }))}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Engineering Domain</label>
            <select
              style={inputStyle}
              value={profile.domain_family || ''}
              onChange={e => setProfile(p => ({ ...p, domain_family: e.target.value }))}
            >
              <option value="">— Select —</option>
              <option value="aerospace_manufacturing">Aerospace &amp; Manufacturing</option>
              <option value="industrial_engineering">Industrial &amp; Operations Engineering</option>
              <option value="mechanical_thermal">Mechanical &amp; Thermal Engineering</option>
            </select>
          </div>

        </div>
      </div>

      {/* Section 2: Tool & Skills List */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Tools &amp; Skills</div>
        <div style={sectionSubStyle}>Comma-separated. Used to pre-fill resume skill sections.</div>
        <textarea
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          value={toolInput}
          onChange={e => setToolInput(e.target.value)}
          placeholder="Python, MATLAB, SolidWorks, ANSYS, ..."
        />
      </div>

      {/* Section 3: Experience Entries */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={sectionTitleStyle}>Experience Entries</div>
          <button style={btnGhost} onClick={addExpBullet}>
            <Plus size={14} /> Add
          </button>
        </div>
        <div style={sectionSubStyle}>Structured experience that pre-fills new resumes.</div>

        {expBullets.length === 0 && (
          <div style={{ color: t.muted, fontSize: 13 }}>No entries yet. Click Add to create one.</div>
        )}

        {expBullets.map((bullet, idx) => (
          <div
            key={bullet.id}
            style={{
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: 14,
              marginBottom: 12,
              background: t.bg,
              position: 'relative',
            }}
          >
            <button
              style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: t.muted }}
              onClick={() => removeExpBullet(bullet.id)}
              title="Remove"
            >
              <X size={15} />
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
              <div>
                <label style={labelStyle}>Company</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={bullet.company}
                  onChange={e => updateExpBullet(bullet.id, 'company', e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Role</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={bullet.role}
                  onChange={e => updateExpBullet(bullet.id, 'role', e.target.value)}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Key Achievement / Metric</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={bullet.metric}
                  onChange={e => updateExpBullet(bullet.id, 'metric', e.target.value)}
                  placeholder="e.g. Reduced scrap rate by 18% over 6 months"
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Tools Used</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={bullet.tools}
                  onChange={e => updateExpBullet(bullet.id, 'tools', e.target.value)}
                  placeholder="e.g. ANSYS, Python, Lean"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Section 4: Target Roles */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={sectionTitleStyle}>Target Roles</div>
        </div>
        <div style={sectionSubStyle}>Job titles the feed distribution algorithm uses to score jobs for you.</div>

        {roleTargets.length === 0 && (
          <div style={{ color: t.muted, fontSize: 13, marginBottom: 14 }}>No target roles yet.</div>
        )}

        {roleTargets.map(role => (
          <div
            key={role.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              border: `1px solid ${t.border}`,
              borderRadius: 7,
              marginBottom: 8,
              background: t.bg,
            }}
          >
            <span style={{ flex: 1, fontSize: 14, color: t.tx }}>{role.title}</span>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 10,
              background: t.priL,
              color: t.pri,
            }}>
              {role.cluster}
            </span>
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.muted, padding: 2 }}
              onClick={() => removeRoleTarget(role.id)}
              title="Remove"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {/* Add row */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <input
            type="text"
            style={{ ...inputStyle, flex: 2, minWidth: 160 }}
            placeholder="Job title"
            value={newRole.title}
            onChange={e => setNewRole(r => ({ ...r, title: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') addRoleTarget(); }}
          />
          <select
            style={{ ...inputStyle, flex: 1, minWidth: 140 }}
            value={newRole.cluster}
            onChange={e => setNewRole(r => ({ ...r, cluster: e.target.value }))}
          >
            {clusterOptions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button style={btnPrimary} onClick={addRoleTarget}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

    </div>
  );
}
