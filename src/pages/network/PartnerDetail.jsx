import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useQueryState } from '../../hooks/useQueryState';
import { networkApi, keysApi } from '../../services/networkApi';
import { P } from '../../config/permissions';
import { LEVELS, LEVEL_META } from '../../config/roles';
import { num, initials } from '../../utils/format';
import {
  Badge, Breadcrumb, Button, Card, CardHeader, Dialog, ErrorBlock, Icon, KeyValue, Kpi, LoadingBlock, StateMessage,
  Pagination, Table, Tabs, TabPanel, useToast,
  MediaLink,
} from '../../components/ui';
import { KeyStatusBadge, LevelChip, SendKeysDialog } from './networkParts';

const AVATAR = { super_distributor: ['#1F3D7A', '#FFFFFF'], distributor: ['#3D5A94', '#FFFFFF'], sub_distributor: ['#DCE3F2', '#1F3D7A'] };
const CHILD = { super_distributor: 'Distributors', distributor: 'Sub distributors', sub_distributor: 'Retailers' };
const MONTH = 'Sep'; // TODO(api): period from the backend

function statusBadge(status) {
  if (status === 'pending') return <Badge tone="mute">Awaiting approval</Badge>;
  if (status === 'suspended') return <Badge tone="bad">Suspended</Badge>;
  return <Badge tone="ok">Active</Badge>;
}

