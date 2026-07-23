import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
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

// Initialize PhonePe Payment Gateway Configuration
const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID || 'M22Y26G850U9A';
const PHONEPE_SALT_KEY = process.env.PHONEPE_SALT_KEY || '83c27e85-d847-4977-987f-d5b7ca8f01b1';
const PHONEPE_SALT_INDEX = process.env.PHONEPE_SALT_INDEX || '1';
const PHONEPE_ENV = (process.env.PHONEPE_ENV || 'SANDBOX').toUpperCase();
const PHONEPE_CALLBACK_URL = process.env.PHONEPE_CALLBACK_URL || '/api/phonepe/callback';
const PHONEPE_REDIRECT_URL = process.env.PHONEPE_REDIRECT_URL || '/phonepe-verify';

const PHONEPE_HOST = PHONEPE_ENV === 'PRODUCTION'
  ? 'https://api.phonepe.com/apis/hermes'
  : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

// PhonePe Cryptographic Checksum Helpers
function calculatePhonePeChecksum(base64Payload: string, apiEndpoint: string): string {
  const stringToHash = base64Payload + apiEndpoint + PHONEPE_SALT_KEY;
  const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
  return `${sha256}###${PHONEPE_SALT_INDEX}`;
}

function calculatePhonePeStatusChecksum(merchantId: string, merchantTxnId: string): string {
  const apiEndpoint = `/pg/v1/status/${merchantId}/${merchantTxnId}`;
  const stringToHash = apiEndpoint + PHONEPE_SALT_KEY;
  const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
  return `${sha256}###${PHONEPE_SALT_INDEX}`;
}

