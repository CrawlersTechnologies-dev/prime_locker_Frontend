import { Card, PageHeader } from '../../components/ui';
import { ACCESS_TABLE } from '../../config/permissions';
import './access.css';

const COLS = ['Super admin', 'Super dist.', 'Distributor', 'Sub dist.', 'Retailer app'];
const CELL = {
  y: { text: 'Yes', cls: 'is-yes' },
  o: { text: 'Own', cls: 'is-own' },
  '-': { text: '—', cls: 'is-no' },
};

/** N-13 · Who can do what (by level) */
export default function AccessByLevel() {
  return (
    <div className="page">
      <PageHeader
        title="Who can do what"
        subtitle="One web panel for every level. Each person sees only their own network below them."
      />
      <Card flush>
        <div className="table">
          <table className="access">
            <thead>
              <tr><th scope="col">Action</th>{COLS.map((c) => <th key={c} scope="col">{c}</th>)}</tr>
            </thead>
            {ACCESS_TABLE.map((g) => (
              <tbody key={g.group}>
                <tr className="access-group"><th colSpan={COLS.length + 1} scope="colgroup">{g.group}</th></tr>
                {g.rows.map(([label, cells]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {cells.split('').map((c, i) => <td key={i} className={CELL[c].cls}>{CELL[c].text}</td>)}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <div className="access-legend">
          <span><b className="is-yes">Yes</b> allowed</span>
          <span><b className="is-own">Own</b> only their own network</span>
          <span><b className="is-no">—</b> not allowed</span>
        </div>
      </Card>
    </div>
  );
}
