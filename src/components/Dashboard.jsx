import { useState, useEffect } from 'react';
import { CheckCircle, Users, AlertTriangle, MessageSquare, Coffee, Zap, Circle } from 'lucide-react';
import { getWeekDays, calcStreak, buildSparkData, isSameLocalDay } from '../lib/dashboard-utils.js';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAILY_GOAL = 3;

function Sparkline({ data, color, width = 72, height = 28 }) {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  const max = Math.max(...data, 1);
  const pts = data
    .map((v, i) => {
      const x = ((i / (data.length - 1)) * width).toFixed(1);
      const y = (height - (v / max) * (height - 4) - 2).toFixed(1);
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}

function KpiCard({ label, value, sparkData, color, sub, t }) {
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, padding: '16px 20px', boxShadow: t.shadow }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: 1.5 }}>{label}</div>
        <Sparkline data={sparkData} color={color} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: t.tx, lineHeight: 1, marginBottom: 4, fontFamily: "'Geist Mono', 'Courier New', monospace" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: t.sub }}>{sub}</div>
    </div>
  );
}

export default function Dashboard({ apps, pipeline, searchResults: _searchResults, contacts, setPage, t }) {
  // Live clock — ticks every minute so greeting and today-index stay current
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const weekDays = getWeekDays();
  const today = now;
  const todayIdx = (today.getDay() + 6) % 7; // Mon=0, Sun=6

  const appsPerDay = weekDays.map(day =>
    apps.filter(a => isSameLocalDay(a.date, day)).length
  );

  const appsSpark  = buildSparkData(apps, 7);
  const outreached = (contacts || []).filter(c => c.outreach_sent);
  const netSpark   = buildSparkData(outreached.map(c => ({ date: c.outreach_date })), 7);
  const streak     = calcStreak(apps, contacts);

  const pipelineSpark = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const ds = d.toISOString().split('T')[0];
    return pipeline.filter(j => {
      if (!j.addedAt) return false;
      return new Date(j.addedAt).toISOString().split('T')[0] === ds;
    }).length;
  });

  const activeP        = pipeline.filter(j => j.status === 'active').length;
  const totalApps      = apps.length;
  const totalNetworked = outreached.length;

  const statusCounts = { Sent: 0, Accepted: 0, Replied: 0, 'Coffee Chat': 0, 'Referral Secured': 0, Cold: 0 };
  outreached.forEach(c => {
    const s = c.outreach_status || 'Sent';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });
  const responseRate = totalNetworked > 0
    ? Math.round(((statusCounts['Replied'] + statusCounts['Coffee Chat']) / totalNetworked) * 100)
    : 0;

  const overdueFollowUps = outreached.filter(c => {
    if (!['Accepted','Replied'].includes(c.outreach_status)) return false;
    const snoozed = c.follow_up_snoozed_until;
    if (snoozed && new Date(snoozed) >= new Date()) return false;
    const last = c.last_contact ? new Date(c.last_contact) : null;
    return last && Math.floor((Date.now() - last) / 86400000) >= 7;
  }).length;

  const weekAppsTotal = appsPerDay.slice(0, todayIdx + 1).reduce((s, n) => s + n, 0);
  const weekGoal = (todayIdx + 1) * DAILY_GOAL;

  const recentApps = [...apps]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5);

  const greeting = (() => {
    const h = today.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: '0 0 3px', fontSize: 22, fontWeight: 700, color: t.tx }}>{greeting}</h2>
          <p style={{ margin: 0, fontSize: 13.5, color: t.sub }}>Here's your job search overview for today.</p>
        </div>
        {streak > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: t.yellowL, border: `1px solid ${t.yellowBd}`, borderRadius: 20 }}>
            <Zap size={14} color={t.yellow} />
            <span style={{ fontSize: 13, fontWeight: 700, color: t.yellow, fontFamily: "'Geist Mono', monospace" }}>{streak}</span>
            <span style={{ fontSize: 12, color: t.yellow }}>day streak</span>
          </div>
        )}
      </div>

      {/* Weekly progress hero: horizontal day bars */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, padding: '20px 24px', marginBottom: 18, boxShadow: t.shadow }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: 1.8 }}>This Week</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Circle size={13} color={t.pri} />
            <span style={{ fontSize: 12, fontWeight: 700, color: t.pri, fontFamily: "'Geist Mono', monospace" }}>{weekAppsTotal}</span>
            <span style={{ fontSize: 12, color: t.muted }}>/ {weekGoal} target</span>
          </div>
        </div>
        {weekDays.map((day, i) => {
          const count    = appsPerDay[i];
          const isToday  = i === todayIdx;
          const isFuture = i > todayIdx;
          const barPct   = Math.min(100, Math.round((count / DAILY_GOAL) * 100));
          const barColor = isToday ? t.pri : (count > 0 ? t.green : t.muted);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i < 6 ? 8 : 0 }}>
              <div style={{ width: 30, fontSize: 11, fontWeight: isToday ? 700 : 500, color: isToday ? t.pri : t.sub, flexShrink: 0 }}>
                {DAY_LABELS[i]}
              </div>
              <div style={{ flex: 1, height: 18, background: t.hover, borderRadius: 4, overflow: 'hidden' }}>
                {!isFuture && count > 0 && (
                  <div style={{ width: `${Math.max(barPct, 4)}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width .4s ease' }} />
                )}
              </div>
              <div style={{ width: 22, textAlign: 'right', fontSize: 12, fontWeight: 700, color: isFuture ? t.muted : (count > 0 ? barColor : t.muted), fontFamily: "'Geist Mono', monospace", flexShrink: 0 }}>
                {isFuture ? '·' : count}
              </div>
            </div>
          );
        })}
      </div>

      {/* KPI sparkline cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        <KpiCard
          label="Applications" value={totalApps} sparkData={appsSpark} color={t.pri}
          sub={`${weekAppsTotal} this week`} t={t}
        />
        <KpiCard
          label="Pipeline" value={activeP}
          sparkData={pipelineSpark}
          color={t.yellow}
          sub={activeP > 0 ? `${activeP} active` : 'Add jobs to pipeline'} t={t}
        />
        <KpiCard
          label="Response Rate" value={`${responseRate}%`}
          sparkData={null}
          color={t.green}
          sub={`${statusCounts['Replied'] + statusCounts['Coffee Chat']} of ${totalNetworked} replied`} t={t}
        />
        <KpiCard
          label="Contacts" value={totalNetworked} sparkData={netSpark} color="#a78bfa"
          sub={overdueFollowUps > 0 ? `${overdueFollowUps} follow-up${overdueFollowUps > 1 ? 's' : ''} due` : 'Networking log'} t={t}
        />
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* Recent applications */}
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, padding: '20px', boxShadow: t.shadow }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: 1.8 }}>Recent Applications</div>
            <div onClick={() => setPage('applied')} style={{ fontSize: 11.5, color: t.pri, cursor: 'pointer', fontWeight: 600 }}>View all →</div>
          </div>
          {recentApps.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: t.muted, fontSize: 13 }}>No applications yet. Start applying!</div>
          ) : (
            recentApps.map((app, i) => (
              <div key={app.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < recentApps.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: t.tx, marginBottom: 1 }}>{app.role || 'Unknown Role'}</div>
                  <div style={{ fontSize: 12, color: t.sub }}>{app.company}</div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, flexShrink: 0,
                  background: app.status === 'Offer' ? t.greenL : app.status === 'Interview' ? t.priL : t.hover,
                  color: app.status === 'Offer' ? t.green : app.status === 'Interview' ? t.pri : t.sub,
                  border: `1px solid ${app.status === 'Offer' ? t.greenBd : app.status === 'Interview' ? t.priBd : t.border}`
                }}>
                  {app.status || 'Applied'}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Networking panel */}
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, padding: '20px', boxShadow: t.shadow }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: 1.8 }}>Networking</div>
            <div onClick={() => setPage('networking')} style={{ fontSize: 11.5, color: t.pri, cursor: 'pointer', fontWeight: 600 }}>Open →</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: overdueFollowUps > 0 ? 12 : 0 }}>
            {[
              { label: 'Sent',             count: statusCounts['Sent'],             color: t.yellow, Icon: MessageSquare },
              { label: 'Replied',          count: statusCounts['Replied'],          color: t.green,  Icon: CheckCircle },
              { label: 'Coffee Chat',      count: statusCounts['Coffee Chat'],      color: '#a78bfa', Icon: Coffee },
              { label: 'Referral Secured', count: statusCounts['Referral Secured'], color: t.green,  Icon: Users },
            ].map(({ label, count, color, Icon }) => (
              <div key={label} style={{ padding: '10px 12px', background: t.hover, borderRadius: 8, border: `1px solid ${t.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <Icon size={12} color={color} />
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: t.tx, fontFamily: "'Geist Mono', monospace" }}>{count}</div>
              </div>
            ))}
          </div>
          {overdueFollowUps > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: t.redL, borderRadius: 8, border: `1px solid ${t.redBd}` }}>
              <AlertTriangle size={13} color={t.red} />
              <span style={{ fontSize: 12.5, color: t.red, fontWeight: 600 }}>
                {overdueFollowUps} overdue follow-up{overdueFollowUps > 1 ? 's' : ''}
              </span>
            </div>
          )}
          {totalNetworked === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: t.muted, fontSize: 13 }}>
              No contacts yet. Start outreaching!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
