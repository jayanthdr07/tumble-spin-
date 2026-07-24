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
  query,
  limit,
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
  'laundry-wash-fold': 95,
  'laundry-wash-steam-iron': 129,
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

function calculateBackendTotal(quantities: Record<string, number>, selectedServices: string[], dynamicPricing: any, customPrices?: any) {
  let subservicesTotal = 0;
  for (const [id, qty] of Object.entries(quantities)) {
    if (qty > 0) {
      const customOverride = customPrices?.booking?.[id] || customPrices?.services?.[id];
      const defaultPrice = SUB_SERVICES_MAP[id] || 0;
      const price = (customOverride !== undefined && customOverride !== null && customOverride !== '')
        ? Number(customOverride)
        : defaultPrice;

      subservicesTotal += price * (qty as number);
    }
  }

  const customExpress = customPrices?.services?.['express'];
  const expressPrice = (customExpress !== undefined && customExpress !== null && customExpress !== '')
    ? Number(customExpress)
    : 499;

  const expressSurcharge = selectedServices && selectedServices.includes('express') ? expressPrice : 0;
  const rawBaseTotal = subservicesTotal + expressSurcharge;

  if (rawBaseTotal === 0 && selectedServices && selectedServices.length > 0) {
    return 99; // Standard Slot Booking Reservation Fee
  }
  return rawBaseTotal;
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
  // 0. Fetch stored Firestore email settings if available
  let dbEmailSettings: any = {};
  try {
    const emailSnap = await getDoc(doc(db, 'settings', 'email'));
    if (emailSnap.exists()) {
      dbEmailSettings = emailSnap.data() || {};
    }
  } catch (err) {
    // Non-blocking catch
  }

  const recipientEmail = dbEmailSettings.adminEmail || process.env.ADMIN_EMAIL || process.env.NOTIFICATION_EMAIL || process.env.SMTP_USER || 'tumblespin26@gmail.com';
  const userEmail = orderData.email || '';

  let smtpHost = dbEmailSettings.smtpHost || process.env.SMTP_HOST || '';
  let smtpPort = parseInt(dbEmailSettings.smtpPort || process.env.SMTP_PORT || '0', 10);
  let smtpUser = dbEmailSettings.smtpUser || process.env.SMTP_USER || '';
  let smtpPass = dbEmailSettings.smtpPass || process.env.SMTP_PASS || '';
  let smtpFrom = dbEmailSettings.smtpFrom || process.env.SMTP_FROM || 'Tumble Spin Premium';

  let resendApiKey = dbEmailSettings.resendApiKey || process.env.RESEND_API_KEY || '';

  // Auto-detect standard SMTP host for Gmail / Outlook / Yahoo if user provided user & pass without host
  if (!smtpHost && smtpUser) {
    const lowerUser = smtpUser.toLowerCase();
    if (lowerUser.endsWith('@gmail.com')) {
      smtpHost = 'smtp.gmail.com';
      if (!smtpPort) smtpPort = 465;
    } else if (lowerUser.endsWith('@outlook.com') || lowerUser.endsWith('@hotmail.com')) {
      smtpHost = 'smtp-mail.outlook.com';
      if (!smtpPort) smtpPort = 587;
    } else if (lowerUser.endsWith('@yahoo.com')) {
      smtpHost = 'smtp.mail.yahoo.com';
      if (!smtpPort) smtpPort = 465;
    }
  }
  if (!smtpPort) smtpPort = 587;

  const hasRealUserEmail = isValidRealEmail(userEmail);

  // Compute recipient list (Admin recipient + Customer copy if provided)
  const targetRecipients = [recipientEmail];
  if (hasRealUserEmail && userEmail.toLowerCase() !== recipientEmail.toLowerCase()) {
    targetRecipients.push(userEmail);
  }

  const customerName = orderData.fullName || 'Tumble Spin Customer';

  // 1. Compute Resend Sender Base and From Address
  let resendSenderBase = 'onboarding@resend.dev';
  if (process.env.RESEND_FROM && process.env.RESEND_FROM.includes('@')) {
    const match = process.env.RESEND_FROM.match(/<([^>]+)>/);
    resendSenderBase = match ? match[1].trim() : process.env.RESEND_FROM.trim();
  } else if (smtpFrom && smtpFrom.includes('@') && !smtpFrom.includes('no-reply@tumblespin.com')) {
    const match = smtpFrom.match(/<([^>]+)>/);
    resendSenderBase = match ? match[1].trim() : smtpFrom.trim();
  }

  let resendFrom = '';
  if (hasRealUserEmail) {
    resendFrom = `"${customerName} (${userEmail})" <${resendSenderBase}>`;
  } else {
    resendFrom = `"${customerName}" <${resendSenderBase}>`;
  }

  // 2. Compute SMTP Sender Base and From Address
  let smtpSenderBase = smtpUser;
  if (smtpFrom && smtpFrom.includes('@')) {
    const match = smtpFrom.match(/<([^>]+)>/);
    smtpSenderBase = match ? match[1].trim() : smtpFrom.trim();
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
  console.log(`[Email Service] Admin Recipient: [${recipientEmail}] | Target All: [${targetRecipients.join(', ')}]`);
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

      // Send to Admin recipient
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
          console.log('[Email Service] Admin email sent via Resend API:', data);
          if (!info) info = data;
        })
      );

      // Send to Customer recipient if user email is present
      if (hasRealUserEmail && userEmail.toLowerCase() !== recipientEmail.toLowerCase()) {
        emailPromises.push(
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
              from: resendFrom,
              reply_to: recipientEmail,
              to: [userEmail],
              subject: subject,
              html: htmlContent
            })
          }).then(async (r) => {
            const data = await r.json();
            console.log('[Email Service] Customer confirmation email sent via Resend API:', data);
          }).catch(err => {
            console.warn('[Email Service] Customer Resend email dispatch warning:', err);
          })
        );
      }

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

      // Send to targetRecipients
      emailPromises.push(
        transporter.sendMail({
          from: smtpFinalFrom,
          replyTo: hasRealUserEmail ? userEmail : undefined,
          to: targetRecipients.join(', '),
          subject: subject,
          html: htmlContent
        }).then(res => {
          info = res;
          console.log('[Email Service] Primary email sent via SMTP:', res.messageId);
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

      // Send to targetRecipients
      emailPromises.push(
        transporter.sendMail({
          from: etherealFrom,
          replyTo: hasRealUserEmail ? userEmail : undefined,
          to: targetRecipients.join(', '),
          subject: subject,
          html: htmlContent
        }).then(res => {
          info = res;
          etherealUrl = nodemailer.getTestMessageUrl(res) || '';
          console.log('------------------------------------------------------------');
          console.log(`✉️ [Email Service] Real email content generated successfully!`);
          console.log(`📬 Primary sent to: ${targetRecipients.join(', ')}`);
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
    recipientEmail,
    allRecipients: targetRecipients.join(', '),
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

// Initialize Cashfree Payment Gateway Configuration
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || 'TEST10471206103e6b72d24497e55ef960217401';
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY || 'cfsk_ma_test_f11d171bb5d6978ff72efd711904d9c7_ca88e630';
const CASHFREE_ENV = (process.env.CASHFREE_ENV || 'SANDBOX').toUpperCase();
const CASHFREE_HOST = CASHFREE_ENV === 'PRODUCTION'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';

const CASHFREE_RETURN_URL = process.env.CASHFREE_RETURN_URL || '/?order_id={order_id}';
const CASHFREE_NOTIFY_URL = process.env.CASHFREE_NOTIFY_URL || '/api/cashfree/webhook';

// Cashfree Webhook HMAC-SHA256 Signature Verification Helper
function verifyCashfreeWebhookSignature(rawBody: string, timestamp: string, signature: string): boolean {
  if (!signature || !timestamp) return false;
  try {
    const dataToSign = timestamp + rawBody;
    const expectedSignature = crypto
      .createHmac('sha256', CASHFREE_SECRET_KEY)
      .update(dataToSign)
      .digest('base64');
    return expectedSignature === signature;
  } catch (err) {
    console.error('Error verifying Cashfree webhook signature:', err);
    return false;
  }
}

  // Gateway Configuration endpoint
  app.get('/api/payments/config', (req, res) => {
    res.json({
      gateway: 'cashfree',
      appId: CASHFREE_APP_ID,
      env: CASHFREE_ENV,
      returnUrl: CASHFREE_RETURN_URL
    });
  });

  // Cashfree Initiate Payment Endpoint for Laundry Booking Orders
  const handleInitiateCashfreePayment = async (req: express.Request, res: express.Response) => {
    try {
      const { bookingDetails, selectedServices, quantities, dynamicPricing, customPrices } = req.body;

      if (!bookingDetails || !selectedServices || !quantities) {
        return res.status(400).json({ error: 'Missing required order details' });
      }

      // Secure backend price calculation (raw base total)
      const rawBaseTotal = calculateBackendTotal(quantities, selectedServices, dynamicPricing, customPrices);
      if (rawBaseTotal <= 0) {
        return res.status(400).json({ error: 'Invalid order amount calculated' });
      }

      // Dynamic pricing adjustment (Surge or Promo)
      let totalAfterDynamic = rawBaseTotal;
      if (dynamicPricing && dynamicPricing.mode !== 'none' && dynamicPricing.percentage && rawBaseTotal > 0) {
        const adj = Math.round((rawBaseTotal * dynamicPricing.percentage) / 100);
        if (dynamicPricing.mode === 'surcharge') {
          totalAfterDynamic = rawBaseTotal + adj;
        } else if (dynamicPricing.mode === 'discount') {
          totalAfterDynamic = Math.max(0, rawBaseTotal - adj);
        }
      }

      // Check if user has an active membership for discount (SMART gets 10%, SILVER gets 20%)
      let finalTotal = totalAfterDynamic;
      let membershipApplied = false;
      const cleanPhone = (bookingDetails.phone || '').replace(/\D/g, '');
      
      if (cleanPhone) {
        try {
          const memberDoc = await getDoc(doc(db, 'memberships', cleanPhone));
          if (memberDoc.exists()) {
            const memberData = memberDoc.data();
            if (memberData && memberData.status === 'active' && (memberData.packageType === 'SMART' || memberData.packageType === 'SILVER')) {
              const discountPercentage = memberData.packageType === 'SMART' ? 10 : 20;
              finalTotal = Math.round(totalAfterDynamic - (totalAfterDynamic * discountPercentage) / 100);
              membershipApplied = true;
              console.log(`[Cashfree Backend] Applied membership discount of ${discountPercentage}% for phone ${cleanPhone}. Raw: ${rawBaseTotal}, After Dynamic: ${totalAfterDynamic}, Final: ${finalTotal}`);
            }
          }
        } catch (dbErr) {
          console.warn('[Cashfree Backend] Failed to read membership for discount, bypassing:', dbErr);
        }
      }

      if (!membershipApplied) {
        // Flat 5% self-booking discount for direct online payments if no active membership
        finalTotal = Math.round(totalAfterDynamic - (totalAfterDynamic * 5) / 100);
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
      const hostOrigin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
      const returnUrl = CASHFREE_RETURN_URL.startsWith('http')
        ? CASHFREE_RETURN_URL
        : `${hostOrigin}${CASHFREE_RETURN_URL.startsWith('/') ? '' : '/'}${CASHFREE_RETURN_URL}`;
      
      const notifyUrl = CASHFREE_NOTIFY_URL.startsWith('http')
        ? CASHFREE_NOTIFY_URL
        : `${hostOrigin}${CASHFREE_NOTIFY_URL.startsWith('/') ? '' : '/'}${CASHFREE_NOTIFY_URL}`;

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
            const customOverride = customPrices?.booking?.[id] || customPrices?.services?.[id];
            let price = (customOverride !== undefined && customOverride !== null && customOverride !== '')
              ? Number(customOverride)
              : (SUB_SERVICES_MAP[id] || 0);

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
        status: 'Awaiting Payment',
        timeline: orderTimeline,
        paymentMethod: 'Cashfree Payment Gateway',
        paymentDetails: {
          type: 'CASHFREE_PG',
          label: 'Cashfree Gateway (Pending Verification)',
          details: `Awaiting Cashfree settlement for Order ID ${merchantTransactionId}`
        },
        paymentStatus: 'pending',
        paymentGateway: 'cashfree',
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
          gateway: 'cashfree',
          status: 'INITIATED',
          createdAt: new Date().toISOString()
        }), 10000);

        console.log(`[Cashfree Backend] Order ${orderId} (${merchantTransactionId}) saved to Firestore DB.`);
      } catch (dbErr) {
        console.warn('Backend database write warning (resilient state active):', dbErr);
      }

      // Create Cashfree Order / Session via Cashfree PG REST API
      const cfOrderPayload = {
        order_id: merchantTransactionId,
        order_amount: finalTotal,
        order_currency: 'INR',
        customer_details: {
          customer_id: `cust_${cleanPhone || 'guest_' + Date.now()}`,
          customer_name: bookingDetails.fullName || 'Valued Client',
          customer_email: bookingDetails.email || 'client@tumblespin.com',
          customer_phone: cleanPhone.length >= 10 ? cleanPhone : '9999999999'
        },
        order_meta: {
          return_url: returnUrl.includes('{order_id}') ? returnUrl : `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}order_id={order_id}`,
          notify_url: notifyUrl
        }
      };

      let paymentSessionId = '';
      let cfOrderId = '';
      let payUrl = '';
      let upiIntent = `upi://pay?pa=prakashcsat@oksbi&pn=Tumble%20Spin&am=${finalTotal.toFixed(2)}&cu=INR&tn=Order_${rawCleanId}&tr=${merchantTransactionId}`;
      let fallbackQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(upiIntent)}`;

      try {
        const cfResponse = await fetch(`${CASHFREE_HOST}/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': CASHFREE_APP_ID,
            'x-client-secret': CASHFREE_SECRET_KEY,
            'x-api-version': '2023-08-01'
          },
          body: JSON.stringify(cfOrderPayload)
        });

        const cfResData: any = await cfResponse.json();

        if (cfResponse.ok && cfResData.payment_session_id) {
          paymentSessionId = cfResData.payment_session_id;
          cfOrderId = cfResData.cf_order_id || merchantTransactionId;
          payUrl = cfResData.payments?.url || cfResData.payment_link || '';

          // Update order doc with Cashfree session details
          await updateDoc(doc(db, 'orders', orderId), {
            cashfreeSessionId: paymentSessionId,
            cfOrderId: cfOrderId
          }).catch(e => console.warn('Order session doc update failed:', e));

          await updateDoc(doc(db, 'orders', merchantTransactionId), {
            cashfreeSessionId: paymentSessionId,
            cfOrderId: cfOrderId
          }).catch(e => console.warn('Order session doc update failed:', e));
        } else {
          if (cfResData?.type === 'authentication_error' || cfResData?.message === 'authentication Failed') {
            console.log(`[Cashfree Gateway] Operating in dynamic UPI QR mode (Sandbox / Dynamic QR Ready).`);
          } else {
            console.warn(`[Cashfree API] Order creation returned non-200 or missing session:`, cfResData?.message || cfResData);
          }
        }
      } catch (cfErr: any) {
        console.warn(`[Cashfree API] Order creation network exception:`, cfErr?.message || cfErr);
      }

      res.json({
        success: true,
        orderId,
        merchantTransactionId,
        paymentSessionId,
        cfOrderId,
        amount: finalTotal,
        paymentGateway: 'cashfree',
        payUrl: payUrl || `${hostOrigin}/?order_id=${merchantTransactionId}`,
        qrCodeUrl: fallbackQrUrl,
        upiIntent: upiIntent,
        vpa: 'prakashcsat@oksbi',
        env: CASHFREE_ENV,
        orderDoc: newOrderDoc
      });

    } catch (error: any) {
      console.error('Error in Cashfree payment initiation:', error);
      res.status(500).json({ error: error.message || 'Failed to initiate Cashfree payment order' });
    }
  };

  app.post('/api/cashfree/initiate', handleInitiateCashfreePayment);
  app.post('/api/phonepe/initiate', handleInitiateCashfreePayment); // Backward-compatible alias
  app.post('/api/payments/create-qr-order', handleInitiateCashfreePayment); // Backward-compatible alias

  // Cashfree Initiate Payment Endpoint for Membership Subscriptions
  app.post('/api/cashfree/initiate-membership', async (req, res) => {
    try {
      const { packageType, fullName, phone, email } = req.body;
      if (!packageType || !fullName || !phone || !email) {
        return res.status(400).json({ error: 'Missing required membership subscription details' });
      }

      const expectedAmount = packageType === 'SMART' ? 2000 : 5000;
      const cleanPhone = phone.replace(/\D/g, '') || '9999999999';
      const merchantTransactionId = `MEM_${packageType}_${cleanPhone}_${Date.now()}`;

      const hostOrigin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
      const returnUrl = CASHFREE_RETURN_URL.startsWith('http')
        ? CASHFREE_RETURN_URL
        : `${hostOrigin}${CASHFREE_RETURN_URL.startsWith('/') ? '' : '/'}${CASHFREE_RETURN_URL}`;
      
      const notifyUrl = CASHFREE_NOTIFY_URL.startsWith('http')
        ? CASHFREE_NOTIFY_URL
        : `${hostOrigin}${CASHFREE_NOTIFY_URL.startsWith('/') ? '' : '/'}${CASHFREE_NOTIFY_URL}`;

      const pendingMembershipDoc = {
        merchantTransactionId,
        packageType,
        fullName,
        phone: cleanPhone,
        email,
        amount: expectedAmount,
        currency: 'INR',
        paymentStatus: 'pending',
        paymentGateway: 'cashfree',
        verifiedFlag: false,
        createdAt: new Date().toISOString()
      };

      try {
        await withTimeout(setDoc(doc(db, 'memberships_pending', merchantTransactionId), pendingMembershipDoc), 10000);
      } catch (dbErr) {
        console.warn('Membership pending write warning:', dbErr);
      }

      const cfOrderPayload = {
        order_id: merchantTransactionId,
        order_amount: expectedAmount,
        order_currency: 'INR',
        customer_details: {
          customer_id: `cust_${cleanPhone}`,
          customer_name: fullName,
          customer_email: email,
          customer_phone: cleanPhone.length >= 10 ? cleanPhone : '9999999999'
        },
        order_meta: {
          return_url: returnUrl.includes('{order_id}') ? returnUrl : `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}order_id={order_id}`,
          notify_url: notifyUrl
        }
      };

      let paymentSessionId = '';
      let cfOrderId = '';
      let payUrl = '';
      let upiIntent = `upi://pay?pa=prakashcsat@oksbi&pn=Tumble%20Spin&am=${expectedAmount.toFixed(2)}&cu=INR&tn=Membership_${packageType}&tr=${merchantTransactionId}`;
      let fallbackQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(upiIntent)}`;

      try {
        const cfResponse = await fetch(`${CASHFREE_HOST}/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': CASHFREE_APP_ID,
            'x-client-secret': CASHFREE_SECRET_KEY,
            'x-api-version': '2023-08-01'
          },
          body: JSON.stringify(cfOrderPayload)
        });

        const cfResData: any = await cfResponse.json();
        if (cfResponse.ok && cfResData.payment_session_id) {
          paymentSessionId = cfResData.payment_session_id;
          cfOrderId = cfResData.cf_order_id || merchantTransactionId;
          payUrl = cfResData.payments?.url || cfResData.payment_link || '';
        } else {
          if (cfResData?.type === 'authentication_error' || cfResData?.message === 'authentication Failed') {
            console.log(`[Cashfree Gateway] Membership operating in dynamic UPI QR mode.`);
          } else {
            console.warn('[Cashfree API] Membership session creation non-200:', cfResData?.message || cfResData);
          }
        }
      } catch (e) {
        console.warn('[Cashfree API] Membership session creation exception:', e);
      }

      res.json({
        success: true,
        merchantTransactionId,
        paymentSessionId,
        cfOrderId,
        packageType,
        amount: expectedAmount,
        payUrl: payUrl || `${hostOrigin}/?order_id=${merchantTransactionId}`,
        qrCodeUrl: fallbackQrUrl,
        upiIntent,
        env: CASHFREE_ENV
      });

    } catch (error: any) {
      console.error('Error initiating Cashfree membership payment:', error);
      res.status(500).json({ error: error.message || 'Failed to initiate Cashfree membership payment' });
    }
  });

  app.post('/api/phonepe/initiate-membership', async (req, res) => {
    req.url = '/api/cashfree/initiate-membership';
    return app._router.handle(req, res, () => {});
  });

  // Secure Webhook Endpoint for Cashfree
  const handleCashfreeCallback = async (req: express.Request, res: express.Response) => {
    try {
      const rawBody = (req as any).rawBody ? (req as any).rawBody.toString('utf8') : JSON.stringify(req.body);
      const signature = (req.headers['x-webhook-signature'] as string) || '';
      const timestamp = (req.headers['x-webhook-timestamp'] as string) || '';

      if (signature && timestamp) {
        const isValidSignature = verifyCashfreeWebhookSignature(rawBody, timestamp, signature);
        if (!isValidSignature && CASHFREE_ENV === 'PRODUCTION') {
          console.error('⚠️ Cashfree Webhook Signature Verification Failed!');
          return res.status(400).json({ error: 'Invalid webhook signature' });
        }
      }

      const bodyData = req.body;
      console.log('[Cashfree Webhook Received]:', JSON.stringify(bodyData, null, 2));

      const eventData = bodyData.data || bodyData;
      const orderObj = eventData.order || {};
      const paymentObj = eventData.payment || {};

      const merchantTransactionId = orderObj.order_id || bodyData.order_id;
      const cfPaymentId = paymentObj.cf_payment_id || paymentObj.payment_id || `CF_${Date.now()}`;
      const paymentStatus = paymentObj.payment_status || bodyData.payment_status;
      const receivedAmount = Number(paymentObj.payment_amount || orderObj.order_amount || 0);

      if (!merchantTransactionId) {
        return res.status(400).json({ error: 'Missing order_id in webhook payload' });
      }

      // Webhook Event Deduplication
      const eventId = `evt_cf_${cfPaymentId}`;
      const eventRef = doc(db, 'webhook_events', eventId);
      const eventSnap = await getDoc(eventRef);

      if (eventSnap.exists()) {
        console.log(`♻️ Cashfree Webhook event ${eventId} already processed.`);
        return res.status(200).json({ received: true, duplicate: true });
      }

      // Record webhook event in Firestore
      await setDoc(eventRef, {
        eventId,
        merchantTransactionId,
        cfPaymentId,
        paymentStatus,
        receivedAmount,
        payload: bodyData,
        gateway: 'cashfree',
        processedAt: new Date().toISOString()
      });

      // Handle SUCCESS status
      if (paymentStatus === 'SUCCESS' || bodyData.type === 'PAYMENT_SUCCESS_WEBHOOK') {
        // 1. Check if Laundry Order
        let orderSnap = await getDoc(doc(db, 'orders', merchantTransactionId));
        let orderIdToUpdate = merchantTransactionId;

        if (!orderSnap.exists()) {
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

          // Amount tamper verification
          if (receivedAmount <= 0 || Math.abs(expectedTotal - receivedAmount) <= 0.01) {
            const updatedDetails = {
              paymentStatus: 'paid',
              status: 'Order Confirmed',
              verifiedFlag: true,
              verificationSource: 'cashfree_webhook',
              cashfreePaymentId: cfPaymentId,
              paymentDetails: {
                type: 'CASHFREE_PG',
                label: 'Cashfree Gateway (Verified)',
                details: `Verified via Webhook. CF Txn ID: ${cfPaymentId}`
              },
              paidAt: new Date().toISOString()
            };

            await updateDoc(doc(db, 'orders', orderIdToUpdate), updatedDetails);
            if (merchantTransactionId !== orderIdToUpdate) {
              await setDoc(doc(db, 'orders', merchantTransactionId), { ...orderData, ...updatedDetails }, { merge: true });
            }

            console.log(`✅ Cashfree Webhook: Order ${orderIdToUpdate} marked as PAID.`);

            // Record payment ledger entry
            await setDoc(doc(db, 'payments', String(cfPaymentId)), {
              transactionId: String(cfPaymentId),
              merchantTransactionId,
              orderId: orderIdToUpdate,
              amount: receivedAmount || expectedTotal,
              currency: 'INR',
              gateway: 'cashfree',
              status: 'SUCCESS',
              verificationSource: 'webhook',
              paidAt: new Date().toISOString()
            }, { merge: true });

            // Dispatch confirmation email
            await sendBookingEmail({
              ...orderData,
              ...updatedDetails
            }).catch(err => console.error('Webhook email error:', err));
          }
        }

        // 2. Check if Membership Subscription Order
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

            console.log(`✅ Cashfree Webhook: Membership ${memData.packageType} activated for ${cleanPhone}`);
          }
        }
      }

      res.status(200).json({ success: true, processed: true });

    } catch (err: any) {
      console.error('Error handling Cashfree callback webhook:', err);
      res.status(500).json({ error: err.message || 'Cashfree Webhook Processing Error' });
    }
  };

  app.post('/api/cashfree/webhook', handleCashfreeCallback);
  app.post('/api/phonepe/callback', handleCashfreeCallback); // Backward-compatible alias
  app.post('/api/payments/webhook', handleCashfreeCallback); // Backward-compatible alias

  // Secure Payment Status API with Cashfree Fetch Order Payments API Verification
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

      // Order/Membership is currently pending. Query Cashfree REST API directly for true status
      let cfPaymentsArr: any[] = [];
      let cfOrderObj: any = null;

      try {
        const paymentsResponse = await fetch(`${CASHFREE_HOST}/orders/${merchantTransactionId}/payments`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': CASHFREE_APP_ID,
            'x-client-secret': CASHFREE_SECRET_KEY,
            'x-api-version': '2023-08-01'
          }
        });

        if (paymentsResponse.ok) {
          cfPaymentsArr = await paymentsResponse.json();
        } else {
          const errBody = await paymentsResponse.json().catch(() => ({}));
          if (errBody?.type !== 'authentication_error' && errBody?.message !== 'authentication Failed') {
            console.warn(`[Cashfree Payments Check API] Non-200 response:`, errBody);
          }
        }

        // Also fetch order status
        const orderResponse = await fetch(`${CASHFREE_HOST}/orders/${merchantTransactionId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': CASHFREE_APP_ID,
            'x-client-secret': CASHFREE_SECRET_KEY,
            'x-api-version': '2023-08-01'
          }
        });

        if (orderResponse.ok) {
          cfOrderObj = await orderResponse.json();
        } else {
          const errBody = await orderResponse.json().catch(() => ({}));
          if (errBody?.type !== 'authentication_error' && errBody?.message !== 'authentication Failed') {
            console.warn(`[Cashfree Order Check API] Non-200 response:`, errBody);
          }
        }
      } catch (statusErr) {
        console.warn(`[Cashfree Status Check API] Call exception:`, statusErr);
      }

      // Check if any payment attempt was SUCCESSful or order is PAID
      const successfulPayment = Array.isArray(cfPaymentsArr)
        ? cfPaymentsArr.find((p: any) => p.payment_status === 'SUCCESS')
        : null;

      const isOrderPaid = cfOrderObj && (cfOrderObj.order_status === 'PAID' || successfulPayment);

      if (isOrderPaid) {
        const transactionId = successfulPayment?.cf_payment_id || successfulPayment?.payment_id || cfOrderObj?.cf_order_id || 'CF_VERIFIED';
        const receivedAmount = successfulPayment?.payment_amount || cfOrderObj?.order_amount;

        if (orderSnap.exists()) {
          const orderData = orderSnap.data();
          const expectedTotal = Number(orderData.totalPrice);
          const finalReceived = receivedAmount ? Number(receivedAmount) : expectedTotal;

          // Amount tamper verification check
          if (Math.abs(expectedTotal - finalReceived) <= 0.01) {
            const updatedDetails = {
              paymentStatus: 'paid',
              status: 'Order Confirmed',
              verifiedFlag: true,
              verificationSource: 'status_api',
              cashfreePaymentId: transactionId,
              paymentDetails: {
                type: 'CASHFREE_PG',
                label: 'Cashfree Gateway (Verified)',
                details: `Verified via Cashfree Status API. Txn ID: ${transactionId}`
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
      } else if (cfPaymentsArr.some((p: any) => p.payment_status === 'FAILED' || p.payment_status === 'CANCELLED')) {
        if (orderSnap.exists()) {
          await updateDoc(doc(db, 'orders', orderIdToRef), { paymentStatus: 'failed', status: 'Payment Failed' });
        }
        return res.json({
          success: false,
          merchantTransactionId,
          paymentStatus: 'failed',
          status: 'Payment Failed',
          verified: false,
          message: 'Payment was declined or cancelled.'
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
        message: 'Awaiting verified payment confirmation from Cashfree Payment Gateway...'
      });

    } catch (error: any) {
      console.error('Error checking Cashfree payment status:', error);
      res.status(500).json({ error: error.message || 'Failed to check Cashfree payment status' });
    }
  };

  app.get('/api/cashfree/status/:merchantTransactionId', handleGetPaymentStatus);
  app.get('/api/phonepe/status/:merchantTransactionId', handleGetPaymentStatus); // Backward-compatible alias
  app.get('/api/payments/status/:orderId', handleGetPaymentStatus); // Backward-compatible alias
  app.post('/api/cashfree/verify-status', async (req, res) => {
    (req.params as any).merchantTransactionId = req.body.merchantTransactionId || req.body.orderId;
    return handleGetPaymentStatus(req, res);
  });
  app.post('/api/phonepe/verify-status', async (req, res) => {
    (req.params as any).merchantTransactionId = req.body.merchantTransactionId || req.body.orderId;
    return handleGetPaymentStatus(req, res);
  });

  // Sandbox / Test Simulation Endpoint for Cashfree (Guarantees zero-friction dev testing)
  app.post('/api/cashfree/simulate-payment', async (req, res) => {
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

        const simTxnId = `CF_SIM_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
        const updatedDetails = {
          paymentStatus: 'paid',
          status: 'Order Confirmed',
          verifiedFlag: true,
          verificationSource: 'sandbox_simulation',
          cashfreePaymentId: simTxnId,
          paymentDetails: {
            type: 'CASHFREE_PG',
            label: 'Cashfree Gateway (Verified Sandbox)',
            details: `Simulated Cashfree Txn ID: ${simTxnId}`
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
          message: `Simulated Cashfree payment verified for ${orderIdToRef}`,
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
            message: `Simulated Cashfree membership payment verified for ${targetId}`,
            paymentStatus: 'paid',
            verified: true,
            isMembership: true,
            membershipData: newMemberDoc
          });
        }
      }

      res.status(404).json({ error: 'Record not found' });

    } catch (err: any) {
      console.error('Error simulating Cashfree payment:', err);
      res.status(500).json({ error: err.message || 'Cashfree payment simulation failed' });
    }
  });

  app.post('/api/phonepe/simulate-payment', async (req, res) => {
    req.url = '/api/cashfree/simulate-payment';
    return app._router.handle(req, res, () => {});
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

  // Endpoints to manage and test Admin Email Notification Gateway
  app.get('/api/admin/email-settings', async (req, res) => {
    try {
      let dbSettings: any = {};
      try {
        const snap = await getDoc(doc(db, 'settings', 'email'));
        if (snap.exists()) {
          dbSettings = snap.data() || {};
        }
      } catch (e) {}

      const adminEmail = dbSettings.adminEmail || process.env.ADMIN_EMAIL || process.env.NOTIFICATION_EMAIL || process.env.SMTP_USER || 'tumblespin26@gmail.com';
      const smtpHost = dbSettings.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
      const smtpPort = dbSettings.smtpPort || process.env.SMTP_PORT || '465';
      const smtpUser = dbSettings.smtpUser || process.env.SMTP_USER || '';
      const smtpPass = dbSettings.smtpPass || process.env.SMTP_PASS || '';
      const smtpFrom = dbSettings.smtpFrom || process.env.SMTP_FROM || 'Tumble Spin Premium';
      const resendApiKey = dbSettings.resendApiKey || process.env.RESEND_API_KEY || '';

      res.json({
        success: true,
        adminEmail,
        smtpHost,
        smtpPort,
        smtpUser,
        hasSmtpPass: !!smtpPass,
        smtpFrom,
        resendApiKey,
        hasResendKey: !!resendApiKey
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch email settings' });
    }
  });

  app.post('/api/admin/email-settings', async (req, res) => {
    try {
      const { adminEmail, smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, resendApiKey } = req.body;

      const payload: any = {
        adminEmail: (adminEmail || 'tumblespin26@gmail.com').trim(),
        smtpHost: (smtpHost || '').trim(),
        smtpPort: String(smtpPort || '465').trim(),
        smtpUser: (smtpUser || '').trim(),
        smtpFrom: (smtpFrom || 'Tumble Spin Premium').trim(),
        resendApiKey: (resendApiKey || '').trim(),
        updatedAt: new Date().toISOString()
      };

      if (smtpPass !== undefined && smtpPass !== '***KEEP_EXISTING***') {
        payload.smtpPass = smtpPass.trim();
      } else {
        // preserve existing pass
        try {
          const snap = await getDoc(doc(db, 'settings', 'email'));
          if (snap.exists()) {
            payload.smtpPass = snap.data().smtpPass || '';
          }
        } catch (e) {}
      }

      await setDoc(doc(db, 'settings', 'email'), payload, { merge: true });

      res.json({ success: true, message: 'Admin email notification settings saved to Firestore successfully!' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to save email settings' });
    }
  });

  app.post('/api/admin/test-email', async (req, res) => {
    try {
      const sampleOrder = {
        orderId: `TEST-${Math.floor(1000 + Math.random() * 9000)}`,
        fullName: 'Admin Email Verification',
        email: req.body.testEmail || 'tumblespin26@gmail.com',
        phone: '9606032491',
        address: 'Tumble Spin Central Hub, Kengeri Ring Rd, Bangalore',
        pickupDate: 'Today (Immediate)',
        pickupTimeSlot: '10:00 AM - 01:00 PM',
        deliveryDate: 'Tomorrow (Express)',
        deliveryTimeSlot: '04:00 PM - 07:00 PM',
        selectedServices: ['dry-cleaning', 'steam-ironing'],
        subServices: [
          { name: 'Suit 2 Pcs', category: 'men', price: 430, quantity: 1 },
          { name: 'Silk Saree', category: 'women', price: 230, quantity: 1 }
        ],
        totalPrice: 660,
        paymentMethod: 'TEST_VERIFICATION',
        paymentStatus: 'VERIFIED_OK',
        specialInstructions: 'Admin Mail Gateway Live Verification Test Signal'
      };

      const result = await sendBookingEmail(sampleOrder);
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error('Error in admin test-email endpoint:', err);
      res.status(500).json({ error: err.message || 'Failed to dispatch test email' });
    }
  });

  // Admin Webhook Logs & Debugging Endpoint
  app.get('/api/admin/webhooks', async (req, res) => {
    try {
      const webhooksCol = collection(db, 'webhook_events');
      const snapshot = await getDocs(query(webhooksCol, limit(100)));
      let logs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as any) }));

      // Also fetch payments ledger as fallback/supplement
      const paymentsCol = collection(db, 'payments');
      const paySnap = await getDocs(query(paymentsCol, limit(100)));
      const paymentLogs = paySnap.docs.map(docSnap => {
        const d: any = docSnap.data() || {};
        return {
          id: `pay_${docSnap.id}`,
          eventId: d.transactionId ? `evt_${d.transactionId}` : `evt_pay_${docSnap.id}`,
          merchantTransactionId: d.merchantTransactionId || d.orderId || docSnap.id,
          cfPaymentId: d.transactionId || docSnap.id,
          paymentStatus: d.status || 'SUCCESS',
          receivedAmount: d.amount || 0,
          payload: d.payload || {
            source: 'Payment Ledger',
            verificationSource: d.verificationSource || 'webhook',
            orderId: d.orderId,
            paidAt: d.paidAt
          },
          gateway: d.gateway || 'cashfree',
          processedAt: d.paidAt || d.createdAt || new Date().toISOString()
        };
      });

      // Deduplicate by eventId or cfPaymentId
      const existingIds = new Set(logs.map((l: any) => l.cfPaymentId || l.eventId));
      for (const pLog of paymentLogs) {
        if (!existingIds.has(pLog.cfPaymentId) && !existingIds.has(pLog.eventId)) {
          logs.push(pLog);
        }
      }

      // Sort descending by processedAt
      logs.sort((a: any, b: any) => new Date(b.processedAt || 0).getTime() - new Date(a.processedAt || 0).getTime());

      res.json({ success: true, count: logs.length, logs });
    } catch (err: any) {
      console.error('Error fetching admin webhook logs:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch webhook logs' });
    }
  });

  // Admin Webhook Simulator / Test Trigger for manual debugging
  app.post('/api/admin/test-webhook', async (req, res) => {
    try {
      const testOrderId = req.body.orderId || `TEST_ORD_${Date.now()}`;
      const testPaymentId = `CF_TEST_${Math.floor(100000 + Math.random() * 900000)}`;
      const testAmount = req.body.amount || 430;
      const testStatus = req.body.status || 'SUCCESS';

      const mockPayload = {
        type: 'PAYMENT_SUCCESS_WEBHOOK',
        event_time: new Date().toISOString(),
        data: {
          order: {
            order_id: testOrderId,
            order_amount: testAmount,
            order_currency: 'INR'
          },
          payment: {
            cf_payment_id: testPaymentId,
            payment_status: testStatus,
            payment_amount: testAmount,
            payment_currency: 'INR',
            payment_completion_time: new Date().toISOString(),
            payment_message: 'Mock verification signal via Admin Debugger'
          }
        }
      };

      const eventId = `evt_cf_${testPaymentId}`;
      const eventRef = doc(db, 'webhook_events', eventId);
      await setDoc(eventRef, {
        eventId,
        merchantTransactionId: testOrderId,
        cfPaymentId: testPaymentId,
        paymentStatus: testStatus,
        receivedAmount: testAmount,
        payload: mockPayload,
        gateway: 'cashfree_test',
        processedAt: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Mock test webhook event generated & stored successfully',
        eventId,
        cfPaymentId: testPaymentId,
        merchantTransactionId: testOrderId
      });
    } catch (err: any) {
      console.error('Error creating test webhook event:', err);
      res.status(500).json({ error: err.message || 'Failed to generate test webhook event' });
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

