import { Card } from '../../components/ui/Card';
import StateMessage from '../../components/ui/StateMessage';
import PageHeader from '../../components/ui/PageHeader';

/** Stand-in for screens that aren't built yet, so every route works from day one. */
export default function Placeholder({ code, title }) {
  const designed = code && code !== '—';
  return (
    <div className="page">
      <PageHeader title={title} subtitle={designed ? `Screen ${code}` : 'No design yet'} />
      <Card>
        <StateMessage icon="construction" title="This screen is next in the build">
          {designed
            ? `Routing, permissions and the layout are in place. The ${code} content gets built in a later step.`
            : 'This page is in the sidebar but has no design yet. It needs a design before it can be built.'}
        </StateMessage>
      </Card>
    </div>
  );
}
