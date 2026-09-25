const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// Path to JSON database
const DB_PATH = path.join(__dirname, 'db.json');

// Middleware for parsing JSON and form bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom CORS middleware to avoid cross-origin request issues from mobile devices/emulators
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve static files for the Admin dashboard from the public folder
app.use(express.static(path.join(__dirname, '../public')));

// ── Database Helper Functions ────────────────────────────────────────────────
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return { users: [] };
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading DB:', error);
    return { users: [] };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing DB:', error);
  }
}

// ── Custom SHA-256 Hashing Algorithm ─────────────────────────────────────────
function sha256(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106bb041,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  let asciiLength = ascii.length;
  let asciiBitLength = asciiLength * 8;
  let words = [];
  for (let i = 0; i < asciiLength; i++) {
    words[i >> 2] |= ascii.charCodeAt(i) << (24 - (i % 4) * 8);
  }
  words[asciiLength >> 2] |= 0x80 << (24 - (asciiLength % 4) * 8);
  let wordCount = ((asciiLength + 8) >> 6) * 16 + 16;
  while (words.length < wordCount) words.push(0);
  words[wordCount - 1] = asciiBitLength;

  for (let i = 0; i < wordCount; i += 16) {
    let w = [];
    for (let j = 0; j < 16; j++) w[j] = words[i + j];
    for (let j = 16; j < 64; j++) {
      let s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      let s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }
    let a = hash[0], b = hash[1], c = hash[2], d = hash[3];
    let e = hash[4], f = hash[5], g = hash[6], h = hash[7];
    for (let j = 0; j < 64; j++) {
      let S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      let ch = (e & f) ^ (~e & g);
      let temp1 = (h + S1 + ch + K[j] + w[j]) | 0;
      let S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      let maj = (a & b) ^ (a & c) ^ (b & c);
      let temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
  }
  return hash.map(val => {
    let hex = (val >>> 0).toString(16);
    return "00000000".substring(hex.length) + hex;
  }).join("");
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Authentication API Routes ────────────────────────────────────────────────

// SignUp Endpoint
app.post('/api/auth/signup', (req, res) => {
  const { firstName, lastName, email, password, role, contactNumber, idType, idNumber, idFrontUri, idBackUri } = req.body;
  
  if (!firstName || !lastName || !email || !password || !role || !contactNumber) {
    return res.status(400).json({ error: 'All primary fields are required.' });
  }

  const db = readDB();
  const existing = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  
  if (existing) {
    return res.status(400).json({ error: 'An account with this email already exists. Try logging in.' });
  }

  const newUser = {
    id: String(Date.now()),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim().toLowerCase(),
    passwordHash: sha256(password), // Store password as custom sha256 hash
    role: role,
    failedAttempts: 0,
    isVerified: false,
    mfaEnabled: false,
    mfaSecret: '',
    contactNumber: contactNumber.trim(),
    emailVerificationCode: generateCode(),
    idType: role === 'rescuer' ? idType : undefined,
    idNumber: role === 'rescuer' ? idNumber : undefined,
    isRescuerVerified: role === 'rescuer' ? false : undefined,
    idFrontUri: role === 'rescuer' ? idFrontUri : undefined,
    idBackUri: role === 'rescuer' ? idBackUri : undefined
  };

  db.users.push(newUser);
  writeDB(db);

  // Return the registration details and the mock verification code
  return res.json({
    success: true,
    email: newUser.email,
    devCode: newUser.emailVerificationCode
  });
});

// Verify Email Code Endpoint
app.post('/api/auth/verify-email', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }

  const db = readDB();
  const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());

  if (!user) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  if (user.emailVerificationCode !== code.trim()) {
    return res.status(400).json({ error: 'Incorrect verification code. Please try again.' });
  }

  user.isVerified = true;
  delete user.emailVerificationCode;
  writeDB(db);

  // If the email is verified, and the user is either a citizen OR an already-approved rescuer, log them in automatically
  if (user.role === 'citizen' || (user.role === 'rescuer' && user.isRescuerVerified === true)) {
    const token = `token-${user.id}-${Math.random().toString(36).substring(2)}`;
    const publicUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      role: user.role,
      mfaEnabled: user.mfaEnabled,
      mfaSecret: user.mfaSecret,
      contactNumber: user.contactNumber,
      idType: user.idType,
      idNumber: user.idNumber,
      isRescuerVerified: user.isRescuerVerified
    };

    const session = {
      id: `session-${user.id}-${Date.now()}`,
      loginTime: Date.now(),
      deviceInfo: 'App Connected (Live)',
      ipAddress: req.ip || '127.0.0.1',
      token: token,
      expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour
    };

    return res.json({
      success: true,
      isVerified: true,
      isRescuerVerified: user.isRescuerVerified,
      user: publicUser,
      session: session
    });
  }

  return res.json({
    success: true,
    isVerified: true,
    isRescuerVerified: user.isRescuerVerified
  });
});

