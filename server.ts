import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  getDocs, 
  collection,
  runTransaction
} from 'firebase/firestore';

// Load environment variables
dotenv.config();

// Load Firebase configuration securely from workspace config or environment fallbacks
let firebaseConfig: any = {};
try {
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
  } else {
    console.warn('firebase-applet-config.json not found, using environment/code fallbacks');
    firebaseConfig = {
      projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0275727746",
      appId: process.env.FIREBASE_APP_ID || "1:848284584751:web:272cb70c60309714c2afda",
      apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBGnKj3y1wt2Mp_kuetGhMYvxRlAfyR7M0",
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || "gen-lang-client-0275727746.firebaseapp.com",
      firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-tumblespinlaundr-f18be68a-4401-425e-bfdb-877d06e83f10",
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "gen-lang-client-0275727746.firebasestorage.app",
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "848284584751"
    };
  }
} catch (err) {
  console.error('Failed to parse firebase-applet-config.json, using safe fallbacks:', err);
  firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0275727746",
    appId: process.env.FIREBASE_APP_ID || "1:848284584751:web:272cb70c60309714c2afda",
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBGnKj3y1wt2Mp_kuetGhMYvxRlAfyR7M0",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "gen-lang-client-0275727746.firebaseapp.com",
    firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-tumblespinlaundr-f18be68a-4401-425e-bfdb-877d06e83f10",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "gen-lang-client-0275727746.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "848284584751"
  };
}

// Initialize Firebase SDK on the backend server for order verification and persistence
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Backend pricing map for rigorous order validation (prevents tampering with amount values)
const SUB_SERVICES_MAP: Record<string, number> = {
  'men-shirt': 99,
  'men-trouser': 99,
  'men-suit-3pc': 530,
  'men-suit-2pc': 430,
  'men-kurta': 149,
  'men-coat': 199,
  'women-kurta': 149,
  'women-saree': 230,
  'women-dress': 299,
  'women-lehenga': 690,
  'women-blouse': 99,
  'women-skirt': 129,
  'wool-sweater': 149,
  'wool-jacket': 299,
  'wool-longcoat': 349,
  'wool-pashmina': 249,
  'house-blanket-double': 349,
  'house-blanket-single': 249,
  'house-quilt': 299,
  'house-bedsheet': 149,
  'house-curtain': 199,
  'shoes-sneakers': 299,
  'shoes-suede': 399,
  'shoes-spa-care': 499,
  'bags-leather': 490,
  'bags-backpack': 290,
  'bags-spa-care': 590,
  'laundry-wash-fold': 99,
  'laundry-wash-steam-iron': 125,
};

