import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { paymentsApi } from '../../services/paymentsApi';
import { P } from '../../config/permissions';
import { inr } from '../../utils/format';
import { Badge, Breadcrumb, Button, Card, ErrorBlock, LoadingBlock, StateMessage, useToast } from '../../components/ui';
import { ActivityList } from '../devices/deviceParts';
import './receipt.css';

const STATUS = { paid: ['ok', 'Paid'], failed: ['bad', 'Failed'], pending: ['warn', 'Pending'] };

/** A-25 · Payment receipt. Print / Download PDF use the browser's print dialog (print styles hide the app). */
export default function Receipt() {
  const { paymentId } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const { data: r, loading, error, reload } = useApi(() => paymentsApi.get(paymentId), [paymentId]);

  if (loading && !r) return <LoadingBlock rows={3} />;
  if (error) {
    return <div className="page"><Card>{error.status === 404
      ? <StateMessage icon="file" title="Receipt not found" action={<Button to="/payments">Back to payments</Button>}>Check the receipt number. It looks like {r?.live === false ? 'PL-10482' : 'REC-000123'}.</StateMessage>
      : <ErrorBlock error={error} onRetry={reload} />}</Card></div>;
  }
  const [tone, label] = STATUS[r.status];
  const showPhone = can(P.CUSTOMER_PHONE_VIEW);

  return (
    <div className="page" style={{ gap: 20 }}>
      <Breadcrumb items={[{ label: 'Payments', to: '/payments' }, { label: r.id }]} />
      <div className="receipt-layout">
        <Card as="article" className="receipt" aria-label={`Receipt ${r.id}`}>
          <div className="receipt-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/prime-locker-pro-mark.png" alt="" width="34" height="32" style={{ borderRadius: 7 }} />
              <div className="cell-stack"><span style={{ fontSize: 16, fontWeight: 600 }}>Prime Locker Pro</span>{r.store && <span className="cell-sub">via {r.store}</span>}</div>
            </div>
            <Badge tone={tone}>{label}</Badge>
          </div>
          <div className="receipt-amount">
            <span className="sub">{r.status === 'paid' ? 'Amount received' : 'Amount'}</span>
            <b style={{ color: r.status === 'paid' ? undefined : 'var(--muted)' }}>{inr(r.amount)}</b>
            <span className="sub">{r.at}</span>
          </div>
          <dl className="receipt-lines">
            <div><dt>Receipt number</dt><dd className="mono">{r.id}</dd></div>
            <div><dt>Received from</dt><dd>{r.customer.name}{showPhone ? ` · ${r.customer.phone}` : ''}</dd></div>
            <div><dt>For</dt><dd>{r.for}{r.lateFee ? ` (incl. ${inr(r.lateFee)} late fee)` : ''}</dd></div>
            {r.device && <div><dt>Device</dt><dd>{r.device.name} · {r.device.label} <span className="mono">{r.device.ref}</span></dd></div>}
            <div><dt>Payment mode</dt><dd>{r.mode}</dd></div>
            {r.utr && <div><dt>UTR</dt><dd className="mono">{r.utr}</dd></div>}
            {r.status === 'failed' && <div><dt>Reason</dt><dd className="text-bad">{r.failReason}</dd></div>}
            {r.status === 'paid' && <div><dt>Balance after payment</dt><dd className="fw-600">{inr(r.balanceAfter)}</dd></div>}
            {r.status === 'paid' && r.next && <div><dt>Next due</dt><dd className="fw-600">{inr(r.next.amount)} on {r.next.due}</dd></div>}
          </dl>
          <p className="receipt-foot">This is a computer-generated receipt and needs no signature.</p>
        </Card>

        <div className="receipt-side">
          <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Button icon="download" onClick={() => window.print()} disabled={r.status !== 'paid'}>Download PDF</Button>
            {can(P.WHATSAPP_SEND) && <Button variant="secondary" icon="chat" disabled={r.status !== 'paid'} onClick={() => toast(`Receipt sent on WhatsApp to ${r.customer.phone}`)}>Send on WhatsApp</Button>}
            <Button variant="secondary" icon="file" onClick={() => window.print()}>Print</Button>
          </Card>
          <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 className="h2" style={{ fontSize: 15 }}>What happened</h2>
            <ActivityList items={r.events.map((e, i) => ({ id: String(i), tone: e.tone, text: e.text, at: e.at }))} />
          </Card>
        </div>
      </div>
    </div>
  );
}