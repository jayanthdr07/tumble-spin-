import { jsPDF } from 'jspdf';
import logoImg from '../assets/images/tumblespin_header_logo.png';

// Helper to preload an image so it renders correctly in jsPDF
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Only set crossOrigin for remote images to avoid local asset load failures in development
    if (src.startsWith('http') || src.startsWith('https')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

// Precise Vector Rupee Symbol Drawing Helper
function drawRupeeSymbol(doc: jsPDF, x: number, y: number, height: number = 3) {
  const w = height * 0.75;
  const originalWidth = doc.getLineWidth();
  
  // Set stroke thickness proportional to font size height
  doc.setLineWidth(height * 0.12);
  
  // Top bar
  doc.line(x, y - height, x + w, y - height);
  // Second parallel bar
  doc.line(x, y - height * 0.65, x + w * 0.8, y - height * 0.65);
  // Left backbone vertical line
  doc.line(x + w * 0.15, y - height, x + w * 0.15, y - height * 0.35);
  
  // Curved loop approximation
  doc.line(x + w * 0.15, y - height, x + w * 0.7, y - height * 0.88);
  doc.line(x + w * 0.7, y - height * 0.88, x + w * 0.7, y - height * 0.48);
  doc.line(x + w * 0.7, y - height * 0.48, x + w * 0.15, y - height * 0.35);
  
  // Diagonal leg
  doc.line(x + w * 0.15, y - height * 0.35, x + w * 0.85, y);
  
  doc.setLineWidth(originalWidth);
}

export interface InvoiceItem {
  id?: string;
  name: string;
  serviceType: string;
  price: number;
  quantity: number;
}

export interface InvoiceData {
  orderId: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  pickupDate: string;
  pickupTimeSlot: string;
  deliveryDate: string;
  deliveryTimeSlot: string;
  garmentCareOption: string;
  specialInstructions?: string;
  subServices: InvoiceItem[];
  totalPrice: number;
  createdAt?: string;
  paymentMethod?: string;
  selectedServices?: string[];
  dynamicPricing?: {
    mode: 'surcharge' | 'discount' | 'none';
    percentage: number;
    label?: string;
  };
}

export async function downloadInvoice(order: InvoiceData) {
  // Format dates beautifully
  const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const careLabel = order.garmentCareOption === 'standard'
    ? 'Standard Luxury Detergent'
    : order.garmentCareOption === 'hypoallergenic'
      ? 'Hypoallergenic Eco-Wash'
      : 'Organic Scentless Fiber Wash';

  // Calculate items subtotal before dynamic pricing
  const subtotal = order.subServices.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Initialize jsPDF (A4 dimensions: 210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // --- 1. BRAND HEADER & METADATA ---
  // Draw Logo Image at top left asynchronously
  try {
    const img = await loadImage(logoImg);
    doc.addImage(img, 'PNG', 12, 12, 38, 14);
  } catch (err) {
    console.error('Failed to load logoImg, drawing fallback circular seal:', err);
    doc.setFillColor(157, 78, 221); // Brand Lilac
    doc.circle(22, 22, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('TS', 22, 25.5, { align: 'center' });
  }

  // Tumble Spin Title & Subtitle (pushed right to avoid logo overlap)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(17, 24, 39); // Brand Deep Charcoal
  doc.text('Tumble Spin', 54, 21);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(157, 78, 221); // Brand Lilac Primary
  doc.text('PREMIUM LAUNDRY & DRY CLEANING', 54, 26);

  // Store Address and Manager Contact Info at top (pushed right to avoid logo overlap)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text('Store: #6, 80 feet road, Kengeri Ring Rd, Mariyappana Palya, Bengaluru, 560056', 54, 31);
  doc.text('Manager Contact: +91 96060 32491 | Email: Prakashcsat@gmail.com', 54, 35);

  // Official Receipt Badge on Top Right
  doc.setFillColor(157, 78, 221); // Brand Lilac Primary
  doc.roundedRect(145, 18, 50, 7, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('OFFICIAL RECEIPT', 170, 22.8, { align: 'center' });

  // Order Details on Top Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(order.orderId, 195, 33, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Issued: ${dateStr}`, 195, 38, { align: 'right' });

  // Elegant Divider Line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.4);
  doc.line(15, 44, 195, 44);

  // --- 2. DETAILS GRID (CLIENT vs SERVICE SLOTS) ---
  // Column 1: Client Profile
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('CLIENT PROFILE & ADDRESS', 15, 51);

  // Client Box background
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(15, 54, 86, 38, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(order.fullName, 20, 61);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(`Phone:  ${order.phone}`, 20, 67);
  doc.text(`Email:  ${order.email}`, 20, 72);
  
  // Wrap address nicely
  doc.setFontSize(8);
  const addressLines = doc.splitTextToSize(`Address:  ${order.address}`, 76);
  doc.text(addressLines, 20, 77);

  // Column 2: Service Slots & Care
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('SERVICE SLOTS & CARE METRIC', 109, 51);

  // Service Box background (Soft Lilac Tint)
  doc.setFillColor(250, 245, 255); // Lilac 50
  doc.setDrawColor(243, 232, 255); // Lilac 100
  doc.roundedRect(109, 54, 86, 38, 2.5, 2.5, 'FD');

  doc.setFontSize(8.5);
  // Slot 1: Pickup
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(123, 44, 191); // Brand Lilac Secondary
  doc.text('Pickup Slot:', 114, 61);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(17, 24, 39);
  doc.text(`${order.pickupDate}`, 138, 61);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`[${order.pickupTimeSlot}]`, 138, 64.5);

  doc.setDrawColor(243, 232, 255);
  doc.line(114, 66.5, 190, 66.5);

  // Slot 2: Return
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(123, 44, 191);
  doc.text('Return Slot:', 114, 71.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(17, 24, 39);
  doc.text(`${order.deliveryDate}`, 138, 71.5);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`[${order.deliveryTimeSlot}]`, 138, 75);

  doc.line(114, 77, 190, 77);

  // Care Metric & Payment Method
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(123, 44, 191);
  doc.text('Care Style:', 114, 82);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(17, 24, 39);
  doc.text(careLabel, 134, 82);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(123, 44, 191);
  doc.text('Payment:', 114, 87);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52); // green-700
  doc.text(order.paymentMethod || 'UPI / Dynamic QR', 134, 87);

  // --- 3. SPECIAL INSTRUCTIONS ---
  let y = 98;
  if (order.specialInstructions && order.specialInstructions.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('SPECIAL VALET DIRECTIVES', 15, y);
    y += 3;

    doc.setFillColor(254, 243, 199); // amber-50
    doc.setDrawColor(253, 230, 138); // amber-200
    doc.roundedRect(15, y, 180, 11, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(146, 64, 14); // amber-800
    doc.text(`"${order.specialInstructions}"`, 20, y + 7);
    y += 18;
  } else {
    y += 3;
  }

  // --- 4. VETTED GARMENTS DETAILS TABLE ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('VETTED GARMENTS DETAILS', 15, y);
  y += 3;

  // Table Header
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(15, y, 180, 7.5, 1, 1, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Garment Description', 19, y + 4.8);
  doc.text('Service Category', 85, y + 4.8);
  doc.text('Rate', 135, y + 4.8, { align: 'right' });
  doc.text('Qty', 157, y + 4.8, { align: 'center' });
  doc.text('Amount', 191, y + 4.8, { align: 'right' });
  y += 7.5;

  // Table Body Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setDrawColor(241, 245, 249); // slate-100
  doc.setLineWidth(0.3);

  order.subServices.forEach((item) => {
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(item.name, 19, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.text(item.serviceType, 85, y + 5.5);

    doc.setFontSize(8.5);
    const rateStr = String(item.price);
    doc.text(rateStr, 135, y + 5.5, { align: 'right' });
    const rateWidth = doc.getTextWidth(rateStr);
    drawRupeeSymbol(doc, 135 - rateWidth - 2.8, y + 5.5, 2.5);

    doc.text(String(item.quantity), 157, y + 5.5, { align: 'center' });
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const amountStr = String(item.price * item.quantity);
    doc.text(amountStr, 191, y + 5.5, { align: 'right' });
    const amtWidth = doc.getTextWidth(amountStr);
    drawRupeeSymbol(doc, 191 - amtWidth - 2.8, y + 5.5, 2.5);

    doc.line(15, y + 8.5, 195, y + 8.5);
    y += 8.5;
  });

  y += 2;

  // --- 5. CALCULATIONS BLOCK ---
  const calcBoxWidth = 85;
  const calcX = 110;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Itemized Subtotal', calcX + 5, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const subtotalStr = String(subtotal);
  doc.text(subtotalStr, 191, y + 4, { align: 'right' });
  const subWidth = doc.getTextWidth(subtotalStr);
  drawRupeeSymbol(doc, 191 - subWidth - 2.8, y + 4, 2.5);
  y += 5.5;

  // Dynamic pricing row
  if (order.dynamicPricing && order.dynamicPricing.mode !== 'none' && order.dynamicPricing.percentage > 0) {
    const isSurcharge = order.dynamicPricing.mode === 'surcharge';
    const amount = Math.round((subtotal * order.dynamicPricing.percentage) / 100);
    const sign = isSurcharge ? '+' : '-';
    const label = order.dynamicPricing.label || (isSurcharge ? 'Peak Surcharge' : 'Promotional Discount');
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`${label} (${order.dynamicPricing.percentage}%)`, calcX + 5, y + 4);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(isSurcharge ? 185 : 22, isSurcharge ? 28 : 101, isSurcharge ? 28 : 52); // red vs green
    const amountStr = String(amount);
    doc.text(amountStr, 191, y + 4, { align: 'right' });
    const amtWidth = doc.getTextWidth(amountStr);
    drawRupeeSymbol(doc, 191 - amtWidth - 2.8, y + 4, 2.5);
    doc.text(sign + " ", 191 - amtWidth - 5.5, y + 4, { align: 'right' });
    y += 5.5;
  }

  // Express surcharge row
  const expressSurcharge = order.selectedServices && order.selectedServices.includes('express') ? 499 : 0;
  if (expressSurcharge > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Express Surcharge (24h Delivery)', calcX + 5, y + 4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const expressStr = String(expressSurcharge);
    doc.text(expressStr, 191, y + 4, { align: 'right' });
    const expWidth = doc.getTextWidth(expressStr);
    drawRupeeSymbol(doc, 191 - expWidth - 2.8, y + 4, 2.5);
    doc.text("+ ", 191 - expWidth - 5.5, y + 4, { align: 'right' });
    y += 5.5;
  }

  // Grand Total Line
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(calcX, y + 1.5, 195, y + 1.5);
  y += 5.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Estimated Grand Total', calcX + 5, y + 3.5);

  doc.setFontSize(13);
  doc.setTextColor(157, 78, 221); // Brand Lilac Primary
  const totalStr = String(order.totalPrice);
  doc.text(totalStr, 191, y + 3.8, { align: 'right' });
  const totWidth = doc.getTextWidth(totalStr);
  drawRupeeSymbol(doc, 191 - totWidth - 3.8, y + 3.8, 3.2);

  y += 18;

  // --- 6. ZERO-WASTE ECO PLEDGE CARD ---
  doc.setFillColor(240, 253, 244); // green-50
  doc.setDrawColor(220, 252, 231); // green-100
  doc.setLineWidth(0.3);
  doc.roundedRect(15, y, 180, 20, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(22, 101, 52); // green-800
  doc.text('Our Tumble Spin Zero-Waste Pledge:', 20, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('All garments processed in 100% biodegradable wet-solvents, handpacked in compostable protective covers, and', 20, y + 10);
  doc.text('delivered on recycled wood/metal hangers. We eliminate all petroleum plastic film sheets from our valet chain.', 20, y + 14);

  y += 30;

  // --- 7. FOOTER DETAILS ---
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Thank you for trusting Tumble Spin Premium Valet Services.', 105, y, { align: 'center' });
  doc.text('This is a digitally compiled PDF order invoice. Vetted specifications are confirmed in-facility.', 105, y + 4, { align: 'center' });

  // Save PDF Document directly to user device
  doc.save(`TumbleSpin_Invoice_${order.orderId}.pdf`);
}
