import { Card } from '../../components/ui/Card';
import StateMessage from '../../components/ui/StateMessage';
import Button from '../../components/ui/Button';

export default function Forbidden() {
  return (
    <div className="page">
      <Card>
        <StateMessage icon="lock" title="Your account can’t open this page" action={<Button to="/dashboard">Go to dashboard</Button>}>
          Access is set by your level in the network and your role. If you need it, ask the person who manages your account.
        </StateMessage>
      </Card>
    </div>
  );
}