/** N-04 · Partner detail */
export default function PartnerDetail() {
  const { partnerId } = useParams();
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const toast = useToast();
  const { data: p, loading, error, reload } = useApi(() => networkApi.partner(partnerId), [partnerId]);
  const [q, setQ] = useQueryState({ tab: 'overview' });
  const [dialog, setDialog] = useState(null); // send | suspend | delete
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading && !p) return <LoadingBlock />;
  if (error) {
    return <div className="page"><Card>{error.status === 404
      ? <StateMessage icon="partners" title="This partner isn’t in your network" action={<Button to="/network">Back to network</Button>}>They may have been removed, or they sit in another network.</StateMessage>
      : <ErrorBlock error={error} onRetry={reload} />}</Card></div>;
  }
  if (p.level === LEVELS.RETAILER) return <Navigate to={`/retailers/${p.id}`} replace />;

  const isCompany = user.level === LEVELS.COMPANY;
  const myOrgId = isCompany ? 'pl' : user.org?.id;
  const isMe = p.id === myOrgId;
  // Staff can move a parent's keys on its behalf; partners only send from their own wallet to a direct child.
  const canSend = can(P.KEYS_SEND) && !isMe && p.status !== 'suspended' && (isCompany || p.parent?.id === myOrgId);
  const canSuspend = can(P.PARTNER_SUSPEND) && !isMe;
  const childLabel = CHILD[p.level];
  const live = !!p.live;
  const canDelete = live && isCompany && can(P.PARTNER_SUSPEND);

  const remove = async () => {
    setBusy(true);
    try { await networkApi.removePartner(p.id); toast(`${p.name} deleted`); navigate('/partners', { replace: true }); }
    catch (err) { toast(err.message, 'bad'); setBusy(false); }
  };

  const changeStatus = async (status, msg) => {
    setBusy(true);
    try { await networkApi.setPartnerStatus(p.id, status, reason || undefined); toast(msg); setDialog(null); setReason(''); reload(); }
    catch (err) { toast(err.message, 'bad'); }
    finally { setBusy(false); }
  };

  const tabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'children', label: `${childLabel} (${p.children.length})` },
    ...(p.level !== LEVELS.SUB_DISTRIBUTOR ? [{ value: 'retailers', label: `Retailers (${p.retailers.length})` }] : []),
    ...(live ? [] : [{ value: 'keys', label: 'Key history' }]),
    { value: 'logins', label: 'Logins' },
  ];
  const tab = tabs.some((t) => t.value === q.tab) ? q.tab : 'overview';
  const [bg, fg] = AVATAR[p.level] ?? ['#EFEFEB', '#3D414A'];

  const childColumns = [
    { key: 'name', header: LEVEL_META[p.children[0]?.level ?? 'retailer']?.label ?? 'Name', width: '2fr', render: (r) => (
      <div className="cell-stack"><span className="fw-600">{r.name}</span><span className="cell-sub">{r.owner}</span></div>
    ) },
    ...(p.level !== LEVELS.SUB_DISTRIBUTOR ? [{ key: 'ret', header: 'Retailers', width: '0.8fr', align: 'right', render: (r) => num(r.counts.retailers) }] : [
      { key: 'dev', header: 'Devices', width: '0.8fr', align: 'right', render: (r) => num(r.devices) },
    ]),
    ...(p.live ? [] : [{ key: 'received', header: 'Received', width: '0.8fr', align: 'right', render: (r) => <span className="ink-2">{num(r.received)}</span> }]),
    { key: 'balance', header: p.live ? 'Keys' : 'Balance', width: '0.8fr', align: 'right', render: (r) => <span className="fw-600" style={{ color: r.low ? 'var(--bad)' : undefined }}>{num(r.balance)}</span> },
    ...(p.live ? [] : [{ key: 'used', header: 'Used', width: '0.8fr', align: 'right', render: (r) => <span className="ink-2">{num(r.used)}</span> }]),
    { key: 'st', header: p.live ? 'Status' : 'Keys', width: '1.3fr', render: (r) => <KeyStatusBadge status={r.keyStatusDetailed} /> },
  ];
  const openChild = (r) => navigate(r.level === LEVELS.RETAILER ? `/retailers/${r.id}` : `/partners/${r.id}`);

  return (
    <div className="page" style={{ gap: 20 }}>
      <Breadcrumb items={[
        { label: isCompany ? 'Network' : LEVEL_META[user.level].downline, to: '/network' },
        ...p.chain.filter((c) => c.level !== 'company' && c.id !== p.id && c.id !== myOrgId).map((c) => ({ label: c.name, to: `/partners/${c.id}` })),
        { label: p.name },
      ]} />

      <div className="detail-head">
        <span className="avatar-i is-square is-lg" style={{ background: bg, color: fg }} aria-hidden="true">{initials(p.name)}</span>
        <div className="detail-head-main">
          <div className="detail-head-title"><h1 className="h1">{p.name}</h1><LevelChip level={p.level} long />{statusBadge(p.status)}</div>
          <span className="sub" style={{ fontSize: 14 }}>{[p.owner, p.mobile, p.city, p.since && `partner since ${p.since}`].filter(Boolean).join(' · ')}</span>
        </div>
        <div className="page-actions">
          {p.status === 'pending' && can(P.PARTNER_APPROVE) && <Button icon="check" disabled={busy} onClick={() => changeStatus('active', 'Partner approved · login sent by SMS')}>Approve</Button>}
          {p.status === 'active' && canSuspend && <Button variant="secondary" onClick={() => setDialog('suspend')}>Suspend</Button>}
          {p.status === 'suspended' && canSuspend && <Button variant="secondary" disabled={busy} onClick={() => changeStatus('active', 'Partner reactivated')}>Reactivate</Button>}
          {canDelete && <Button variant="secondary" onClick={() => setDialog('delete')}>Delete</Button>}
          {canSend && <Button icon="key" onClick={() => setDialog('send')}>Send keys</Button>}
        </div>
      </div>

      {p.status === 'pending' && (
        <div className="note" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>
          Waiting for a super admin to approve. {p.owner} can’t sign in until then.
        </div>
      )}
      {p.waitingRequest && (
        <div className="note">
          <Icon name="request" size={16} />
          <span>{p.name} asked for {num(p.waitingRequest.qty)} keys on {p.waitingRequest.at}{p.waitingRequest.note ? ` — “${p.waitingRequest.note}”` : ''}. {canSend ? 'Send keys to approve it.' : ''}</span>
        </div>
      )}

      <Tabs label="Partner sections" idPrefix="pd" tabs={tabs} value={tab} onChange={(t) => setQ({ tab: t })} />

      <TabPanel idPrefix="pd" value={tab}>
        {tab === 'overview' && live && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="grid-4">
              <Kpi label="Keys available" value={num(p.balance)} foot={p.status === 'suspended' ? 'hidden while suspended' : 'all key types'} />
              <Kpi label={childLabel} value={num(p.counts.children)} foot="directly under them" />
              <Kpi label="Retailers" value={num(p.level === LEVELS.SUB_DISTRIBUTOR ? p.counts.children : p.counts.retailers)} foot="in their network" />
              <Kpi label="Devices enrolled" value={num(p.devices)} foot={`${num(p.overdue)} overdue installments`} />
            </div>
            <div className="split-side">
              <Card flush>
                <CardHeader title={childLabel} />
                <Table columns={childColumns} rows={p.children} onRowClick={openChild} minWidth={560} empty={`No ${childLabel.toLowerCase()} yet.`} />
              </Card>
              <Card style={{ padding: '20px 24px' }}>
                <h2 className="h2" style={{ paddingBottom: 8 }}>Details</h2>
                <KeyValue items={[
                  ['Owner', p.owner || '—'],
                  ['Sign-in email', p.email || '—'],
                  ['Mobile', p.mobile || '—'],
                  ['Address', [p.address, p.city, p.state, p.pincode].filter(Boolean).join(', ') || '—'],
                  ['GSTIN', p.gstin ? <span className="mono" style={{ fontSize: 13 }}>{p.gstin}</span> : '—'],
                  ['PAN', p.pan ? <span className="mono" style={{ fontSize: 13 }}>{p.pan}</span> : '—'],
                  ['ID proof', p.kycUrl ? <MediaLink url={p.kycUrl} className="btn btn-text">View document</MediaLink> : '—'],
                  ['Reports to', p.parent?.name ?? 'Prime Locker'],
                  ['Can take keys back', p.canReclaim ? 'Yes' : 'No'],
                ]} />
              </Card>
            </div>
          </div>
        )}

        {tab === 'overview' && !live && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="kpi-5">
              <Kpi label="Keys balance" value={num(p.balance)} foot="not yet sent down" />
              <Kpi label="Keys in network" value={num(p.received)} foot={p.parent ? `received from ${p.parent.name.split(' ')[0]}` : 'received'} />
              <Kpi label="Used on devices" value={num(p.used)} foot={`+${num(p.usedPerMonth)} this month`} />
              <Kpi label="Active devices" value={num(p.devices)} foot={`${num(p.counts.retailers)} retailers`} />
              <Kpi label={`Collection, ${MONTH}`} value={p.collection != null ? `${p.collection}%` : '—'} foot={`${num(p.overdue)} overdue`} />
            </div>
            <div className="split-side">
              <Card flush>
                <CardHeader title={childLabel} />
                <Table columns={childColumns} rows={p.children} onRowClick={openChild} minWidth={640} empty={`No ${childLabel.toLowerCase()} yet.`} />
              </Card>
              <Card style={{ padding: '20px 24px' }}>
                <h2 className="h2" style={{ paddingBottom: 6 }}>Recent key movement</h2>
                {p.movements.length === 0 ? <p className="sub">No keys sent or received yet.</p> : (
                  <KeyValue items={p.movements.map((m) => [`${m.date} · ${m.label}`, <span style={{ color: m.delta > 0 ? 'var(--ok)' : undefined }}>{m.delta > 0 ? `+${num(m.delta)}` : `−${num(-m.delta)}`}</span>])} />
                )}
                <button type="button" className="btn btn-text" style={{ padding: 0, height: 'auto', marginTop: 10 }} onClick={() => setQ({ tab: 'keys' })}>Full key history</button>
              </Card>
            </div>
          </div>
        )}

        {tab === 'children' && (
          <Card flush>
            <CardHeader title={childLabel} subtitle={`Directly under ${p.name}`} />
            <Table columns={childColumns} rows={p.children} onRowClick={openChild} minWidth={640} empty={`No ${childLabel.toLowerCase()} yet.`} />
          </Card>
        )}

        {tab === 'retailers' && (
          <Card flush>
            <CardHeader title="Retailers" subtitle={`Every store anywhere under ${p.name}`} />
            <Table
              columns={[
                { key: 'name', header: 'Store', width: '2fr', render: (r) => <div className="cell-stack"><span className="fw-600">{r.name}</span><span className="cell-sub">{[r.owner, r.city].filter(Boolean).join(' · ')}</span></div> },
                { key: 'parent', header: 'Reports to', width: '1.5fr', render: (r) => <span className="ink-2">{r.parent?.name}</span> },
                { key: 'devices', header: 'Devices', width: '0.8fr', align: 'right', render: (r) => num(r.devices) },
                { key: 'balance', header: 'Keys left', width: '0.8fr', align: 'right', render: (r) => <span className="fw-600" style={{ color: r.low ? 'var(--bad)' : undefined }}>{num(r.balance)}</span> },
                { key: 'collection', header: 'Collection', width: '0.8fr', align: 'right', render: (r) => (r.collection != null ? `${r.collection}%` : '—') },
              ]}
              rows={p.retailers}
              onRowClick={(r) => navigate(`/retailers/${r.id}`)}
              minWidth={700}
              empty="No retailers yet."
            />
          </Card>
        )}

        {tab === 'keys' && <PartnerLedger partnerId={p.id} />}

        {tab === 'logins' && (
          <Card flush>
            <CardHeader title="Logins" subtitle="People who sign in to the panel for this partner" />
            <Table columns={[
              { key: 'name', header: 'Name', width: '1.5fr', render: (l) => <span className="fw-600">{l.name}</span> },
              { key: 'role', header: 'Role', width: '1fr', render: (l) => <span className="ink-2">{l.role}</span> },
              { key: 'mobile', header: 'Mobile (OTP login)', width: '1.2fr' },
              { key: 'lastSignIn', header: 'Last sign-in', width: '1fr', render: (l) => <span className="ink-2">{l.lastSignIn}</span> },
            ]} rows={p.logins} minWidth={600} />
          </Card>
        )}
      </TabPanel>

      {dialog === 'send' && (
        <SendKeysDialog open fromId={p.parent?.id} toId={p.id} toLevel={p.level} onClose={() => setDialog(null)} onDone={() => { setDialog(null); reload(); }} />
      )}
      <Dialog open={dialog === 'suspend'} onClose={() => setDialog(null)} title={`Suspend ${p.name}?`}
        actions={<>
          <Button variant="secondary" data-close onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="danger" disabled={busy} onClick={() => changeStatus('suspended', 'Partner suspended')}>Suspend partner</Button>
        </>}>
        <p>{p.owner || p.name} can’t sign in, send keys or receive keys. Their {num(p.balance)} keys stay in their wallet. Partners and stores under them keep working.</p>
        {!live && <div className="field">
          <label className="field-label" htmlFor="sus-reason">Reason <span className="optional">(saved in the audit log)</span></label>
          <textarea id="sus-reason" className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>}
      </Dialog>
      <Dialog open={dialog === 'delete'} onClose={() => setDialog(null)} title={`Delete ${p.name}?`}
        actions={<>
          <Button variant="secondary" data-close onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="danger" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete permanently'}</Button>
        </>}>
        <p>This removes their account for good. {p.counts.children > 0 ? `The ${p.counts.children} ${childLabel.toLowerCase()} under them will no longer report to anyone. ` : ''}To stop them signing in but keep their history, suspend them instead.</p>
      </Dialog>
    </div>
  );
}

