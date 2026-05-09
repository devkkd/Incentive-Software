require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Division = require('../models/Division');
const Vendor = require('../models/Vendor');

const BRANCHES = [
  { name: 'AJM', location: 'Ajmer',      locationCode: '1'  },
  { name: 'BEW', location: 'Beawer',     locationCode: '2'  },
  { name: 'BKN', location: 'Bikaner',    locationCode: '3'  },
  { name: 'BT8', location: 'Balotra',    locationCode: '21' },
  { name: 'CER', location: 'Nagaur',     locationCode: '14' },
  { name: 'CPS', location: 'Jodhpur',    locationCode: '4'  },
  { name: 'ETY', location: 'Kishangarh', locationCode: '17' },
  { name: 'GMR', location: 'Jodhpur',    locationCode: '12' },
  { name: 'GYT', location: 'Pali',       locationCode: '10' },
  { name: 'JNR', location: 'Sumerpur',   locationCode: '5'  },
  { name: 'JOD', location: 'Jodhpur',    locationCode: '6'  },
  { name: 'JOH', location: 'Jodhpur',    locationCode: '7'  },
  { name: 'KHA', location: 'Ajmer',      locationCode: '9'  },
  { name: 'MHX', location: 'Sirohi',     locationCode: '15' },
  { name: 'PO4', location: 'Bikaner',    locationCode: '18' },
  { name: 'SDY', location: 'Barmer',     locationCode: '13' },
  { name: 'SG5', location: 'Merta',      locationCode: '23' },
  { name: 'SYN', location: 'Bikaner',    locationCode: '20' },
  { name: 'VPG', location: 'Jodhpur',    locationCode: '19' },
  { name: 'WSG', location: 'Jodhpur',    locationCode: '22' },
];

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  await User.deleteMany({});
  await Division.deleteMany({});
  await Vendor.deleteMany({});

  // Create all divisions/branches
  const divisionMap = {};
  for (const b of BRANCHES) {
    const div = await Division.create({
      name: b.name,
      location: b.location,
      locationCode: b.locationCode,
    });
    divisionMap[b.locationCode] = div._id;
    console.log(`Division created: ${b.name} (${b.locationCode})`);
  }

  // Create admin user
  await User.create({
    name: 'Admin',
    email: 'developmentkontentkraftdigital@gmail.com',
    password: 'Admin@1234',
    role: 'admin',
    division: null,
  });

  // Create branch user for HO (JOH)
  await User.create({
    name: 'HO Branch',
    email: 'mehravivek2001@gmail.com',
    password: 'Branch@1234',
    role: 'branch',
    division: divisionMap['JOH'],
  });

  // Sample vendors
  const vendorData = [
    { companyName: 'MAHESHWARI MOTORS BEAWAR', personName: 'Maheshwari', mobile: '9876543210', loc: 'AJM', code: 'TRJ028' },
    { companyName: 'GEHLOT MOTORS',            personName: 'Gehlot',      mobile: '9876543211', loc: 'AJM', code: '0454'   },
    { companyName: 'P.D. MOTORS',              personName: 'P.D.',        mobile: '9876543212', loc: 'JOH', code: '3340'   },
    { companyName: 'GURJAR MOTORS',            personName: 'Gurjar',      mobile: '9876543213', loc: 'JNR', code: '5567'   },
  ];

  for (const v of vendorData) {
    const divId = divisionMap[v.loc];
    if (!divId) continue;
    await Vendor.create({
      companyName: v.companyName,
      personName: v.personName,
      accountNumber: `${v.loc}-${v.code}`,  // AJM-TRJ028
      mobileNumber: v.mobile,
      address: '',
      division: divId,
      status: 'active',
      walletBalance: 0,
      createdBy: null,
    });
    console.log(`Vendor created: ${v.loc}-${v.code}`);
  }

  console.log('\n--- Seed Complete ---');
  console.log('Admin  → developmentkontentkraftdigital@gmail.com / Admin@1234');
  console.log('Branch → mehravivek2001@gmail.com / Branch@1234');

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
