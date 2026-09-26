/**
 * LOCAL TESTING ONLY — list logins, or set a password, in the ftc_test copy.
 * Refuses to run against any other database, so it can never touch live data.
 *
 *   node scripts/set-test-password.js                      → list all logins
 *   node scripts/set-test-password.js <email> <password>   → set that login's password
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
require('../src/models/Division');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const dbName = mongoose.connection.name;
  if (dbName !== 'ftc_test') {
    console.error(`Refusing to run: connected to "${dbName}". This script only works on the ftc_test copy.`);
    process.exit(1);
  }

  const [email, password] = process.argv.slice(2);
  if (!email) {
    const users = await User.find().populate('division', 'name').sort({ role: 1, name: 1 }).lean();
    console.log(`\nLogins in ${dbName}:\n`);
    users.forEach((u) =>
      console.log(`  ${u.role.padEnd(7)} ${String(u.division?.name || '-').padEnd(5)} ${u.email}${u.isActive ? '' : '  (inactive)'}`)
    );
    console.log('\nTo set a password: node scripts/set-test-password.js <email> <new-password>\n');
  } else {
    if (!password || password.length < 8) { console.error('Password must be at least 8 characters'); process.exit(1); }
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) { console.error(`No login found for ${email}`); process.exit(1); }
    user.password = password; // hashed automatically on save
    await user.save();
    console.log(`Password set for ${user.email} (${user.role}) in ${dbName}.`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
