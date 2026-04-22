require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Division = require('../models/Division');
const Vendor = require('../models/Vendor');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  await User.deleteMany({});
  await Division.deleteMany({});
  await Vendor.deleteMany({});

  // Create divisions with locationCode
  const jodhpur = await Division.create({
    name: 'Jodhpur Division',
    location: 'Jodhpur',
    locationCode: 'JDH',
  });

  const jaipur = await Division.create({
    name: 'Jaipur Division',
    location: 'Jaipur',
    locationCode: 'JAI',
  });

  console.log('Divisions created');

  // Create admin user
  await User.create({
    name: 'Admin',
    email: 'developmentkontentkraftdigital@gmail.com', // real email for OTP
    password: 'Admin@1234',
    role: 'admin',
    division: null,
  });

  // Create branch user for Jodhpur
  await User.create({
    name: 'Incentive Management - Jodhpur Division',
    email: 'mehravivek2001@gmail.com', 
    password: 'Branch@1234',
    role: 'branch',
    division: jodhpur._id,
  });

  // Create a sample vendor — account number manually set, prefix auto-added
  const accountNumber = `${jodhpur.locationCode}-7792811100`;

  await Vendor.create({
    companyName: 'Test Company Pvt Ltd',
    personName: 'Ramesh Kumar',
    accountNumber,
    mobileNumber: '7792811100',
    email: 'ramesh@test.com',
    address: '100, MG Road, Jodhpur',
    division: jodhpur._id,
    status: 'active',
    walletBalance: 10560.90,
    lastRedemptionAmount: 1560.00,
    lastRedemptionDate: new Date('2026-04-20'),
    createdBy: null,
  });

  console.log('Sample vendor created:', accountNumber);

  console.log('\n--- Seed Complete ---');
  console.log('Admin    → developmentkontentkraftdigital@gmail.com        / Admin@1234');
  console.log('Branch   → mehravivek2001@gmail.com / Branch@1234');
  console.log('Vendor search test → mobile: 7792811100');

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
