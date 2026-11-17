export const ADMIN_DASHBOARD = {
  dateLabel: 'Sunday, 27 September 2026',
  kpis: {
    activeDevices: { value: 1284, delta: '+42 this week' },
    customersOnEmi: { value: 1197, retailers: 14 },
    collected: { amount: '₹18.6L', month: 'September', percentOfDue: 92 },
    overdue: { count: 73, outstanding: '₹4.1L' },
  },
  collections: [
    { month: 'Apr', collected: 14.9, due: 16.2 },
    { month: 'May', collected: 15.6, due: 16.8 },
    { month: 'Jun', collected: 16.4, due: 17.2 },
    { month: 'Jul', collected: 15.8, due: 17.5 },
    { month: 'Aug', collected: 17.6, due: 19.0 },
    { month: 'Sep', collected: 18.6, due: 20.2 },
  ],
  deviceStatus: { total: 1284, online: 1041, offline: 170, locked: 58, alert: 15 },
  overdue: [
    { id: 'c1', customer: 'Ravi Kulkarni', phone: '+91 98450 12345', device: 'Galaxy A15', deviceRef: '…448210', deviceId: 'dv1', retailer: 'Sri Mobiles, Talikota', due: '12 Sep', amount: '₹1,225', daysLate: 15, status: 'locked' },
    { id: 'c2', customer: 'Imran Shaikh', phone: '+91 90080 44120', device: 'iPhone 13', deviceRef: 'SN …Q7KD', deviceId: 'dv2', retailer: 'Sri Mobiles, Talikota', due: '15 Sep', amount: '₹3,450', daysLate: 12, status: 'online' },
    { id: 'c3', customer: 'Meena Patil', phone: '+91 99001 22771', device: 'Vivo T3', deviceRef: '…110934', deviceId: 'dv3', retailer: 'Galaxy Point, Muddebihal', due: '18 Sep', amount: '₹1,899', daysLate: 9, status: 'locked' },
    { id: 'c4', customer: 'Kavya Hiremath', phone: '+91 99645 81230', device: 'Mi TV 43″', deviceRef: 'SN …88A2', deviceId: 'tv1', retailer: 'Vijay Electronics, Vijayapura', due: '20 Sep', amount: '₹1,650', daysLate: 7, status: 'offline' },
    { id: 'c5', customer: 'Suresh Biradar', phone: '+91 88840 77211', device: 'Redmi 13C', deviceRef: '…770215', deviceId: 'dv5', retailer: 'Galaxy Point, Muddebihal', due: '22 Sep', amount: '₹1,299', daysLate: 5, status: 'online' },
  ],
};