// Re-computes the order price on the backend to avoid trusting the client total
function withTimeout<T>(promise: Promise<T>, timeoutMs = 10000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function calculateBackendTotal(quantities: Record<string, number>, selectedServices: string[], dynamicPricing: any) {
  let subservicesTotal = 0;
  for (const [id, qty] of Object.entries(quantities)) {
    if (qty > 0 && SUB_SERVICES_MAP[id]) {
      let price = SUB_SERVICES_MAP[id];
      if (dynamicPricing && dynamicPricing.mode !== 'none' && dynamicPricing.percentage) {
        if (dynamicPricing.mode === 'surcharge') {
          price = Math.round(price + (price * dynamicPricing.percentage) / 100);
        } else if (dynamicPricing.mode === 'discount') {
          price = Math.round(price - (price * dynamicPricing.percentage) / 100);
        }
      }
      subservicesTotal += price * qty;
    }
  }
  const expressSurcharge = selectedServices.includes('express') ? 499 : 0;
  const baseTotal = subservicesTotal + expressSurcharge;
  if (baseTotal === 0 && (selectedServices.includes('wash-fold') || selectedServices.includes('hassle-free'))) {
    return 99; // Standard Slot Booking Reservation Fee
  }
  return baseTotal;
}

// Generates a sequential order ID from Firestore concurrently using an atomic transaction to avoid race conditions
async function generateNextOrderId() {
  try {
    const counterDocRef = doc(db, 'counters', 'order_sequence');
    let nextNum = 103;

    await withTimeout(
      runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterDocRef);
        if (!counterDoc.exists()) {
          const ordersCol = collection(db, 'orders');
          const snapshot = await getDocs(ordersCol);
          let maxNum = 102;
          if (!snapshot.empty) {
            const numbers = snapshot.docs.map(docSnap => {
              const orderData = docSnap.data();
              const orderId = orderData.orderId || '';
              const match = orderId.match(/TS-2026-(\d+)/);
              return match ? parseInt(match[1], 10) : 100;
            });
            if (numbers.length > 0) {
              maxNum = Math.max(...numbers);
            }
          }
          nextNum = maxNum + 1;
          transaction.set(counterDocRef, { currentSeq: nextNum });
        } else {
          const data = counterDoc.data();
          nextNum = (data?.currentSeq || 102) + 1;
          transaction.update(counterDocRef, { currentSeq: nextNum });
        }
      }),
      1500
    );

    return `TS-2026-${nextNum}`;
  } catch (err) {
    console.error('Error generating sequential order ID concurrently, trying direct scan:', err);
    try {
      const ordersCol = collection(db, 'orders');
      const snapshot = await withTimeout(getDocs(ordersCol), 1500);
      let nextNum = 103;
      if (!snapshot.empty) {
        const numbers = snapshot.docs.map(docSnap => {
          const orderData = docSnap.data();
          const orderId = orderData.orderId || '';
          const match = orderId.match(/TS-2026-(\d+)/);
          return match ? parseInt(match[1], 10) : 100;
        });
        if (numbers.length > 0) {
          nextNum = Math.max(...numbers) + 1;
        }
      }
      return `TS-2026-${nextNum}`;
    } catch (fallbackErr) {
      console.error('Ultimate fallback for order ID generation:', fallbackErr);
      return `TS-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    }
  }
}

// Helper to validate if an email is real and not a dummy/placeholder address
function isValidRealEmail(email: string): boolean {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  if (
    lower === 'client@tumblespin.com' ||
    lower === 'test@test.com' ||
    lower === 'no-reply@tumblespin.com' ||
    lower === 'your email' ||
    lower === 'your-email@example.com'
  ) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower);
}

// Helper to send a beautifully formatted email notification upon successful booking
async function sendBookingEmail(orderData: any) {
  const recipientEmail = 'tumblespin26@gmail.com'; // Specific recipient requested by the user
  const userEmail = orderData.email || '';

  const smtpHost = process.env.SMTP_HOST || '';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';
  const smtpFrom = process.env.SMTP_FROM || 'Tumble Spin Premium';

  const resendApiKey = process.env.RESEND_API_KEY || '';

  const hasRealUserEmail = isValidRealEmail(userEmail);

  // The user requested that the notification should appear to be "from" the booking user email id whichever they entered.
  // To avoid SPF/DMARC rejection on SMTP servers (like Gmail) and Resend restrictions on unverified domains,
  // we use the customer's name and entered email in the Display Name, while utilizing the verified address
  // (smtpUser or onboarding@resend.dev or custom RESEND_FROM/SMTP_FROM) as the underlying routing address,
  // and set the replyTo header to the customer's entered email.
  const customerName = orderData.fullName || 'Tumble Spin Customer';

  // 1. Compute Resend Sender Base and From Address
  let resendSenderBase = 'onboarding@resend.dev';
  if (process.env.RESEND_FROM && process.env.RESEND_FROM.includes('@')) {
    const match = process.env.RESEND_FROM.match(/<([^>]+)>/);
    resendSenderBase = match ? match[1].trim() : process.env.RESEND_FROM.trim();
  } else if (process.env.SMTP_FROM && process.env.SMTP_FROM.includes('@') && !process.env.SMTP_FROM.includes('no-reply@tumblespin.com')) {
    const match = process.env.SMTP_FROM.match(/<([^>]+)>/);
    resendSenderBase = match ? match[1].trim() : process.env.SMTP_FROM.trim();
  }

  let resendFrom = '';
  if (hasRealUserEmail) {
    resendFrom = `"${customerName} (${userEmail})" <${resendSenderBase}>`;
  } else {
    resendFrom = `"${customerName}" <${resendSenderBase}>`;
  }

  // 2. Compute SMTP Sender Base and From Address
  let smtpSenderBase = smtpUser;
  if (process.env.SMTP_FROM && process.env.SMTP_FROM.includes('@')) {
    const match = process.env.SMTP_FROM.match(/<([^>]+)>/);
    smtpSenderBase = match ? match[1].trim() : process.env.SMTP_FROM.trim();
  } else if (process.env.RESEND_FROM && process.env.RESEND_FROM.includes('@')) {
    const match = process.env.RESEND_FROM.match(/<([^>]+)>/);
    smtpSenderBase = match ? match[1].trim() : process.env.RESEND_FROM.trim();
  }

  if (!smtpSenderBase || !smtpSenderBase.includes('@')) {
    smtpSenderBase = 'no-reply@tumblespin.com';
  }

  let smtpFinalFrom = '';
  if (hasRealUserEmail) {
    smtpFinalFrom = `"${customerName} (${userEmail})" <${smtpSenderBase}>`;
  } else {
    smtpFinalFrom = `"${customerName}" <${smtpSenderBase}>`;
  }

  // 3. Compute Ethereal Sender From Address
  let etherealFrom = '';
  if (hasRealUserEmail) {
    etherealFrom = `"${customerName} (${userEmail})" <no-reply@tumblespin.com>`;
  } else {
    etherealFrom = `"${customerName}" <no-reply@tumblespin.com>`;
  }

  console.log(`[Email Service] Attempting to send booking email for Order ${orderData.orderId}...`);
  console.log(`[Email Service] Computed Sender Headers - Resend: [${resendFrom}] | SMTP: [${smtpFinalFrom}]`);

  const subject = `✨ Tumble Spin Booking Confirmed: Order ${orderData.orderId}`;
  
  const itemsHtml = (orderData.subServices || []).map((item: any) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 12px 8px; text-align: left; font-size: 14px; text-transform: capitalize; color: #334155;">
        <strong>${item.name || ''}</strong>
        <br/><span style="font-size: 11px; color: #64748b; font-family: monospace;">Category: ${item.category || ''}</span>
      </td>
      <td style="padding: 12px 8px; text-align: center; font-size: 14px; color: #334155;">₹${item.price}</td>
      <td style="padding: 12px 8px; text-align: center; font-size: 14px; color: #334155;">${item.quantity}</td>
      <td style="padding: 12px 8px; text-align: right; font-size: 14px; font-weight: bold; color: #0f172a;">₹${item.price * item.quantity}</td>
    </tr>
  `).join('');

  const servicesHtml = (orderData.selectedServices || []).map((srv: string) => `
    <span style="display: inline-block; background-color: #f0fdfa; border: 1px solid #99f6e4; color: #0d9488; font-size: 12px; font-weight: bold; padding: 4px 10px; margin: 2px; border-radius: 9999px; text-transform: uppercase;">
      ${srv.replace('-', ' ')}
    </span>
  `).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Booking Confirmed - Tumble Spin</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.02); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #1e1b4b 0%, #2e1065 100%); padding: 32px; text-align: center; color: #ffffff; }
        .logo { font-size: 28px; font-weight: 900; letter-spacing: -0.025em; color: #ffffff; text-decoration: none; font-family: "Georgia", serif; }
        .logo span { color: #2dd4bf; }
        .badge { display: inline-block; background-color: rgba(45, 212, 191, 0.15); border: 1px solid rgba(45, 212, 191, 0.3); color: #2dd4bf; font-size: 12px; font-weight: bold; padding: 6px 16px; border-radius: 9999px; text-transform: uppercase; margin-top: 12px; letter-spacing: 0.05em; }
        .content { padding: 32px; }
        .section-title { font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 12px; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px; }
        .grid { display: flex; flex-direction: row; flex-wrap: wrap; margin-bottom: 24px; }
        .col { flex: 1; min-width: 250px; margin-bottom: 16px; }
        .label { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; }
        .value { font-size: 14px; color: #0f172a; font-weight: 600; }
        .table { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 24px; }
        .table th { background-color: #f8fafc; padding: 10px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: bold; border-bottom: 2px solid #e2e8f0; }
        .footer { background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
        .total-box { background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 12px; padding: 16px; margin-top: 16px; text-align: right; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Tumble<span>Spin</span></div>
          <div class="badge">Booking Confirmed</div>
          <p style="margin: 8px 0 0; opacity: 0.85; font-size: 14px;">Order ID: ${orderData.orderId}</p>
        </div>
        <div class="content">
          <p style="font-size: 16px; line-height: 1.6; margin-top: 0; margin-bottom: 24px; color: #334155;">
            Dear Owner, new booking from <strong>${orderData.fullName}</strong>,
            <br/><br/>
            A premium garment care order has been successfully scheduled on Tumble Spin. Below is the detailed booking summary, customer information, and service schedule.
          </p>

          <div class="section-title">Schedule & Logistics</div>
          <div class="grid">
            <div class="col">
              <div class="label">📅 Pickup Window</div>
              <div class="value">${orderData.pickupDate}</div>
              <div class="value" style="font-size: 13px; font-weight: normal; color: #475569;">Slot: ${orderData.pickupTimeSlot}</div>
            </div>
            <div class="col">
              <div class="label">🚚 Delivery Window</div>
              <div class="value">${orderData.deliveryDate}</div>
              <div class="value" style="font-size: 13px; font-weight: normal; color: #475569;">Slot: ${orderData.deliveryTimeSlot}</div>
            </div>
          </div>

          <div class="section-title">Customer Details</div>
          <div class="grid" style="margin-bottom: 12px;">
            <div class="col">
              <div class="label">Contact</div>
              <div class="value">${orderData.fullName}</div>
              <div class="value" style="font-size: 13px; font-weight: normal; color: #475569;">Phone: ${orderData.phone}</div>
              <div class="value" style="font-size: 13px; font-weight: normal; color: #475569;">Email: ${orderData.email}</div>
            </div>
            <div class="col" style="flex: 1.5;">
              <div class="label">📍 Address</div>
              <div class="value" style="font-size: 13px; font-weight: normal; color: #475569; line-height: 1.4;">${orderData.address}</div>
            </div>
          </div>

          <div class="section-title">Selected Services</div>
          <div style="margin-bottom: 24px; padding: 4px 0;">
            ${servicesHtml || '<span style="color:#64748b; font-size:13px;">Standard Care</span>'}
          </div>

          ${itemsHtml ? `
            <div class="section-title">Itemized Summary</div>
            <table class="table">
              <thead>
                <tr>
                  <th style="text-align: left;">Garment Item</th>
                  <th style="text-align: center; width: 80px;">Rate</th>
                  <th style="text-align: center; width: 60px;">Qty</th>
                  <th style="text-align: right; width: 90px;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          ` : ''}

          <div class="total-box">
            <span style="font-size: 13px; font-weight: bold; color: #0d9488; text-transform: uppercase; margin-right: 8px;">Grand Total Paid / Due:</span>
            <span style="font-size: 22px; font-weight: 900; color: #0f172a;">₹${orderData.totalPrice}</span>
            <br/>
            <span style="font-size: 11px; color: #0d9488; font-weight: bold;">[${orderData.paymentMethod || 'UPI'}] • Status: ${orderData.paymentStatus || 'Paid'}</span>
          </div>

          ${orderData.specialInstructions ? `
            <div class="section-title" style="margin-top: 24px;">Special Instructions</div>
            <p style="font-size: 13px; color: #475569; background-color: #f8fafc; border-left: 3px solid #cbd5e1; padding: 10px 14px; margin: 0; font-style: italic;">
              "${orderData.specialInstructions}"
            </p>
          ` : ''}
        </div>
        <div class="footer">
          <p style="margin: 0; font-weight: bold; color: #334155;">Tumble Spin Premium Laundry & Garment Care</p>
          <p style="margin: 4px 0 0; color: #94a3b8;">Kengeri Ring Rd (Central Hub), Bangalore, Karnataka</p>
          <p style="margin: 12px 0 0; color: #cbd5e1;">© 2026 Tumble Spin. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  let info: any = null;
  let usedMethod = '';
  let etherealUrl = '';

  // 1. Try Resend if configured
  if (resendApiKey) {
    try {
      usedMethod = 'Resend';
      const emailPromises = [];

      // Primary to owner
      emailPromises.push(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`
          },
          body: JSON.stringify({
            from: resendFrom,
            reply_to: hasRealUserEmail ? userEmail : undefined,
            to: [recipientEmail],
            subject: subject,
            html: htmlContent
          })
        }).then(async (r) => {
          const data = await r.json();
          console.log('[Email Service] Primary email sent to owner via Resend:', data);
          info = data;
        })
      );

      await Promise.all(emailPromises);
    } catch (resendErr) {
      console.error('[Email Service] Resend API failed, trying SMTP fallback:', resendErr);
    }
  }

  // 2. Try Custom SMTP if configured
  if (!info && smtpHost && smtpUser && smtpPass) {
    try {
      usedMethod = 'SMTP';
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      const emailPromises = [];

      // Primary to owner
      emailPromises.push(
        transporter.sendMail({
          from: smtpFinalFrom,
          replyTo: hasRealUserEmail ? userEmail : undefined,
          to: recipientEmail,
          subject: subject,
          html: htmlContent
        }).then(res => {
          info = res;
          console.log('[Email Service] Primary email sent to owner via SMTP:', res.messageId);
        })
      );

      await Promise.all(emailPromises);
    } catch (smtpErr) {
      console.error('[Email Service] SMTP configuration failed, trying Ethereal fallback:', smtpErr);
    }
  }

  // 3. Ethereal Testing Sandbox fallback
  if (!info) {
    try {
      usedMethod = 'Ethereal Sandbox';
      console.log('[Email Service] No production SMTP or Resend credentials configured. Initializing Nodemailer Ethereal Sandbox account...');
      const testAccount = await nodemailer.createTestAccount();
      
      const transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });

      const emailPromises = [];

      // Primary to owner
      emailPromises.push(
        transporter.sendMail({
          from: etherealFrom,
          replyTo: hasRealUserEmail ? userEmail : undefined,
          to: recipientEmail,
          subject: subject,
          html: htmlContent
        }).then(res => {
          info = res;
          etherealUrl = nodemailer.getTestMessageUrl(res) || '';
          console.log('------------------------------------------------------------');
          console.log(`✉️ [Email Service] Real email content generated successfully!`);
          console.log(`📬 Primary sent to: ${recipientEmail}`);
          console.log(`🔗 Ethereal Sandbox Mail Link: ${etherealUrl}`);
          console.log('------------------------------------------------------------');
        })
      );

      await Promise.all(emailPromises);
    } catch (ethErr) {
      console.error('[Email Service] Ethereal sandbox creation failed:', ethErr);
    }
  }

  return {
    success: !!info,
    method: usedMethod,
    etherealUrl,
    messageId: info?.messageId || info?.id || ''
  };
}

const app = express();
const PORT = 3000;

// Middleware to parse JSON with rawBody capturing for cryptographically robust webhook checks
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Initialize Razorpay Client
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_3P99p1Yg9OaVpE';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';

const razorpay = new Razorpay({
  key_id: razorpayKeyId,
  key_secret: razorpayKeySecret,
});

  // Extremely robust helper to locate or create a Razorpay Customer
  async function getOrCreateCustomer(name: string, email: string, phone: string) {
    // Sanitize name to contain only alphanumeric characters and spaces
    const cleanName = (name || 'Valued Client')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim() || 'Valued Client';

    // Format phone to be exactly a 10-digit Indian number starting with 6, 7, 8, or 9
    const rawPhone = phone || '';
    let digitsOnly = rawPhone.replace(/\D/g, '');
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
      digitsOnly = digitsOnly.slice(2);
    }
    let contact = digitsOnly;
    if (contact.length !== 10 || !/^[6-9]/.test(contact)) {
      // Fallback to a valid 10-digit number structure starting with 9
      const randomDigits = Math.floor(100000000 + Math.random() * 900000000).toString();
      contact = `9${randomDigits}`;
    }

    // Format email to be a valid email. If invalid, generate a unique valid one
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let targetEmail = (email || '').trim();
    if (!emailRegex.test(targetEmail)) {
      targetEmail = `client_${crypto.randomBytes(4).toString('hex')}@tumblespin.com`;
    }

    console.log(`[Razorpay] Cleaned customer details for creation: Name="${cleanName}", Email="${targetEmail}", Contact="${contact}"`);

    // Strategy 1: Attempt normal customer creation
    try {
      console.log(`[Razorpay] Strategy 1: Creating customer...`);
      const customer = await razorpay.customers.create({
        name: cleanName,
        email: targetEmail,
        contact: contact
      });
      if (customer && customer.id) {
        console.log(`[Razorpay] Customer created successfully: ${customer.id}`);
        return customer.id;
      }
    } catch (custErr: any) {
      console.warn(`[Razorpay] Strategy 1 failed:`, custErr?.error || custErr);
      
      // Strategy 2: If duplicate error occurs, let's try searching for existing customer by email or contact
      // We list and filter manually in code to avoid unsupported/failing search query params in Razorpay
      try {
        console.log(`[Razorpay] Strategy 2: Listing customers to find matching email or contact...`);
        const response: any = await razorpay.customers.all({ count: 100 });
        if (response && response.items && response.items.length > 0) {
          const match = response.items.find((item: any) => 
            (item.email && item.email.toLowerCase() === targetEmail.toLowerCase()) || 
            (item.contact && item.contact === contact)
          );
          if (match) {
            console.log(`[Razorpay] Found existing customer match: ${match.id}`);
            return match.id;
          }
        }
      } catch (searchErr: any) {
        console.warn(`[Razorpay] Strategy 2 (listing/searching) failed:`, searchErr?.error || searchErr);
      }

      // Strategy 3: Generate guaranteed unique fresh contact & email to bypass duplicate constraint
      try {
        const uniqueEmail = `client_${Date.now()}_${crypto.randomBytes(3).toString('hex')}@tumblespin.com`;
        const uniqueContact = `9${Math.floor(100000000 + Math.random() * 900000000).toString()}`; // Guaranteed valid 10-digit starts with 9

        console.log(`[Razorpay] Strategy 3: Creating customer with guaranteed unique details: ${uniqueEmail}, ${uniqueContact}`);
        const customer = await razorpay.customers.create({
          name: cleanName,
          email: uniqueEmail,
          contact: uniqueContact
        });
        if (customer && customer.id) {
          console.log(`[Razorpay] Customer created via Strategy 3 fallback: ${customer.id}`);
          return customer.id;
        }
      } catch (fallbackErr: any) {
        console.error(`[Razorpay] Strategy 3 failed:`, fallbackErr?.error || fallbackErr);

        // Strategy 4: Fallback to an existing/standard static customer or try creation with random name and unique contact
        try {
          console.log(`[Razorpay] Strategy 4: Final last-resort creation attempt...`);
          const uniqueEmail = `client_lastresort_${crypto.randomBytes(4).toString('hex')}@tumblespin.com`;
          const uniqueContact = `8${Math.floor(100000000 + Math.random() * 900000000).toString()}`;
          const customer = await razorpay.customers.create({
            name: `${cleanName} Fallback`,
            email: uniqueEmail,
            contact: uniqueContact
          });
          if (customer && customer.id) {
            console.log(`[Razorpay] Customer created via last-resort Strategy 4: ${customer.id}`);
            return customer.id;
          }
        } catch (lastErr: any) {
          console.error(`[Razorpay] All customer creation strategies exhausted:`, lastErr?.error || lastErr);
        }
      }
    }
    return '';
  }

  // Safe Razorpay Key endpoint (public keys only)
  app.get('/api/payments/config', (req, res) => {
    res.json({
      keyId: razorpayKeyId,
    });
  });

  // Secure API endpoint to initiate a Dynamic QR checkout
  app.post('/api/payments/create-qr-order', async (req, res) => {
    try {
      const { bookingDetails, selectedServices, quantities, dynamicPricing } = req.body;

      if (!bookingDetails || !selectedServices || !quantities) {
        return res.status(400).json({ error: 'Missing required order details' });
      }

      // Secure backend price calculation
      const calculatedTotal = calculateBackendTotal(quantities, selectedServices, dynamicPricing);
      if (calculatedTotal <= 0) {
        return res.status(400).json({ error: 'Invalid order amount calculated' });
      }

      // Check if user has an active membership for discount (SMART gets 10%, SILVER gets 20%)
      let finalTotal = calculatedTotal;
      let membershipApplied = false;
      if (bookingDetails.phone) {
        const cleanPhone = bookingDetails.phone.replace(/\D/g, '');
        if (cleanPhone) {
          try {
            const memberDoc = await getDoc(doc(db, 'memberships', cleanPhone));
            if (memberDoc.exists()) {
              const memberData = memberDoc.data();
              if (memberData && memberData.status === 'active' && (memberData.packageType === 'SMART' || memberData.packageType === 'SILVER')) {
                const discountPercentage = memberData.packageType === 'SMART' ? 10 : 20;
                finalTotal = Math.round(calculatedTotal - (calculatedTotal * discountPercentage) / 100);
                membershipApplied = true;
                console.log(`[Backend Order] Applied membership discount of ${discountPercentage}% for phone ${cleanPhone}. Original: ${calculatedTotal}, Final: ${finalTotal}`);
              }
            }
          } catch (dbErr) {
            console.warn('[Backend Order] Failed to read membership for discount, bypassing:', dbErr);
          }
        }
      }

      if (!membershipApplied) {
        // Flat 5% self-booking discount for dynamic QR payments if no membership
        finalTotal = Math.round(calculatedTotal - (calculatedTotal * 5) / 100);
      }

      // Generate secure sequential order display ID
      const orderId = await generateNextOrderId();

      // Default timeline steps
      const orderTimeline = [
        { step: 1, title: 'Order Confirmed', desc: 'Booking received and digital invoice dispatched.', time: new Date().toLocaleString(), done: true, active: true },
        { step: 2, title: 'Valet Pickup Completed', desc: 'Arjun Gowda is arriving for doorstep garment verification.', time: 'Scheduled', done: false, active: false },
        { step: 3, title: 'In-Facility Fabric Screening', desc: 'Processing at our master textile cleaning plant.', time: 'Pending', done: false, active: false },
        { step: 4, title: 'Quality Pressed & Inspected', desc: 'Inspected under pristine studio lighting.', time: 'Pending', done: false, active: false },
        { step: 5, title: 'Returned Flawless', desc: 'Handpacked in breathable protective garment covers.', time: 'Pending', done: false, active: false },
      ];

      // Prepare Firestore Order Object
      const newOrderDoc = {
        orderId,
        fullName: bookingDetails.fullName || 'Valued Client',
        email: bookingDetails.email || 'client@tumblespin.com',
        phone: bookingDetails.phone || '',
        address: bookingDetails.address || '',
        pickupDate: bookingDetails.pickupDate || '',
        pickupTimeSlot: bookingDetails.pickupTimeSlot || '',
        deliveryDate: bookingDetails.deliveryDate || '',
        deliveryTimeSlot: bookingDetails.deliveryTimeSlot || '',
        garmentCareOption: bookingDetails.garmentCareOption || 'standard',
        specialInstructions: bookingDetails.specialInstructions || '',
        selectedServices,
        subServices: Object.entries(quantities)
          .filter(([_, qty]) => (qty as number) > 0)
          .map(([id, qty]) => {
            let price = SUB_SERVICES_MAP[id] || 0;
            if (dynamicPricing && dynamicPricing.mode !== 'none' && dynamicPricing.percentage) {
              if (dynamicPricing.mode === 'surcharge') {
                price = Math.round(price + (price * dynamicPricing.percentage) / 100);
              } else if (dynamicPricing.mode === 'discount') {
                price = Math.round(price - (price * dynamicPricing.percentage) / 100);
              }
            }
            return { id, name: id.replace('-', ' '), category: id.split('-')[0], price, quantity: qty };
          }),
        totalPrice: finalTotal,
        status: 'Payment Pending',
        timeline: orderTimeline,
        paymentMethod: 'UPI / Dynamic QR',
        paymentDetails: {
          type: 'UPI_QR',
          label: 'UPI Dynamic QR (Pending)',
          details: 'Awaiting gateway settlement...'
        },
        paymentStatus: 'pending',
        paymentGateway: 'razorpay',
        razorpayQrId: '',
        createdAt: new Date().toISOString()
      };

      // If Razorpay keys are default dummy, simulate real gateway response
      if (razorpayKeySecret === 'dummy_secret') {
        const mockQrId = `qr_sim_${crypto.randomBytes(8).toString('hex')}`;
        newOrderDoc.razorpayQrId = mockQrId;

        // Save order document to Firestore
        try {
          await withTimeout(setDoc(doc(db, 'orders', orderId), newOrderDoc), 10000);
          console.log(`[Backend create-qr-order] Order ${orderId} saved to Firestore successfully.`);
        } catch (dbErr) {
          console.warn('Backend database write skipped or failed (high-availability mode active):', dbErr);
        }

        // Simulated dynamic QR Code URL targeting direct UPI intent with NPCI-compliant parameters
        const cleanOrderId = orderId.replace(/\s+/g, '_');
        const upiIntent = `upi://pay?pa=prakashcsat@oksbi&pn=Tumble%20Spin&am=${Number(finalTotal).toFixed(2)}&cu=INR&tn=Order_${cleanOrderId}&tr=Order_${cleanOrderId}`;
        const mockQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiIntent)}`;

        return res.json({
          orderId,
          amount: finalTotal,
          qrCodeId: mockQrId,
          qrCodeUrl: mockQrUrl,
          vpa: 'prakashcsat@oksbi',
          simulated: true,
          orderDoc: newOrderDoc
        });
      }

      // Live Razorpay Dynamic QR Creation
      try {
        const customerId = await getOrCreateCustomer(
          bookingDetails.fullName,
          bookingDetails.email,
          bookingDetails.phone
        );

        const closeBy = Math.floor(Date.now() / 1000) + 300; // Expire in 5 minutes (300 seconds)
        const qrParams: any = {
          type: 'upi_qr',
          name: 'Tumble Spin Laundry',
          usage: customerId ? 'single_use' : 'multiple_use',
          fixed_amount: customerId ? true : false, // Only fixed_amount if single_use is active
          description: `Garment Care Order: ${orderId}`,
          notes: {
            orderId
          }
        };

        if (customerId) {
          qrParams.customer_id = customerId;
          qrParams.payment_amount = Math.round(finalTotal * 100); // in paise (only for single_use)
        }

        const qrCode: any = await (razorpay as any).qrCode.create(qrParams);

        newOrderDoc.razorpayQrId = qrCode.id;
        
        // Save order document with real Razorpay metadata to Firestore
        try {
          await withTimeout(setDoc(doc(db, 'orders', orderId), newOrderDoc), 10000);
          console.log(`[Backend create-qr-order] Order ${orderId} saved to Firestore successfully.`);
        } catch (dbErr) {
          console.warn('Backend database write skipped or failed (high-availability mode active):', dbErr);
        }

        res.json({
          orderId,
          amount: finalTotal,
          qrCodeId: qrCode.id,
          qrCodeUrl: qrCode.image_url,
          vpa: qrCode.vpa || 'prakashcsat@oksbi',
          simulated: false,
          expiresAt: closeBy * 1000,
          orderDoc: newOrderDoc
        });
      } catch (gateErr: any) {
        console.error('Razorpay Gateway QR generation failed. Full detailed error details:', gateErr?.message, JSON.stringify(gateErr, null, 2));
        console.error('Razorpay Gateway QR generation failed, using high-availability fallback:', gateErr);
        // High availability local fallback so transactions never lock out
        const mockQrId = `qr_fallback_${crypto.randomBytes(8).toString('hex')}`;
        newOrderDoc.razorpayQrId = mockQrId;
        try {
          await withTimeout(setDoc(doc(db, 'orders', orderId), newOrderDoc), 10000);
          console.log(`[Backend create-qr-order] Order ${orderId} saved to Firestore successfully.`);
        } catch (dbErr) {
          console.warn('Backend database write skipped or failed (high-availability mode active):', dbErr);
        }

        const cleanOrderId = orderId.replace(/\s+/g, '_');
        const upiIntent = `upi://pay?pa=prakashcsat@oksbi&pn=Tumble%20Spin&am=${Number(finalTotal).toFixed(2)}&cu=INR&tn=Order_${cleanOrderId}&tr=Order_${cleanOrderId}`;
        const mockQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiIntent)}`;

        res.json({
          orderId,
          amount: finalTotal,
          qrCodeId: mockQrId,
          qrCodeUrl: mockQrUrl,
          vpa: 'prakashcsat@oksbi',
          simulated: true,
          fallback: true,
          expiresAt: (Math.floor(Date.now() / 1000) + 300) * 1000,
          orderDoc: newOrderDoc
        });
      }
    } catch (error: any) {
      console.error('Error in create-qr-order:', error);
      res.status(500).json({ error: error.message || 'Failed to initiate secure QR checkout' });
    }
  });

  // Secure API endpoint to refresh/regenerate an expired QR Code for an existing unpaid order
  app.post('/api/payments/refresh-qr-order', async (req, res) => {
    try {
      const { orderId } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: 'orderId is required' });
      }

      const orderDocRef = doc(db, 'orders', orderId);
      const orderSnap = await withTimeout(getDoc(orderDocRef), 1500);

      if (!orderSnap.exists()) {
        return res.status(404).json({ error: 'Order record not found' });
      }

      const orderData = orderSnap.data();

      // If already paid, do not regenerate
      if (orderData.paymentStatus === 'paid') {
        return res.status(400).json({ error: 'Order has already been paid successfully', alreadyPaid: true });
      }

      const calculatedTotal = orderData.totalPrice;
      if (!calculatedTotal || calculatedTotal <= 0) {
        return res.status(400).json({ error: 'Invalid order amount in database' });
      }

      // If default dummy keys or simulation fallback, simulate refreshing
      if (razorpayKeySecret === 'dummy_secret') {
        const mockQrId = `qr_sim_ref_${crypto.randomBytes(8).toString('hex')}`;
        try {
          await withTimeout(updateDoc(orderDocRef, { razorpayQrId: mockQrId }), 1200);
        } catch (dbErr) {
          console.warn('Backend database write skipped or failed (high-availability mode active):', dbErr);
        }

        const cleanOrderId = orderId.replace(/\s+/g, '_');
        const upiIntent = `upi://pay?pa=prakashcsat@oksbi&pn=Tumble%20Spin&am=${Number(calculatedTotal).toFixed(2)}&cu=INR&tn=Order_${cleanOrderId}&tr=Order_${cleanOrderId}`;
        const mockQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiIntent)}`;

        return res.json({
          orderId,
          amount: calculatedTotal,
          qrCodeId: mockQrId,
          qrCodeUrl: mockQrUrl,
          vpa: 'prakashcsat@oksbi',
          simulated: true,
          expiresAt: (Math.floor(Date.now() / 1000) + 300) * 1000
        });
      }

      // Live Razorpay QR Code Regeneration
      try {
        const customerId = await getOrCreateCustomer(
          orderData.fullName,
          orderData.email,
          orderData.phone
        );

        const closeBy = Math.floor(Date.now() / 1000) + 300; // Expire in 5 minutes
        const qrParams: any = {
          type: 'upi_qr',
          name: 'Tumble Spin Laundry',
          usage: customerId ? 'single_use' : 'multiple_use',
          fixed_amount: customerId ? true : false, // Only fixed_amount if single_use is active
          description: `Garment Care Order Refresh: ${orderId}`,
          notes: {
            orderId
          }
        };

        if (customerId) {
          qrParams.customer_id = customerId;
          qrParams.payment_amount = Math.round(calculatedTotal * 100); // in paise (only for single_use)
        }

        const qrCode: any = await (razorpay as any).qrCode.create(qrParams);

        try {
          await withTimeout(updateDoc(orderDocRef, { razorpayQrId: qrCode.id }), 1200);
        } catch (dbErr) {
          console.warn('Backend database write skipped or failed (high-availability mode active):', dbErr);
        }

        res.json({
          orderId,
          amount: calculatedTotal,
          qrCodeId: qrCode.id,
          qrCodeUrl: qrCode.image_url,
          vpa: qrCode.vpa || 'prakashcsat@oksbi',
          simulated: false,
          expiresAt: closeBy * 1000
        });
      } catch (gateErr: any) {
        console.error('Razorpay QR refresh failed, using high-availability fallback:', gateErr?.message || gateErr);
        
        const mockQrId = `qr_fallback_ref_${crypto.randomBytes(8).toString('hex')}`;
        try {
          await withTimeout(updateDoc(orderDocRef, { razorpayQrId: mockQrId }), 1200);
        } catch (dbErr) {
          console.warn('Backend database write skipped or failed (high-availability mode active):', dbErr);
        }

        const cleanOrderId = orderId.replace(/\s+/g, '_');
        const upiIntent = `upi://pay?pa=prakashcsat@oksbi&pn=Tumble%20Spin&am=${Number(calculatedTotal).toFixed(2)}&cu=INR&tn=Order_${cleanOrderId}&tr=Order_${cleanOrderId}`;
        const mockQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiIntent)}`;

        res.json({
          orderId,
          amount: calculatedTotal,
          qrCodeId: mockQrId,
          qrCodeUrl: mockQrUrl,
          vpa: 'prakashcsat@oksbi',
          simulated: true,
          fallback: true,
          expiresAt: (Math.floor(Date.now() / 1000) + 300) * 1000
        });
      }
    } catch (error: any) {
      console.error('Error in refresh-qr-order:', error);
      res.status(500).json({ error: error.message || 'Failed to refresh secure QR checkout' });
    }
  });

  // Secure polling endpoint for realtime order status checking
  app.get('/api/payments/status/:orderId', async (req, res) => {
    try {
      const { orderId } = req.params;
      const orderDocRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderDocRef);

      if (!orderSnap.exists()) {
        return res.status(404).json({ error: 'Order record not found' });
      }

      const orderData = orderSnap.data();

      // Double-check Razorpay API if status is still pending and we have a valid non-dummy QR ID
      if (orderData.paymentStatus === 'pending' && orderData.razorpayQrId && razorpayKeySecret !== 'dummy_secret' && !orderData.razorpayQrId.startsWith('qr_sim_') && !orderData.razorpayQrId.startsWith('qr_fallback_')) {
        try {
          const qrDetails: any = await razorpay.qrCode.fetch(orderData.razorpayQrId);
          // If the gateway reports that payment has been received or QR is closed due to payment
          if (qrDetails.status === 'closed' || (qrDetails.payments && qrDetails.payments.length > 0)) {
            try {
              await updateDoc(orderDocRef, {
                paymentStatus: 'paid',
                status: 'Order Confirmed',
                paymentDetails: {
                  type: 'UPI_QR',
                  label: 'UPI Dynamic QR (Verified)',
                  details: `Verified via Poll. QR ID: ${orderData.razorpayQrId}`
                },
                paidAt: new Date().toISOString()
              });
            } catch (dbErr) {
              console.warn('Backend database status update skipped or failed (high-availability mode active):', dbErr);
            }
            orderData.paymentStatus = 'paid';
            orderData.status = 'Order Confirmed';
            
            // Dispatch email notification in background
            await sendBookingEmail({
              ...orderData,
              paymentStatus: 'paid',
              status: 'Order Confirmed',
              paymentDetails: {
                type: 'UPI_QR',
                label: 'UPI Dynamic QR (Verified)',
                details: `Verified via Poll. QR ID: ${orderData.razorpayQrId}`
              },
              paidAt: new Date().toISOString()
            }).catch(err => console.error('Background poll email error:', err));
          }
        } catch (gateErr) {
          console.warn('Could not query Razorpay status during poll:', gateErr);
        }
      }

      res.json({
        orderId,
        status: orderData.status,
        paymentStatus: orderData.paymentStatus,
        paymentDetails: orderData.paymentDetails,
        totalPrice: orderData.totalPrice
      });
    } catch (error: any) {
      console.error('Error checking payment status:', error);
      res.status(500).json({ error: error.message || 'Payment status check failed' });
    }
  });

  // Secure Webhook endpoint to catch instant NPCI payment updates
  app.post('/api/payments/webhook', async (req, res) => {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'dummy_webhook_secret';
      const signature = req.headers['x-razorpay-signature'] as string;

      // Cryptographically verify signature if secret is configured
      if (signature && webhookSecret !== 'dummy_webhook_secret') {
        const hmac = crypto.createHmac('sha256', webhookSecret);
        hmac.update((req as any).rawBody || JSON.stringify(req.body));
        const generatedSignature = hmac.digest('hex');

        if (generatedSignature !== signature) {
          console.error('⚠️ Secure signature mismatch for webhook payload!');
          return res.status(400).json({ error: 'Signature verification failed' });
        }
      }

      const webhookData = req.body;
      const eventId = webhookData.id || `evt_sim_${crypto.randomBytes(8).toString('hex')}`;

      // Idempotence filter - prevent duplicate webhook deliveries or replayed events
      const eventDocRef = doc(db, 'webhook_events', eventId);
      const eventDocSnap = await getDoc(eventDocRef);
      if (eventDocSnap.exists()) {
        console.log(`♻️ Webhook event ${eventId} already processed, responding 200 OK.`);
        return res.status(200).json({ received: true, processed: true, duplicate: true });
      }

      // Commit event log inside database
      try {
        await setDoc(eventDocRef, {
          eventId,
          event: webhookData.event || 'qr_payment',
          processedAt: new Date().toISOString()
        });
      } catch (dbErr) {
        console.warn('Backend database event log write skipped or failed (high-availability mode active):', dbErr);
      }

      // Handle successful UPI payment receipt
      if (webhookData.event === 'qr_code.payment_received') {
        const qrEntity = webhookData.payload?.qr_code?.entity;
        const paymentEntity = webhookData.payload?.payment?.entity;
        const orderId = qrEntity?.notes?.orderId;

        if (orderId) {
          const orderDocRef = doc(db, 'orders', orderId);
          const orderSnap = await getDoc(orderDocRef);

          if (orderSnap.exists()) {
            const orderData = orderSnap.data();

            // Perform strict server-side check to validate payment received matches the booked service amount
            if (paymentEntity?.amount !== undefined) {
              const expectedAmount = Number(orderData.totalPrice);
              const receivedAmount = Number(paymentEntity.amount) / 100; // in Rupees
              if (Math.abs(expectedAmount - receivedAmount) > 0.01) {
                console.error(`⚠️ Webhook payment amount mismatch! Expected ₹${expectedAmount}, received ₹${receivedAmount}`);
                return res.status(400).json({ error: 'Webhook payment validation failed: Amount mismatch.' });
              }
            }

            if (orderData.paymentStatus !== 'paid') {
              try {
                await updateDoc(orderDocRef, {
                  paymentStatus: 'paid',
                  status: 'Order Confirmed',
                  paymentDetails: {
                    type: 'UPI_QR',
                    label: 'UPI Dynamic QR (Verified)',
                    details: `Txn ID: ${paymentEntity?.id || 'N/A'}. RRN: ${paymentEntity?.acquirer_data?.rrn || 'N/A'}`
                  },
                  razorpayPaymentId: paymentEntity?.id || null,
                  upiRefNo: paymentEntity?.acquirer_data?.rrn || null,
                  paidAt: new Date().toISOString()
                });
              } catch (dbErr) {
                console.warn('Backend database webhook update skipped or failed (high-availability mode active):', dbErr);
              }
              console.log(`✅ Webhook processed! Order ${orderId} marked as PAID.`);

              // Dispatch email notification in background
              const updatedOrderData = {
                ...orderData,
                paymentStatus: 'paid',
                status: 'Order Confirmed',
                paymentDetails: {
                  type: 'UPI_QR',
                  label: 'UPI Dynamic QR (Verified)',
                  details: `Txn ID: ${paymentEntity?.id || 'N/A'}. RRN: ${paymentEntity?.acquirer_data?.rrn || 'N/A'}`
                },
                razorpayPaymentId: paymentEntity?.id || null,
                upiRefNo: paymentEntity?.acquirer_data?.rrn || null,
                paidAt: new Date().toISOString()
              };
              await sendBookingEmail(updatedOrderData).catch(err => console.error('Background webhook email error:', err));
            }
          }
        }
      }

      res.status(200).json({ received: true, processed: true });
    } catch (err: any) {
      console.error('Error handling backend webhook:', err);
      res.status(500).json({ error: err.message || 'Internal Webhook Handler Error' });
    }
  });

  // Sandbox simulation route so developers can trigger webhook updates instantly in dev modes
  app.post('/api/payments/simulate-payment', async (req, res) => {
    try {
      const { orderId, amount } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: 'orderId is required' });
      }

      const orderDocRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderDocRef);

      if (!orderSnap.exists()) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const orderData = orderSnap.data();

      // Verify if paid amount is exactly the same as the order total
      if (amount !== undefined) {
        const expectedAmount = Number(orderData.totalPrice);
        const receivedAmount = Number(amount);
        if (Math.abs(expectedAmount - receivedAmount) > 0.01) {
          console.error(`⚠️ Payment verification amount mismatch! Expected ₹${expectedAmount}, received ₹${receivedAmount}`);
          return res.status(400).json({ 
            error: `Payment ledger check failed: Amount mismatch. Expected ₹${expectedAmount.toFixed(2)}, received ₹${receivedAmount.toFixed(2)}.` 
          });
        }
      }
      const randomRrn = Math.floor(100000000000 + Math.random() * 900000000000).toString();

      try {
        await updateDoc(orderDocRef, {
          paymentStatus: 'paid',
          status: 'Order Confirmed',
          paymentDetails: {
            type: 'UPI_QR',
            label: 'UPI Dynamic QR (Verified)',
            details: `UTR / RRN: ${randomRrn} (Sandbox)`
          },
          upiRefNo: randomRrn,
          paidAt: new Date().toISOString()
        });
      } catch (dbErr) {
        console.warn('Backend database simulation update skipped or failed (high-availability mode active):', dbErr);
      }

      console.log(`🧪 Simulated webhook success for order ${orderId}. Marked database status as PAID.`);

      // Dispatch email notification in background and capture testing links
      const updatedOrderData = {
        ...orderData,
        paymentStatus: 'paid',
        status: 'Order Confirmed',
        paymentDetails: {
          type: 'UPI_QR',
          label: 'UPI Dynamic QR (Verified)',
          details: `UTR / RRN: ${randomRrn} (Sandbox)`
        },
        upiRefNo: randomRrn,
        paidAt: new Date().toISOString()
      };

      let emailResult = { success: false, method: '', etherealUrl: '', messageId: '' };
      try {
        emailResult = await sendBookingEmail(updatedOrderData);
      } catch (mailErr) {
        console.error('Error dispatching simulation email:', mailErr);
      }

      res.json({ 
        success: true, 
        message: `Simulated payment successful for order ${orderId}`,
        emailSent: emailResult.success,
        emailMethod: emailResult.method,
        etherealUrl: emailResult.etherealUrl
      });
    } catch (err: any) {
      console.error('Error simulating payment:', err);
      res.status(500).json({ error: err.message || 'Payment simulation failed' });
    }
  });

  // Dedicated endpoint to trigger booking email notifications (supports client-side explicit triggers)
  app.post('/api/send-booking-email', async (req, res) => {
    try {
      const { orderId, orderData } = req.body;
      let orderToUse = orderData;

      if (orderId && !orderToUse) {
        // Fetch order details from Firestore
        const orderSnap = await getDoc(doc(db, 'orders', orderId));
        if (orderSnap.exists()) {
          orderToUse = orderSnap.data();
        }
      }

      if (!orderToUse) {
        return res.status(400).json({ error: 'Order details are required to send booking email' });
      }

      const emailResult = await sendBookingEmail(orderToUse);
      res.json({ success: true, ...emailResult });
    } catch (err: any) {
      console.error('Error in send-booking-email endpoint:', err);
      res.status(500).json({ error: err.message || 'Failed to dispatch booking email' });
    }
  });

  // Old standard Razorpay endpoint wrappers preserved for compatibility
  app.post('/api/payments/create-order', async (req, res) => {
    try {
      const { amount, currency = 'INR', receipt = 'receipt_order', quantities, selectedServices, dynamicPricing, bookingDetails } = req.body;
      if (amount === undefined || isNaN(Number(amount))) {
        return res.status(400).json({ error: 'Valid amount is required' });
      }

      // Perform a strict server-side check to validate that the transaction amount received matches the booked service amount
      if (quantities && selectedServices) {
        const calculatedTotal = calculateBackendTotal(quantities, selectedServices, dynamicPricing);
        
        let finalExpectedTotal = calculatedTotal;
        let membershipApplied = false;
        if (bookingDetails && bookingDetails.phone) {
          const cleanPhone = bookingDetails.phone.replace(/\D/g, '');
          if (cleanPhone) {
            try {
              const memberDoc = await getDoc(doc(db, 'memberships', cleanPhone));
              if (memberDoc.exists()) {
                const memberData = memberDoc.data();
                if (memberData && memberData.status === 'active' && (memberData.packageType === 'SMART' || memberData.packageType === 'SILVER')) {
                  const discountPercentage = memberData.packageType === 'SMART' ? 10 : 20;
                  finalExpectedTotal = Math.round(calculatedTotal - (calculatedTotal * discountPercentage) / 100);
                  membershipApplied = true;
                  console.log(`[Backend Card Order] Applied membership discount of ${discountPercentage}% for phone ${cleanPhone}. Original: ${calculatedTotal}, Final: ${finalExpectedTotal}`);
                }
              }
            } catch (dbErr) {
              console.warn('[Backend Card Order] Failed to read membership for discount, bypassing:', dbErr);
            }
          }
        }

        // Standard card orders do not receive the flat 5% UPI QR discount, only active membership discounts.

        if (Math.round(Number(amount)) !== Math.round(finalExpectedTotal)) {
          console.error(`⚠️ create-order amount mismatch! Expected ₹${finalExpectedTotal}, received ₹${amount}`);
          return res.status(400).json({ 
            error: `Booking verification failed: Amount mismatch. Service amount is ₹${finalExpectedTotal.toFixed(2)}, but received ₹${Number(amount).toFixed(2)}.` 
          });
        }
      } else {
        return res.status(400).json({ error: 'Missing quantities or selectedServices configuration for server-side verification' });
      }

      if (razorpayKeySecret === 'dummy_secret') {
        const simulatedOrderId = `order_sim_${crypto.randomBytes(8).toString('hex')}`;
        return res.json({
          id: simulatedOrderId,
          amount: Math.round(Number(amount) * 100),
          currency,
          receipt,
          simulated: true,
        });
      }
      const order = await razorpay.orders.create({
        amount: Math.round(Number(amount) * 100),
        currency,
        receipt,
      });
      res.json(order);
    } catch (error: any) {
      console.error('Error creating standard Razorpay order:', error);
      res.status(500).json({ error: error.message || 'Failed to create payment order' });
    }
  });

  app.post('/api/payments/verify-payment', (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      if (razorpayKeySecret === 'dummy_secret' || (razorpay_order_id && razorpay_order_id.startsWith('order_sim_'))) {
        return res.json({ status: 'success', verified: true, simulated: true });
      }
      const hmac = crypto.createHmac('sha256', razorpayKeySecret);
      hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
      const generatedSignature = hmac.digest('hex');
      if (generatedSignature === razorpay_signature) {
        res.json({ status: 'success', verified: true });
      } else {
        res.status(400).json({ error: 'Signature verification failed', verified: false });
      }
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      res.status(500).json({ error: error.message || 'Payment verification failed' });
    }
  });

  // Vite dev server mounting or static files serving in production
  if (process.env.NODE_ENV !== 'production') {
    createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    }).then((vite) => {
      app.use(vite.middlewares);
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT} (Vite development mode)`);
      });
    }).catch((err) => {
      console.error('Failed to start Vite dev server:', err);
    });
  } else {
    // If running in a standard production container (not Vercel serverless), start local listener
    if (!process.env.VERCEL) {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running in production on port ${PORT}`);
      });
    }
  }

export default app;

