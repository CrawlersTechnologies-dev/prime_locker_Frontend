import AdminDashboard from '../pages/admin/AdminDashboard';
import SuperDistributorDashboard from '../pages/partner/SuperDistributorDashboard';
import DistributorDashboard from '../pages/partner/DistributorDashboard';
import SubDistributorDashboard from '../pages/partner/Subdistributordashboard';
import NetworkTree from '../pages/network/NetworkTree';
import PartnersList from '../pages/network/PartnersList';
import AddPartner from '../pages/network/AddPartner';
import PartnerDetail from '../pages/network/PartnerDetail';
import CompanyKeys from '../pages/network/CompanyKeys';
import SendKeysRoute from '../pages/network/SendKeysRoute';
import KeyHistory from '../pages/network/KeyHistory';
import KeyRequests from '../pages/network/KeyRequests';
import KeyWallet from '../pages/network/KeyWallet';
import AccessByLevel from '../pages/shared/AccessByLevel';
import RetailersList from '../pages/retailers/RetailersList';
import RetailerForm from '../pages/retailers/RetailerForm';
import RetailerDetail from '../pages/retailers/RetailerDetail';
import CustomersList from '../pages/customers/CustomersList';
import AddCustomer from '../pages/customers/AddCustomer';
import CustomerDetail from '../pages/customers/CustomerDetail';
import DevicesList from '../pages/devices/DevicesList';
import RegisterDevice from '../pages/devices/RegisterDevice';
import DeviceDetail, { DeviceAppsRoute, DeviceLockRoute, DeviceOfflineCodeRoute } from '../pages/devices/DeviceDetail';
import LocationHistory from '../pages/devices/LocationHistory';
import StatusBoard from '../pages/devices/StatusBoard';
import TvList from '../pages/devices/TvList';
import TvDetail from '../pages/devices/TvDetail';
import EmiPlans from '../pages/emi/EmiPlans';
import SetupEmi from '../pages/emi/SetupEmi';
import EmiSchedule from '../pages/emi/EmiSchedule';
import OverdueEmis from '../pages/emi/OverdueEmis';
import PaymentsList, { RecordPaymentRoute } from '../pages/payments/PaymentsList';
import Receipt from '../pages/payments/Receipt';
import Reports from '../pages/insights/Reports';
import AuditLogs from '../pages/insights/AuditLogs';
import Offers from '../pages/insights/Offers';
import Profile from '../pages/account/Profile';
import Notifications from '../pages/account/Notifications';
import Staff from '../pages/admin-tools/Staff';
import Settings from '../pages/admin-tools/Settings';
import WhatsApp from '../pages/admin-tools/WhatsApp';
import Banners from '../pages/admin-tools/Banners';
import AppVersions from '../pages/admin-tools/AppVersions';
import ApprovedModels from '../pages/devices/ApprovedModels';
import BusinessProfile from '../pages/account/BusinessProfile';

/**
 * Screen code → page component. Add a line here as each screen is built.
 * Use "CODE:level" when one code needs a different component for a level.
 */
export const PAGES = {
  'A-02': AdminDashboard,

  // Network & keys
  'N-01': NetworkTree,
  'N-02': PartnersList,
  'N-03': AddPartner,
  'N-04': PartnerDetail,
  'N-05': CompanyKeys,
  'N-06': SendKeysRoute,
  'N-07': KeyHistory,
  'N-08': KeyRequests,
  'N-09': SuperDistributorDashboard,
  'N-10': DistributorDashboard,
  'N-11': SubDistributorDashboard,
  'N-12': KeyWallet,
  'N-13': AccessByLevel,

  // Retailers & customers
  'A-04': RetailersList,
  'A-05': RetailerForm,
  'A-06': RetailerDetail,
  'A-07': CustomersList,
  'A-08': AddCustomer,
  'A-09': CustomerDetail,

  // Devices & TVs (A-12, A-13, A-14 are dialogs over the device page)
  'A-03': DeviceDetail,
  'A-10': DevicesList,
  'A-11': RegisterDevice,
  'A-12': DeviceAppsRoute,
  'A-13': DeviceLockRoute,
  'A-14': DeviceOfflineCodeRoute,
  'A-15': LocationHistory,
  'A-16': StatusBoard,
  'A-17': TvList,
  'A-18': TvDetail,

  // EMI & payments (A-24 is a side sheet over the Payments page)
  'A-19': EmiPlans,
  'A-20': SetupEmi,
  'A-21': EmiSchedule,
  'A-22': OverdueEmis,
  'A-23': PaymentsList,
  'A-24': RecordPaymentRoute,
  'A-25': Receipt,

  // Engage & insights
  'A-32': Reports,
  'A-33': Reports,
  'A-37': AuditLogs,
  'A-46': Banners,
  APPS: AppVersions,
  TAC: ApprovedModels,
  BP: BusinessProfile,
  'A-47': Offers,

  // Account
  'A-42': Profile,
  'A-41': Notifications,

  // Admin
  'A-34': Staff,
  'A-35': Staff,
  'A-36': Staff,
  'A-38': Settings,
  'A-39': Settings,
  'A-40': Settings,
  '—:company': WhatsApp, // WhatsApp campaigns has no design code
};