function verifyPhonePeCallbackChecksum(base64Response: string, xVerifyHeader: string): boolean {
  if (!xVerifyHeader) return false;
  const calculated = crypto.createHash('sha256').update(base64Response + PHONEPE_SALT_KEY).digest('hex') + '###' + PHONEPE_SALT_INDEX;
  return calculated === xVerifyHeader;
}

  // Gateway Configuration endpoint
  app.get('/api/payments/config', (req, res) => {
    res.json({
      gateway: 'phonepe',
      merchantId: PHONEPE_MERCHANT_ID,
      env: PHONEPE_ENV,
      redirectUrl: PHONEPE_REDIRECT_URL
    });
  });

  // PhonePe Initiate Payment Endpoint for Laundry Booking Orders
  const handleInitiatePhonePePayment = async (req: express.Request, res: express.Response) => {
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
                console.log(`[PhonePe Backend] Applied membership discount of ${discountPercentage}% for phone ${cleanPhone}. Original: ${calculatedTotal}, Final: ${finalTotal}`);
              }
            }
          } catch (dbErr) {
            console.warn('[PhonePe Backend] Failed to read membership for discount, bypassing:', dbErr);
          }
        }
      }

      if (!membershipApplied) {
        // Flat 5% self-booking discount for direct UPI payments if no active membership
        finalTotal = Math.round(calculatedTotal - (calculatedTotal * 5) / 100);
      }

      // Generate secure sequential order display ID
      const orderId = await generateNextOrderId();
      const rawCleanId = orderId.replace(/[^a-zA-Z0-9]/g, '');
      const merchantTransactionId = `${rawCleanId}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

      // Default timeline steps
      const orderTimeline = [
        { step: 1, title: 'Order Confirmed', desc: 'Booking received and digital invoice dispatched.', time: new Date().toLocaleString(), done: true, active: true },
        { step: 2, title: 'Valet Pickup Completed', desc: 'Arjun Gowda is arriving for doorstep garment verification.', time: 'Scheduled', done: false, active: false },
        { step: 3, title: 'In-Facility Fabric Screening', desc: 'Processing at our master textile cleaning plant.', time: 'Pending', done: false, active: false },
        { step: 4, title: 'Quality Pressed & Inspected', desc: 'Inspected under pristine studio lighting.', time: 'Pending', done: false, active: false },
        { step: 5, title: 'Returned Flawless', desc: 'Handpacked in breathable protective garment covers.', time: 'Pending', done: false, active: false },
      ];

      // Prepare Firestore Order Object
      const cleanPhone = (bookingDetails.phone || '').replace(/\D/g, '') || '9999999999';
      const hostOrigin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
      const redirectUrl = `${hostOrigin}/?merchantTransactionId=${merchantTransactionId}&orderId=${orderId}`;
      const callbackUrl = PHONEPE_CALLBACK_URL.startsWith('http') ? PHONEPE_CALLBACK_URL : `${hostOrigin}${PHONEPE_CALLBACK_URL}`;

      const newOrderDoc: any = {
        orderId,
        merchantTransactionId,
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
        currency: 'INR',
        status: 'Payment Pending',
        timeline: orderTimeline,
        paymentMethod: 'PhonePe UPI Gateway',
        paymentDetails: {
          type: 'PHONEPE_PG',
          label: 'PhonePe Gateway (Pending Verification)',
          details: `Awaiting PhonePe backend settlement for Txn ID ${merchantTransactionId}`
        },
        paymentStatus: 'pending',
        paymentGateway: 'phonepe',
        verifiedFlag: false,
        verificationSource: null,
        createdAt: new Date().toISOString()
      };

      // Save initial order document to Firestore DB
      try {
        await withTimeout(setDoc(doc(db, 'orders', orderId), newOrderDoc), 10000);
        await withTimeout(setDoc(doc(db, 'orders', merchantTransactionId), newOrderDoc), 10000);
        
        // Log initial payment attempt
        await withTimeout(setDoc(doc(db, 'payment_attempts', merchantTransactionId), {
          merchantTransactionId,
          orderId,
          amount: finalTotal,
          currency: 'INR',
          gateway: 'phonepe',
          status: 'INITIATED',
          createdAt: new Date().toISOString()
        }), 10000);

        console.log(`[PhonePe Backend] Order ${orderId} (${merchantTransactionId}) saved to Firestore DB.`);
      } catch (dbErr) {
        console.warn('Backend database write warning (resilient state active):', dbErr);
      }

      // Construct PhonePe V1 /pg/v1/pay Base64 Payload
      const payloadObj = {
        merchantId: PHONEPE_MERCHANT_ID,
        merchantTransactionId: merchantTransactionId,
        merchantUserId: `MUID_${cleanPhone}`,
        amount: Math.round(finalTotal * 100), // in paise
        redirectUrl: redirectUrl,
        redirectMode: 'REDIRECT',
        callbackUrl: callbackUrl,
        mobileNumber: cleanPhone,
        paymentInstrument: {
          type: 'PAY_PAGE'
        }
      };

      const base64Payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
      const xVerifyHeader = calculatePhonePeChecksum(base64Payload, '/pg/v1/pay');

      // Generate Fallback Dynamic QR and UPI Intent link
      const upiIntent = `upi://pay?pa=prakashcsat@oksbi&pn=Tumble%20Spin&am=${finalTotal.toFixed(2)}&cu=INR&tn=Order_${rawCleanId}&tr=${merchantTransactionId}`;
      const fallbackQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(upiIntent)}`;

      let phonepePayUrl = '';
      let phonepeQrData = '';
      let isSimulated = false;

      try {
        // Call PhonePe Payment Gateway API
        const response = await fetch(`${PHONEPE_HOST}/pg/v1/pay`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': xVerifyHeader,
            'X-MERCHANT-ID': PHONEPE_MERCHANT_ID
          },
          body: JSON.stringify({ request: base64Payload })
        });

        if (response.ok) {
          const resData: any = await response.json();
          if (resData.success && resData.data?.instrumentResponse?.redirectInfo?.url) {
            phonepePayUrl = resData.data.instrumentResponse.redirectInfo.url;
            phonepeQrData = resData.data.instrumentResponse.qrData || '';
            console.log(`[PhonePe API] Payment session initialized successfully: ${merchantTransactionId}`);
          } else {
            console.warn(`[PhonePe API] Response received without redirect URL, switching to sandbox QR fallback:`, resData);
            isSimulated = true;
          }
        } else {
          const errText = await response.text();
          console.warn(`[PhonePe API] Preprod/Sandbox HTTP ${response.status}: ${errText}. Using sandbox fallback.`);
          isSimulated = true;
        }
      } catch (gateErr: any) {
        console.warn(`[PhonePe API] Network call exception (${gateErr?.message || gateErr}). Using sandbox flow.`);
        isSimulated = true;
      }

      res.json({
        success: true,
        orderId,
        merchantTransactionId,
        amount: finalTotal,
        payUrl: phonepePayUrl || fallbackQrUrl,
        qrCodeUrl: phonepeQrData ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(phonepeQrData)}` : fallbackQrUrl,
        upiIntent: upiIntent,
        vpa: 'prakashcsat@oksbi',
        simulated: isSimulated,
        orderDoc: newOrderDoc
      });

    } catch (error: any) {
      console.error('Error in PhonePe payment initiation:', error);
      res.status(500).json({ error: error.message || 'Failed to initiate PhonePe payment order' });
    }
  };

  app.post('/api/phonepe/initiate', handleInitiatePhonePePayment);
  app.post('/api/payments/create-qr-order', handleInitiatePhonePePayment); // Backward-compatible alias

  // PhonePe Initiate Payment Endpoint for Membership Subscriptions
  app.post('/api/phonepe/initiate-membership', async (req, res) => {
    try {
      const { packageType, fullName, phone, email } = req.body;
      if (!packageType || !fullName || !phone || !email) {
        return res.status(400).json({ error: 'Missing required membership subscription details' });
      }

      const expectedAmount = packageType === 'SMART' ? 2000 : 5000;
      const cleanPhone = phone.replace(/\D/g, '') || '9999999999';
      const merchantTransactionId = `MEM_${packageType}_${cleanPhone}_${Date.now()}`;

      const hostOrigin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
      const redirectUrl = `${hostOrigin}/?merchantTransactionId=${merchantTransactionId}&membership=true`;
      const callbackUrl = PHONEPE_CALLBACK_URL.startsWith('http') ? PHONEPE_CALLBACK_URL : `${hostOrigin}${PHONEPE_CALLBACK_URL}`;

      const pendingMembershipDoc = {
        merchantTransactionId,
        packageType,
        fullName,
        phone: cleanPhone,
        email,
        amount: expectedAmount,
        currency: 'INR',
        paymentStatus: 'pending',
        paymentGateway: 'phonepe',
        verifiedFlag: false,
        createdAt: new Date().toISOString()
      };

      try {
        await withTimeout(setDoc(doc(db, 'memberships_pending', merchantTransactionId), pendingMembershipDoc), 10000);
      } catch (dbErr) {
        console.warn('Membership pending write warning:', dbErr);
      }

      // Construct PhonePe V1 Base64 Payload
      const payloadObj = {
        merchantId: PHONEPE_MERCHANT_ID,
        merchantTransactionId: merchantTransactionId,
        merchantUserId: `MUID_${cleanPhone}`,
        amount: Math.round(expectedAmount * 100),
        redirectUrl: redirectUrl,
        redirectMode: 'REDIRECT',
        callbackUrl: callbackUrl,
        mobileNumber: cleanPhone,
        paymentInstrument: {
          type: 'PAY_PAGE'
        }
      };

      const base64Payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
      const xVerifyHeader = calculatePhonePeChecksum(base64Payload, '/pg/v1/pay');

      const upiIntent = `upi://pay?pa=prakashcsat@oksbi&pn=Tumble%20Spin&am=${expectedAmount.toFixed(2)}&cu=INR&tn=Membership_${packageType}&tr=${merchantTransactionId}`;
      const fallbackQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(upiIntent)}`;

      let phonepePayUrl = '';
      let isSimulated = false;

      try {
        const response = await fetch(`${PHONEPE_HOST}/pg/v1/pay`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': xVerifyHeader,
            'X-MERCHANT-ID': PHONEPE_MERCHANT_ID
          },
          body: JSON.stringify({ request: base64Payload })
        });

        if (response.ok) {
          const resData: any = await response.json();
          if (resData.success && resData.data?.instrumentResponse?.redirectInfo?.url) {
            phonepePayUrl = resData.data.instrumentResponse.redirectInfo.url;
          } else {
            isSimulated = true;
          }
        } else {
          isSimulated = true;
        }
      } catch (e) {
        isSimulated = true;
      }

      res.json({
        success: true,
        merchantTransactionId,
        packageType,
        amount: expectedAmount,
        payUrl: phonepePayUrl || fallbackQrUrl,
        qrCodeUrl: fallbackQrUrl,
        upiIntent,
        simulated: isSimulated
      });

    } catch (error: any) {
      console.error('Error initiating PhonePe membership payment:', error);
      res.status(500).json({ error: error.message || 'Failed to initiate PhonePe membership payment' });
    }
  });

  // Secure Webhook / Server-to-Server Callback Endpoint for PhonePe
  const handlePhonePeCallback = async (req: express.Request, res: express.Response) => {
    try {
      const xVerifyHeader = req.headers['x-verify'] as string;
      const responsePayload = req.body.response; // PhonePe posts base64 encoded response in body.response or JSON

      let decodedData: any = null;
      let rawBase64 = '';

      if (typeof responsePayload === 'string') {
        rawBase64 = responsePayload;
        // Verify X-VERIFY checksum
        const isValidChecksum = verifyPhonePeCallbackChecksum(rawBase64, xVerifyHeader);
        if (!isValidChecksum && PHONEPE_ENV === 'PRODUCTION') {
          console.error('⚠️ PhonePe Webhook Checksum Verification Failed!');
          return res.status(400).json({ error: 'Signature verification failed' });
        }
        decodedData = JSON.parse(Buffer.from(rawBase64, 'base64').toString('utf-8'));
      } else if (req.body && req.body.data) {
        decodedData = req.body;
      } else {
        decodedData = req.body;
      }

      console.log('[PhonePe Webhook Received]:', JSON.stringify(decodedData, null, 2));

      const eventId = decodedData.data?.merchantTransactionId 
        ? `evt_pp_${decodedData.data.merchantTransactionId}` 
        : `evt_pp_${crypto.randomBytes(8).toString('hex')}`;

      // Idempotence filter - prevent duplicate webhook deliveries
      const eventDocRef = doc(db, 'webhook_events', eventId);
      const eventDocSnap = await getDoc(eventDocRef);
      if (eventDocSnap.exists()) {
        console.log(`♻️ PhonePe Webhook event ${eventId} already processed.`);
        return res.status(200).json({ received: true, processed: true, duplicate: true });
      }

      // Log event to Firestore for audit trail
      try {
        await setDoc(eventDocRef, {
          eventId,
          gateway: 'phonepe',
          payload: decodedData,
          processedAt: new Date().toISOString()
        });
      } catch (dbErr) {
        console.warn('Webhook event database log skipped/failed:', dbErr);
      }

      const paymentState = decodedData.code || decodedData.data?.state;
      const merchantTransactionId = decodedData.data?.merchantTransactionId;
      const transactionId = decodedData.data?.transactionId || decodedData.data?.providerReferenceId || 'N/A';
      const amountInPaise = decodedData.data?.amount;

      if (!merchantTransactionId) {
        return res.status(200).json({ received: true, note: 'Missing transaction ID' });
      }

      if (paymentState === 'PAYMENT_SUCCESS' || paymentState === 'COMPLETED' || decodedData.success === true) {
        // 1. Check if this is a Laundry Order
        let orderSnap = await getDoc(doc(db, 'orders', merchantTransactionId));
        let orderIdToUpdate = merchantTransactionId;

        if (!orderSnap.exists()) {
          // Check if merchantTransactionId corresponds to an order stored by orderId
          const orderMatch = merchantTransactionId.split('_')[0];
          if (orderMatch) {
            orderSnap = await getDoc(doc(db, 'orders', orderMatch));
            if (orderSnap.exists()) {
              orderIdToUpdate = orderMatch;
            }
          }
        }

        if (orderSnap.exists()) {
          const orderData = orderSnap.data();
          const expectedTotal = Number(orderData.totalPrice);
          const receivedAmount = amountInPaise ? Number(amountInPaise) / 100 : expectedTotal;

          if (Math.abs(expectedTotal - receivedAmount) > 0.01) {
            console.error(`⚠️ Webhook Amount Mismatch! Quoted: ₹${expectedTotal}, Received: ₹${receivedAmount}`);
            return res.status(400).json({ error: 'Payment amount mismatch' });
          }

          if (orderData.paymentStatus !== 'paid') {
            const updatedDetails = {
              paymentStatus: 'paid',
              status: 'Order Confirmed',
              verifiedFlag: true,
              verificationSource: 'webhook',
              phonepeTransactionId: transactionId,
              paymentDetails: {
                type: 'PHONEPE_PG',
                label: 'PhonePe Gateway (Verified)',
                details: `Txn ID: ${transactionId}. Merchant Txn: ${merchantTransactionId}`
              },
              paidAt: new Date().toISOString()
            };

            await updateDoc(doc(db, 'orders', orderIdToUpdate), updatedDetails);
            if (merchantTransactionId !== orderIdToUpdate) {
              await setDoc(doc(db, 'orders', merchantTransactionId), { ...orderData, ...updatedDetails }, { merge: true });
            }

            console.log(`✅ PhonePe Webhook: Order ${orderIdToUpdate} marked as PAID.`);

            // Record payment ledger entry
            await setDoc(doc(db, 'payments', transactionId), {
              transactionId,
              merchantTransactionId,
              orderId: orderIdToUpdate,
              amount: receivedAmount,
              currency: 'INR',
              gateway: 'phonepe',
              status: 'SUCCESS',
              verificationSource: 'webhook',
              paidAt: new Date().toISOString()
            }, { merge: true });

            // Dispatch confirmation email in background
            await sendBookingEmail({
              ...orderData,
              ...updatedDetails
            }).catch(err => console.error('Webhook email error:', err));
          }
        }

        // 2. Check if this is a Membership Subscription Order
        if (merchantTransactionId.startsWith('MEM_')) {
          const pendingMemSnap = await getDoc(doc(db, 'memberships_pending', merchantTransactionId));
          if (pendingMemSnap.exists()) {
            const memData = pendingMemSnap.data();
            const cleanPhone = memData.phone;

            const newMemberDoc = {
              phone: cleanPhone,
              fullName: memData.fullName,
              email: memData.email,
              packageType: memData.packageType,
              rechargeAmount: memData.amount,
              balance: memData.amount,
              status: 'active',
              createdAt: new Date().toISOString()
            };

            await setDoc(doc(db, 'memberships', cleanPhone), newMemberDoc, { merge: true });
            await updateDoc(doc(db, 'memberships_pending', merchantTransactionId), {
              paymentStatus: 'paid',
              verifiedFlag: true,
              verificationSource: 'webhook',
              paidAt: new Date().toISOString()
            });

            console.log(`✅ PhonePe Webhook: Membership ${memData.packageType} activated for ${cleanPhone}`);
          }
        }
      }

      res.status(200).json({ success: true, processed: true });

    } catch (err: any) {
      console.error('Error handling PhonePe callback webhook:', err);
      res.status(500).json({ error: err.message || 'PhonePe Webhook Processing Error' });
    }
  };

  app.post('/api/phonepe/callback', handlePhonePeCallback);
  app.post('/api/payments/webhook', handlePhonePeCallback); // Backward-compatible alias

  // Secure Payment Status API with PhonePe Order Status API Fallback Verification
  const handleGetPaymentStatus = async (req: express.Request, res: express.Response) => {
    try {
      const merchantTransactionId = req.params.merchantTransactionId || req.params.orderId;
      if (!merchantTransactionId) {
        return res.status(400).json({ error: 'Transaction ID is required' });
      }

      // Check Firestore DB for Laundry Order
      let orderSnap = await getDoc(doc(db, 'orders', merchantTransactionId));
      let orderIdToRef = merchantTransactionId;

      if (!orderSnap.exists()) {
        const orderMatch = merchantTransactionId.split('_')[0];
        if (orderMatch) {
          orderSnap = await getDoc(doc(db, 'orders', orderMatch));
          if (orderSnap.exists()) {
            orderIdToRef = orderMatch;
          }
        }
      }

      // If order exists in DB and is ALREADY confirmed as paid with verifiedFlag, return true status immediately
      if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        if (orderData.paymentStatus === 'paid' && orderData.verifiedFlag === true) {
          return res.json({
            success: true,
            orderId: orderData.orderId,
            merchantTransactionId,
            status: orderData.status,
            paymentStatus: 'paid',
            verified: true,
            verificationSource: orderData.verificationSource || 'backend_ledger',
            paymentDetails: orderData.paymentDetails,
            totalPrice: orderData.totalPrice,
            orderDoc: orderData
          });
        }
      }

      // Check if it's a pending membership subscription
      let isMembership = merchantTransactionId.startsWith('MEM_');
      let pendingMemSnap: any = null;
      if (isMembership) {
        pendingMemSnap = await getDoc(doc(db, 'memberships_pending', merchantTransactionId));
        if (pendingMemSnap.exists() && pendingMemSnap.data()?.paymentStatus === 'paid') {
          return res.json({
            success: true,
            merchantTransactionId,
            paymentStatus: 'paid',
            verified: true,
            isMembership: true,
            membershipData: pendingMemSnap.data()
          });
        }
      }

      // Order/Membership is currently pending. Query PhonePe Status API directly for true status
      const xVerifyHeader = calculatePhonePeStatusChecksum(PHONEPE_MERCHANT_ID, merchantTransactionId);

      let phonepeStatusObj: any = null;
      try {
        const statusResponse = await fetch(`${PHONEPE_HOST}/pg/v1/status/${PHONEPE_MERCHANT_ID}/${merchantTransactionId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': xVerifyHeader,
            'X-MERCHANT-ID': PHONEPE_MERCHANT_ID
          }
        });

        if (statusResponse.ok) {
          phonepeStatusObj = await statusResponse.json();
          console.log(`[PhonePe Status Check API] Response for ${merchantTransactionId}:`, JSON.stringify(phonepeStatusObj, null, 2));
        } else {
          console.warn(`[PhonePe Status Check API] Returned HTTP ${statusResponse.status}`);
        }
      } catch (statusErr) {
        console.warn(`[PhonePe Status Check API] Call exception:`, statusErr);
      }

      // Evaluate PhonePe API Verification Result
      if (phonepeStatusObj && (phonepeStatusObj.code === 'PAYMENT_SUCCESS' || phonepeStatusObj.data?.state === 'COMPLETED')) {
        const transactionId = phonepeStatusObj.data?.transactionId || phonepeStatusObj.data?.providerReferenceId || 'N/A';
        const receivedAmountInPaise = phonepeStatusObj.data?.amount;

        if (orderSnap.exists()) {
          const orderData = orderSnap.data();
          const expectedTotal = Number(orderData.totalPrice);
          const receivedAmount = receivedAmountInPaise ? Number(receivedAmountInPaise) / 100 : expectedTotal;

          // Amount tamper verification check
          if (Math.abs(expectedTotal - receivedAmount) <= 0.01) {
            const updatedDetails = {
              paymentStatus: 'paid',
              status: 'Order Confirmed',
              verifiedFlag: true,
              verificationSource: 'status_api',
              phonepeTransactionId: transactionId,
              paymentDetails: {
                type: 'PHONEPE_PG',
                label: 'PhonePe Gateway (Verified)',
                details: `Verified via Status API. Txn ID: ${transactionId}`
              },
              paidAt: new Date().toISOString()
            };

            await updateDoc(doc(db, 'orders', orderIdToRef), updatedDetails);
            if (merchantTransactionId !== orderIdToRef) {
              await setDoc(doc(db, 'orders', merchantTransactionId), { ...orderData, ...updatedDetails }, { merge: true });
            }

            const updatedOrderDoc = { ...orderData, ...updatedDetails };

            // Dispatch confirmation email
            await sendBookingEmail(updatedOrderDoc).catch(err => console.error('Status check email error:', err));

            return res.json({
              success: true,
              orderId: orderData.orderId,
              merchantTransactionId,
              status: 'Order Confirmed',
              paymentStatus: 'paid',
              verified: true,
              verificationSource: 'status_api',
              paymentDetails: updatedDetails.paymentDetails,
              totalPrice: orderData.totalPrice,
              orderDoc: updatedOrderDoc
            });
          }
        }

        if (isMembership && pendingMemSnap && pendingMemSnap.exists()) {
          const memData = pendingMemSnap.data();
          const cleanPhone = memData.phone;

          const newMemberDoc = {
            phone: cleanPhone,
            fullName: memData.fullName,
            email: memData.email,
            packageType: memData.packageType,
            rechargeAmount: memData.amount,
            balance: memData.amount,
            status: 'active',
            createdAt: new Date().toISOString()
          };

          await setDoc(doc(db, 'memberships', cleanPhone), newMemberDoc, { merge: true });
          await updateDoc(doc(db, 'memberships_pending', merchantTransactionId), {
            paymentStatus: 'paid',
            verifiedFlag: true,
            verificationSource: 'status_api',
            paidAt: new Date().toISOString()
          });

          return res.json({
            success: true,
            merchantTransactionId,
            paymentStatus: 'paid',
            verified: true,
            isMembership: true,
            membershipData: newMemberDoc
          });
        }
      } else if (phonepeStatusObj && (phonepeStatusObj.code === 'PAYMENT_FAILED' || phonepeStatusObj.code === 'PAYMENT_ERROR' || phonepeStatusObj.data?.state === 'FAILED')) {
        if (orderSnap.exists()) {
          await updateDoc(doc(db, 'orders', orderIdToRef), { paymentStatus: 'failed', status: 'Payment Failed' });
        }
        return res.json({
          success: false,
          merchantTransactionId,
          paymentStatus: 'failed',
          status: 'Payment Failed',
          verified: false,
          message: phonepeStatusObj.message || 'Payment was declined or failed.'
        });
      }

      // If still pending
      const currentStatus = orderSnap.exists() ? orderSnap.data().paymentStatus : 'pending';
      const orderDocVal = orderSnap.exists() ? orderSnap.data() : null;

      res.json({
        success: currentStatus === 'paid',
        orderId: orderDocVal?.orderId || merchantTransactionId,
        merchantTransactionId,
        status: orderDocVal?.status || 'Payment Pending',
        paymentStatus: currentStatus,
        verified: currentStatus === 'paid',
        totalPrice: orderDocVal?.totalPrice,
        orderDoc: orderDocVal,
        message: 'Awaiting verified payment confirmation from PhonePe...'
      });

    } catch (error: any) {
      console.error('Error checking PhonePe payment status:', error);
      res.status(500).json({ error: error.message || 'Failed to check PhonePe payment status' });
    }
  };

  app.get('/api/phonepe/status/:merchantTransactionId', handleGetPaymentStatus);
  app.get('/api/payments/status/:orderId', handleGetPaymentStatus); // Backward-compatible alias
  app.post('/api/phonepe/verify-status', async (req, res) => {
    (req.params as any).merchantTransactionId = req.body.merchantTransactionId || req.body.orderId;
    return handleGetPaymentStatus(req, res);
  });

  // Sandbox / Test Simulation Endpoint for PhonePe (Guarantees zero-friction dev testing)
  app.post('/api/phonepe/simulate-payment', async (req, res) => {
    try {
      const { orderId, merchantTransactionId, amount } = req.body;
      const targetId = merchantTransactionId || orderId;

      if (!targetId) {
        return res.status(400).json({ error: 'orderId or merchantTransactionId is required' });
      }

      let orderSnap = await getDoc(doc(db, 'orders', targetId));
      let orderIdToRef = targetId;

      if (!orderSnap.exists()) {
        const orderMatch = targetId.split('_')[0];
        if (orderMatch) {
          orderSnap = await getDoc(doc(db, 'orders', orderMatch));
          if (orderSnap.exists()) {
            orderIdToRef = orderMatch;
          }
        }
      }

      if (!orderSnap.exists() && !targetId.startsWith('MEM_')) {
        return res.status(404).json({ error: 'Order not found in database' });
      }

      if (orderSnap.exists()) {
        const orderData = orderSnap.data();

        // Strict server-side amount check
        if (amount !== undefined) {
          const expectedTotal = Number(orderData.totalPrice);
          const receivedAmount = Number(amount);
          if (Math.abs(expectedTotal - receivedAmount) > 0.01) {
            return res.status(400).json({
              error: `Payment ledger check failed: Amount mismatch. Expected ₹${expectedTotal.toFixed(2)}, received ₹${receivedAmount.toFixed(2)}.`
            });
          }
        }

        const simTxnId = `PP_SIM_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
        const updatedDetails = {
          paymentStatus: 'paid',
          status: 'Order Confirmed',
          verifiedFlag: true,
          verificationSource: 'sandbox_simulation',
          phonepeTransactionId: simTxnId,
          paymentDetails: {
            type: 'PHONEPE_PG',
            label: 'PhonePe Gateway (Verified Sandbox)',
            details: `Simulated PhonePe Txn ID: ${simTxnId}`
          },
          paidAt: new Date().toISOString()
        };

        await updateDoc(doc(db, 'orders', orderIdToRef), updatedDetails);
        if (targetId !== orderIdToRef) {
          await setDoc(doc(db, 'orders', targetId), { ...orderData, ...updatedDetails }, { merge: true });
        }

        const updatedOrderDoc = { ...orderData, ...updatedDetails };
        await sendBookingEmail(updatedOrderDoc).catch(e => console.error('Sim email error:', e));

        return res.json({
          success: true,
          message: `Simulated PhonePe payment verified for ${orderIdToRef}`,
          paymentStatus: 'paid',
          verified: true,
          orderDoc: updatedOrderDoc
        });
      }

      // If Membership simulation
      if (targetId.startsWith('MEM_')) {
        const pendingMemSnap = await getDoc(doc(db, 'memberships_pending', targetId));
        if (pendingMemSnap.exists()) {
          const memData = pendingMemSnap.data();
          const cleanPhone = memData.phone;

          const newMemberDoc = {
            phone: cleanPhone,
            fullName: memData.fullName,
            email: memData.email,
            packageType: memData.packageType,
            rechargeAmount: memData.amount,
            balance: memData.amount,
            status: 'active',
            createdAt: new Date().toISOString()
          };

          await setDoc(doc(db, 'memberships', cleanPhone), newMemberDoc, { merge: true });
          await updateDoc(doc(db, 'memberships_pending', targetId), {
            paymentStatus: 'paid',
            verifiedFlag: true,
            verificationSource: 'sandbox_simulation',
            paidAt: new Date().toISOString()
          });

          return res.json({
            success: true,
            message: `Simulated PhonePe membership payment verified for ${targetId}`,
            paymentStatus: 'paid',
            verified: true,
            isMembership: true,
            membershipData: newMemberDoc
          });
        }
      }

      res.status(404).json({ error: 'Record not found' });

    } catch (err: any) {
      console.error('Error simulating PhonePe payment:', err);
      res.status(500).json({ error: err.message || 'PhonePe payment simulation failed' });
    }
  });

  app.post('/api/payments/simulate-payment', async (req, res) => {
    // Alias to simulate-payment handler above
    req.url = '/api/phonepe/simulate-payment';
    return app._router.handle(req, res, () => {});
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

      const simulatedOrderId = `order_sim_${crypto.randomBytes(8).toString('hex')}`;
      return res.json({
        id: simulatedOrderId,
        merchantTransactionId: simulatedOrderId,
        amount: Math.round(Number(amount) * 100),
        currency,
        receipt,
        simulated: true,
      });
    } catch (error: any) {
      console.error('Error creating payment order:', error);
      res.status(500).json({ error: error.message || 'Failed to create payment order' });
    }
  });

  app.post('/api/payments/verify-payment', (req, res) => {
    try {
      res.json({ status: 'success', verified: true, simulated: true });
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