function PartnerLedger({ partnerId }) {
  const [page, setPage] = useState(1);
  const { data, error, reload } = useApi(() => keysApi.ledger({ orgId: partnerId, page }), [partnerId, page]);
  if (error) return <Card><ErrorBlock error={error} onRetry={reload} /></Card>;
  const rows = data?.items ?? [];
  return (
    <Card flush>
      <CardHeader title="Key history" subtitle="Keys this partner received and sent" action={<Link to="/keys/history" className="link-arrow">All key history<Icon name="chevronRight" size={16} /></Link>} />
      <Table
        columns={[
          { key: 'at', header: 'Date', width: '1fr', render: (e) => <span className="ink-2">{e.at}</span> },
          { key: 'path', header: 'From → to', width: '2fr' },
          { key: 'qty', header: 'Keys', width: '0.6fr', align: 'right', render: (e) => <span className="fw-600" style={{ color: e.toId === partnerId ? 'var(--ok)' : undefined }}>{e.toId === partnerId ? '+' : '−'}{num(e.qty)}</span> },
          { key: 'ref', header: 'Reference', width: '1.2fr', render: (e) => <span className="mono small muted">{e.ref}</span> },
          { key: 'by', header: 'Done by', width: '1fr', render: (e) => <span className="ink-2">{e.by}</span> },
        ]}
        rows={rows}
        minWidth={720}
        empty="No key movements yet."
      />
      {data && <Pagination {...data} onPage={setPage} />}
    </Card>
  );
}