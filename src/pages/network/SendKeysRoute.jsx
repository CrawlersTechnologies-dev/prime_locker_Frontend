import { useAuth } from '../../context/AuthContext';
import { LEVELS } from '../../config/roles';
import CompanyKeys from './CompanyKeys';
import KeyWallet from './KeyWallet';

/** N-06 · /keys/send — the Send keys dialog over the right page for the user's level. */
export default function SendKeysRoute() {
  const { user } = useAuth();
  return user.level === LEVELS.COMPANY ? <CompanyKeys initialSend /> : <KeyWallet initialSend />;
}