// Resend Verification Code Endpoint
app.post('/api/auth/resend-code', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const db = readDB();
  const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());

  if (!user) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  user.emailVerificationCode = generateCode();
  writeDB(db);

  return res.json({
    success: true,
    devCode: user.emailVerificationCode
  });
});

// Login Endpoint
app.post('/api/auth/login', (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required.' });
  }

  const db = readDB();
  const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());

  if (!user) {
    return res.status(400).json({ error: 'Incorrect email or password. Please try again.' });
  }

  if (user.role !== role) {
    return res.status(400).json({ error: `This account is registered as a ${user.role}, not a ${role}.` });
  }

  // Rescuer approval validation
  if (user.role === 'rescuer' && user.isRescuerVerified === false) {
    return res.status(403).json({ error: 'Your rescuer account is pending verification by the admin dashboard.' });
  }

  // Password validation (client can hash or backend can hash. We hash backend here)
  const passwordHash = sha256(password);
  if (user.passwordHash !== passwordHash) {
    user.failedAttempts = (user.failedAttempts || 0) + 1;
    writeDB(db);
    return res.status(400).json({ error: 'Incorrect email or password. Please try again.' });
  }

  user.failedAttempts = 0;

  // Email verification flow trigger
  if (!user.isVerified) {
    user.emailVerificationCode = generateCode();
    writeDB(db);
    return res.json({
      requiresVerification: true,
      email: user.email,
      devCode: user.emailVerificationCode
    });
  }

  writeDB(db);

  // Success: generate session token
  const token = `token-${user.id}-${Math.random().toString(36).substring(2)}`;
  const publicUser = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    role: user.role,
    mfaEnabled: user.mfaEnabled,
    mfaSecret: user.mfaSecret,
    contactNumber: user.contactNumber,
    idType: user.idType,
    idNumber: user.idNumber,
    isRescuerVerified: user.isRescuerVerified
  };

  const session = {
    id: `session-${user.id}-${Date.now()}`,
    loginTime: Date.now(),
    deviceInfo: 'App Connected (Live)',
    ipAddress: req.ip || '127.0.0.1',
    token: token,
    expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour
  };

  return res.json({
    success: true,
    user: publicUser,
    session: session
  });
});

// Request Password Reset Endpoint
app.post('/api/auth/request-reset', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const db = readDB();
  const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());

  if (!user) {
    return res.status(404).json({ error: 'No account found for that email.' });
  }

  user.passwordResetCode = generateCode();
  writeDB(db);

  return res.json({
    success: true,
    devCode: user.passwordResetCode
  });
});

// Reset Password Endpoint
app.post('/api/auth/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const db = readDB();
  const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());

  if (!user || user.passwordResetCode !== code.trim()) {
    return res.status(400).json({ error: 'Invalid or expired recovery code.' });
  }

  user.passwordHash = sha256(newPassword);
  delete user.passwordResetCode;
  user.failedAttempts = 0;
  writeDB(db);

  return res.json({
    success: true,
    message: 'Password reset successfully.'
  });
});

// ── Admin Panel API Routes ───────────────────────────────────────────────────

// Get all registered rescuers
app.get('/api/admin/rescuers', (req, res) => {
  const db = readDB();
  const rescuers = db.users
    .filter(u => u.role === 'rescuer')
    .map(u => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      contactNumber: u.contactNumber,
      idType: u.idType,
      idNumber: u.idNumber,
      isRescuerVerified: u.isRescuerVerified,
      isVerified: u.isVerified,
      idFrontUri: u.idFrontUri,
      idBackUri: u.idBackUri
    }));
  return res.json(rescuers);
});

// Approve a rescuer
app.post('/api/admin/rescuers/:id/approve', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const user = db.users.find(u => u.id === id && u.role === 'rescuer');

  if (!user) {
    return res.status(404).json({ error: 'Rescuer account not found.' });
  }

  user.isRescuerVerified = true;
  writeDB(db);

  return res.json({ success: true, message: `Rescuer ${user.firstName} approved successfully.` });
});

// Reject/Revoke a rescuer verification
app.post('/api/admin/rescuers/:id/reject', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const user = db.users.find(u => u.id === id && u.role === 'rescuer');

  if (!user) {
    return res.status(404).json({ error: 'Rescuer account not found.' });
  }

  user.isRescuerVerified = false;
  writeDB(db);

  return res.json({ success: true, message: `Rescuer ${user.firstName} status set to rejected/pending.` });
});

// Fetch general dashboard statistics
app.get('/api/admin/stats', (req, res) => {
  const db = readDB();
  const totalCitizens = db.users.filter(u => u.role === 'citizen').length;
  const rescuers = db.users.filter(u => u.role === 'rescuer');
  const totalRescuers = rescuers.length;
  const pendingRescuers = rescuers.filter(u => u.isRescuerVerified === false).length;
  const approvedRescuers = rescuers.filter(u => u.isRescuerVerified === true).length;

  return res.json({
    totalCitizens,
    totalRescuers,
    pendingRescuers,
    approvedRescuers
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running smoothly at http://localhost:${PORT}`);
});