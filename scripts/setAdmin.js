const { db } = require('../firebase/admin');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

/**
 * Set a user as admin by their phone number (e.g. 251904174741)
 */
async function setAdmin(phone) {
  try {
    const email = `${phone}@gmail.com`;
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();

    if (snapshot.empty) {
      console.log(`No user found with email: ${email}`);
      return;
    }

    const userDoc = snapshot.docs[0];
    await userDoc.ref.update({ role: 'admin' });
    
    console.log(`SUCCESS: User ${email} is now an ADMIN.`);
  } catch (error) {
    console.error('Error setting admin:', error);
  }
}

// Get phone from command line
const phone = process.argv[2];
if (!phone) {
  console.log('Usage: node setAdmin.js <phone_number>');
  console.log('Example: node setAdmin.js 904174741');
} else {
  setAdmin(phone);
}
