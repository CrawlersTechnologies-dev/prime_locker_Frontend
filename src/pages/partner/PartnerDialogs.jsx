import { DeclineRequestDialog, RequestKeysDialog, SendKeysDialog } from '../network/networkParts';

/** The three dialogs every partner dashboard can open. */
export default function PartnerDialogs({ data, dialog, close, done }) {
  if (!dialog) return null;
  if (dialog.kind === 'send') return <SendKeysDialog open toId={dialog.toId} onClose={close} onDone={done} />;
  if (dialog.kind === 'request') {
    return <RequestKeysDialog open parentName={data.parent?.name} balance={data.balance} usedPerMonth={data.usedPerMonth} onClose={close} onDone={done} />;
  }
  if (dialog.kind === 'decline') return <DeclineRequestDialog request={dialog.request} onClose={close} onDone={done} />;
  return null;
}