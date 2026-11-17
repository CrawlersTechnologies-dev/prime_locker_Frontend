import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { networkApi } from '../../services/networkApi';
import { P } from '../../config/permissions';
import { num } from '../../utils/format';
import { Button, Card, ErrorBlock, Icon, KeyValue, LoadingBlock, PageHeader } from '../../components/ui';
import { LevelChip } from './networkParts';

const DOWN = { company: 'SD', super_distributor: 'D', distributor: 'Sub', sub_distributor: 'R' };

function downline(n) {
  if (n.level === 'retailer') return `${num(n.devices)} cust.`;
  return `${n.counts.children} ${DOWN[n.level]}`;
}

/** N-01 · Network tree (Prime Locker staff). Click a row to see its summary; arrows expand and collapse. */
export default function NetworkTree() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi(() => networkApi.tree(), []);
  const summary = useApi(() => networkApi.summary(), []);
  // Open the first two levels and the first distributor's branch, like the design.
  const [open, setOpen] = useState(() => new Set(['pl', 'sd1', 'd1', 's1']));
  const [selected, setSelected] = useState('d1');

  const visible = useMemo(() => {
    if (!data) return [];
    const out = [];
    const hiddenBelow = []; // depth at which we're inside a collapsed branch
    data.forEach((n) => {
      while (hiddenBelow.length && n.depth <= hiddenBelow[hiddenBelow.length - 1]) hiddenBelow.pop();
      if (hiddenBelow.length) return;
      out.push(n);
      if (n.hasChildren && !open.has(n.id)) hiddenBelow.push(n.depth);
    });
    return out;
  }, [data, open]);

  if (loading && !data) return <LoadingBlock />;
  if (error) return <div className="page"><Card><ErrorBlock error={error} onRetry={reload} /></Card></div>;

  const toggle = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const sel = data.find((n) => n.id === selected) ?? data[0];
  const s = summary.data;

  return (
    <div className="page" style={{ gap: 20 }}>
      <PageHeader
        title="Network"
        subtitle={s ? `${s.superDistributors} super distributors · ${s.distributors} distributors · ${s.subDistributors} sub distributors · ${s.retailers} retailers` : ' '}
        actions={<>
          <Button variant="secondary" to="/keys">Enrolment keys</Button>
          {can(P.PARTNER_ADD) && <Button icon="plus" to="/partners/new?level=super_distributor">Add super distributor</Button>}
        </>}
      />

      <div className="lv-legend" aria-label="Levels">
        {['company', 'super_distributor', 'distributor', 'sub_distributor', 'retailer'].map((l) => (
          <span key={l} style={{ display: 'contents' }}><LevelChip level={l} long /><Icon name="chevronRight" size={14} /></span>
        ))}
        <span>Customer</span>
        <span style={{ marginLeft: 12 }}>· Keys move one level down at a time</span>
      </div>

      <div className="split-side">
        <Card flush>
          <div className="tree-scroll">
            <div role="tree" aria-label="Partner network">
              <div className="tree-row is-head" role="presentation"><span>Partner</span><span className="num">Keys balance</span><span className="num">Downline</span><span className="num">Devices</span></div>
              {visible.map((n) => (
                <div
                  key={n.id}
                  role="treeitem"
                  aria-level={n.depth + 1}
                  aria-expanded={n.hasChildren ? open.has(n.id) : undefined}
                  aria-selected={n.id === sel.id}
                  tabIndex={n.id === sel.id ? 0 : -1}
                  className={`tree-row${n.id === sel.id ? ' is-selected' : ''}`}
                  style={{ paddingLeft: 20 + n.depth * 28 }}
                  onClick={() => setSelected(n.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setSelected(n.id);
                    if ((e.key === 'ArrowRight' && !open.has(n.id)) || (e.key === 'ArrowLeft' && open.has(n.id))) { e.preventDefault(); if (n.hasChildren) toggle(n.id); }
                  }}
                >
                  <div className="tree-name">
                    <button type="button" className={`tree-toggle${n.hasChildren ? '' : ' is-empty'}`} tabIndex={-1}
                      aria-label={open.has(n.id) ? `Collapse ${n.name}` : `Expand ${n.name}`}
                      onClick={(e) => { e.stopPropagation(); toggle(n.id); }}>
                      <Icon name={open.has(n.id) ? 'chevronDown' : 'chevronRight'} size={16} />
                    </button>
                    <LevelChip level={n.level} />
                    <span className="nm">{n.name}</span>
                    <span className="city">{n.city}</span>
                  </div>
                  <span className="num fw-600" style={{ color: n.low ? 'var(--bad)' : undefined }}>{num(n.balance)}</span>
                  <span className="num">{downline(n)}</span>
                  <span className="num">{num(n.devices)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ alignSelf: 'flex-start' }}><LevelChip level={sel.level} long /></span>
            <h2 className="h2" style={{ fontSize: 18 }}>{sel.name}</h2>
            <span className="sub">{[sel.owner, sel.city, sel.parent && `under ${sel.parent.name}`].filter(Boolean).join(' · ')}</span>
          </div>
          <div className="stat-trio">
            {sel.live
              ? <><div><b>{num(sel.devices)}</b><span>Devices</span></div><div><b>{num(sel.counts.retailers)}</b><span>Retailers</span></div></>
              : sel.level === 'company'
              ? <><div><b>{num(sel.generated)}</b><span>Generated</span></div><div><b>{num(sel.sent)}</b><span>Sent down</span></div></>
              : <><div><b>{num(sel.received)}</b><span>Received</span></div><div><b>{num(sel.sent)}</b><span>Sent down</span></div></>}
            <div className="is-key"><b>{num(sel.balance)}</b><span>{sel.live ? 'Keys available' : 'Balance'}</span></div>
          </div>
          <KeyValue items={[
            !sel.live && ['Keys used on devices', num(sel.used)],
            sel.live && sel.level !== 'company' && ['Status', sel.status === 'active' ? 'Active' : 'Suspended'],
            sel.live && sel.mobile && ['Mobile', sel.mobile],
            sel.level !== 'retailer' && sel.level !== 'sub_distributor' && sel.level !== 'company' && sel.level !== 'super_distributor' && ['Sub distributors', num(sel.counts.subDistributors)],
            sel.level === 'super_distributor' && ['Distributors', num(sel.counts.distributors)],
            sel.level !== 'retailer' && ['Retailers', num(sel.counts.retailers)],
            sel.collection != null && ['Collection, September', `${sel.collection}%`],
          ]} />
          {sel.level !== 'company' && (
            <Button onClick={() => navigate(sel.level === 'retailer' ? `/retailers/${sel.id}` : `/partners/${sel.id}`)}>
              {sel.level === 'retailer' ? 'Open retailer' : 'Open partner'}
            </Button>
          )}
          {sel.level === 'company' && <Button variant="secondary" to="/keys">Open enrolment keys</Button>}
        </Card>
      </div>
    </div>
  );
}