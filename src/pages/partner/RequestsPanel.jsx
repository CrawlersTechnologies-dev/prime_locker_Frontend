import { useState } from 'react';
import { keysApi } from '../../services/networkApi';
import { useAuth } from '../../context/AuthContext';
import { P } from '../../config/permissions';
import { num } from '../../utils/format';
import { Badge, Button, Card, useToast } from '../../components/ui';
import './partner.css';

/** "Key requests" / "Requests from retailers" side panel on partner dashboards. */
export default function RequestsPanel({ title = 'Key requests', requests, balance, onDecline, onDone }) {
  const { can } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const approve = async (r) => {
    setBusy(r.id);
    try { await keysApi.approve(r.id, r.qty); toast(`${num(r.qty)} keys sent to ${r.from.name}`); onDone(); }
    catch (err) { toast(err.message, 'bad'); setBusy(null); }
  };
  return (
    <Card flush>
      <div className="card-head" style={{ padding: '18px 20px' }}>
        <h2 className="h2">{title}</h2>
        {requests.length > 0 ? <Badge tone="warn">{requests.length} waiting</Badge> : <span className="sub">None waiting</span>}
      </div>
      {requests.length === 0 && <p className="sub" style={{ padding: '0 20px 20px' }}>When someone below you runs low, their request shows up here.</p>}
      {requests.map((r) => {
        const enough = r.qty <= balance;
        return (
          <div key={r.id} className="request">
            <div className="request-top"><span>{r.from.name}</span><span>{num(r.qty)} keys</span></div>
            <span className="sub">Balance {num(r.from.balance)}{r.note ? ` · “${r.note}”` : ''}</span>
            <span className="sub" style={{ color: enough ? undefined : 'var(--bad)' }}>
              {enough ? `You have ${num(balance)}. Sending ${num(r.qty)} leaves you ${num(balance - r.qty)}.` : `You have only ${num(balance)}. Send part of it from Key requests.`}
            </span>
            {can(P.KEYS_APPROVE) && (
              <div className="request-actions">
                <Button variant="secondary" size="sm" onClick={() => onDecline(r)}>Decline</Button>
                <Button size="sm" disabled={!enough || busy === r.id} onClick={() => approve(r)}>{busy === r.id ? 'Sending…' : `Send ${num(r.qty)}`}</Button>
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}