import * as XLSX from 'xlsx';

export interface CustomerSummary {
  key: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  offlineOrders: any[];
  onlineOrders: any[];
  totalSpend: number;
  totalOfflineSpend: number;
}

/**
 * Generates and downloads a complete Excel workbook (.xlsx) containing all customer data.
 */
export function exportCustomersToExcel(customers: CustomerSummary[], businessName = 'Tumble Spin Luxury Laundry') {
  if (!customers || customers.length === 0) {
    alert('No customer records available to export.');
    return;
  }

  // 1. Prepare Summary Sheet Data
  const summaryRows = customers.map((c, index) => {
    const totalOrdersCount = (c.onlineOrders?.length || 0) + (c.offlineOrders?.length || 0);
    const onlineOrdersCount = c.onlineOrders?.length || 0;
    const offlineOrdersCount = c.offlineOrders?.length || 0;
    const onlineSpend = Math.max(0, c.totalSpend - (c.totalOfflineSpend || 0));
    const aov = totalOrdersCount > 0 ? Math.round(c.totalSpend / totalOrdersCount) : 0;

    let customerType = 'Online Client';
    if (onlineOrdersCount > 0 && offlineOrdersCount > 0) {
      customerType = 'Hybrid (Online & Walk-in)';
    } else if (offlineOrdersCount > 0 && onlineOrdersCount === 0) {
      customerType = 'Walk-in Store Customer';
    }

    // Collect all orders sorted by date
    const allOrders = [...(c.onlineOrders || []), ...(c.offlineOrders || [])];
    allOrders.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

    const firstOrderDate = allOrders.length > 0 && allOrders[0].createdAt 
      ? new Date(allOrders[0].createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'N/A';
    
    const lastOrderDate = allOrders.length > 0 && allOrders[allOrders.length - 1].createdAt 
      ? new Date(allOrders[allOrders.length - 1].createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'N/A';

    // Unique services
    const servicesSet = new Set<string>();
    allOrders.forEach(o => {
      if (Array.isArray(o.selectedServices)) {
        o.selectedServices.forEach((s: string) => servicesSet.add(s));
      }
    });
    const servicesUsed = Array.from(servicesSet).join(', ') || 'Standard Laundry';

    // Order IDs
    const orderIds = allOrders.map(o => o.orderId).filter(Boolean).join(', ') || 'N/A';

    return {
      'S.No': index + 1,
      'Customer Name': c.fullName || 'Anonymous Customer',
      'Phone Number': c.phone !== 'N/A' ? c.phone : '',
      'Email Address': c.email !== 'walkin@tumblespin.com' ? c.email : '',
      'Primary Delivery Address': c.address !== 'N/A' && c.address !== 'Offline Walk-in Customer' ? c.address : 'Store Drop-off / Local',
      'Customer Category': customerType,
      'Total Orders': totalOrdersCount,
      'Online Orders': onlineOrdersCount,
      'Walk-in Drop-offs': offlineOrdersCount,
      'Lifetime Spend (₹)': c.totalSpend,
      'Online Spend (₹)': onlineSpend,
      'Walk-in Store Spend (₹)': c.totalOfflineSpend || 0,
      'Avg Order Value (₹)': aov,
      'First Order Date': firstOrderDate,
      'Latest Order Date': lastOrderDate,
      'Services Availed': servicesUsed,
      'Associated Order IDs': orderIds
    };
  });

  // 2. Prepare Detailed Line-Item Orders Sheet Data
  const detailedOrderRows: any[] = [];
  let orderIndex = 1;

  customers.forEach(c => {
    const allOrders = [...(c.onlineOrders || []), ...(c.offlineOrders || [])];
    allOrders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    allOrders.forEach(order => {
      const isOffline = order.selectedServices?.includes('Walk-in Counter Service') || 
                        order.pickupTimeSlot === 'Store Drop-off' || 
                        order.address === 'Offline Walk-in Customer';

      // Items breakdown
      let itemsList = '';
      if (Array.isArray(order.subServices) && order.subServices.length > 0) {
        itemsList = order.subServices.map((sub: any) => `${sub.name || sub.id} (x${sub.quantity || 1})`).join('; ');
      } else if (Array.isArray(order.selectedServices)) {
        itemsList = order.selectedServices.join(', ');
      }

      detailedOrderRows.push({
        'S.No': orderIndex++,
        'Customer Name': c.fullName || order.fullName || 'Valued Client',
        'Phone': c.phone !== 'N/A' ? c.phone : (order.phone || ''),
        'Email': c.email !== 'walkin@tumblespin.com' ? c.email : (order.email || ''),
        'Order ID': order.orderId || 'N/A',
        'Order Date': order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : 'N/A',
        'Channel': isOffline ? 'Offline Store Counter' : 'Online Doorstep Pickup',
        'Order Status': order.status || 'Confirmed',
        'Total Amount (₹)': order.totalPrice || 0,
        'Services Booked': Array.isArray(order.selectedServices) ? order.selectedServices.join(', ') : 'Standard',
        'Garment Items Breakdown': itemsList || 'General Load',
        'Pickup Slot': order.pickupDate ? `${order.pickupDate} (${order.pickupTimeSlot || 'Flexible'})` : 'Walk-in Drop',
        'Delivery Slot': order.deliveryDate ? `${order.deliveryDate} (${order.deliveryTimeSlot || 'Flexible'})` : 'Counter Pickup',
        'Address': order.address || 'N/A',
        'Special Instructions': order.specialInstructions || ''
      });
    });
  });

  // 3. Create Workbook
  const workbook = XLSX.utils.book_new();

  // Summary Worksheet
  const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
  // Auto-fit column widths
  summaryWs['!cols'] = [
    { wpx: 45 },  // S.No
    { wpx: 160 }, // Customer Name
    { wpx: 120 }, // Phone Number
    { wpx: 190 }, // Email Address
    { wpx: 240 }, // Delivery Address
    { wpx: 140 }, // Customer Category
    { wpx: 90 },  // Total Orders
    { wpx: 90 },  // Online Orders
    { wpx: 110 }, // Walk-in Drop-offs
    { wpx: 120 }, // Lifetime Spend
    { wpx: 110 }, // Online Spend
    { wpx: 130 }, // Walk-in Store Spend
    { wpx: 110 }, // Avg Order Value
    { wpx: 110 }, // First Order Date
    { wpx: 110 }, // Latest Order Date
    { wpx: 220 }, // Services Availed
    { wpx: 220 }  // Associated Order IDs
  ];
  XLSX.utils.book_append_sheet(workbook, summaryWs, 'Customer Directory');

  // Detailed Orders Worksheet
  if (detailedOrderRows.length > 0) {
    const detailedWs = XLSX.utils.json_to_sheet(detailedOrderRows);
    detailedWs['!cols'] = [
      { wpx: 45 },  // S.No
      { wpx: 150 }, // Customer Name
      { wpx: 120 }, // Phone
      { wpx: 180 }, // Email
      { wpx: 120 }, // Order ID
      { wpx: 160 }, // Order Date
      { wpx: 150 }, // Channel
      { wpx: 120 }, // Status
      { wpx: 110 }, // Amount
      { wpx: 180 }, // Services Booked
      { wpx: 240 }, // Breakdown
      { wpx: 160 }, // Pickup Slot
      { wpx: 160 }, // Delivery Slot
      { wpx: 240 }, // Address
      { wpx: 200 }  // Special Instructions
    ];
    XLSX.utils.book_append_sheet(workbook, detailedWs, 'Order Level Itemization');
  }

  // 4. Download file
  const dateStr = new Date().toISOString().split('T')[0];
  const safeFilename = `${businessName.replace(/\s+/g, '_')}_Customer_Data_${dateStr}.xlsx`;
  XLSX.writeFile(workbook, safeFilename);
}

/**
 * Formats and triggers native print for the entire customer directory
 */
export function printCustomerDirectory(customers: CustomerSummary[], businessName = 'Tumble Spin Luxury Laundry') {
  if (!customers || customers.length === 0) {
    alert('No customer records available to print.');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!printWindow) {
    alert('Please allow popups in your browser to print the customer directory.');
    return;
  }

  const dateFormatted = new Date().toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short'
  });

  const totalClients = customers.length;
  const totalRevenue = customers.reduce((sum, c) => sum + (c.totalSpend || 0), 0);
  const totalOrders = customers.reduce((sum, c) => sum + (c.onlineOrders?.length || 0) + (c.offlineOrders?.length || 0), 0);

  const tableRowsHtml = customers.map((c, idx) => {
    const ordersCount = (c.onlineOrders?.length || 0) + (c.offlineOrders?.length || 0);
    const allOrders = [...(c.onlineOrders || []), ...(c.offlineOrders || [])];
    allOrders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const lastOrderDate = allOrders.length > 0 && allOrders[0].createdAt 
      ? new Date(allOrders[0].createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'N/A';

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 8px 10px; font-family: monospace; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 8px 10px; font-weight: bold; color: #0f172a;">${c.fullName || 'Anonymous'}</td>
        <td style="padding: 8px 10px; font-family: monospace; color: #0284c7;">${c.phone !== 'N/A' ? c.phone : '-'}</td>
        <td style="padding: 8px 10px; color: #475569;">${c.email !== 'walkin@tumblespin.com' ? c.email : '-'}</td>
        <td style="padding: 8px 10px; color: #334155; max-width: 220px; line-height: 1.3;">${c.address !== 'N/A' && c.address !== 'Offline Walk-in Customer' ? c.address : 'Store Drop-off'}</td>
        <td style="padding: 8px 10px; text-align: center; font-weight: 600; color: #0f172a;">${ordersCount}</td>
        <td style="padding: 8px 10px; text-align: right; font-weight: bold; font-family: monospace; color: #0f766e;">₹${c.totalSpend.toLocaleString('en-IN')}</td>
        <td style="padding: 8px 10px; color: #64748b;">${lastOrderDate}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${businessName} - Master Customer Directory</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 12mm 10mm 12mm 10mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 20px;
            background: #fff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f766e;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .brand-title {
            font-size: 20px;
            font-weight: 800;
            color: #0f766e;
            margin: 0 0 4px 0;
            letter-spacing: 0.5px;
          }
          .subtitle {
            font-size: 11px;
            color: #64748b;
            font-weight: 500;
          }
          .metrics {
            display: flex;
            gap: 16px;
            margin-bottom: 16px;
          }
          .metric-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 8px 14px;
            flex: 1;
          }
          .metric-label {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 700;
            color: #64748b;
          }
          .metric-val {
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
            font-family: monospace;
            margin-top: 2px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
          }
          th {
            background: #f1f5f9;
            color: #334155;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 700;
            padding: 8px 10px;
            border-top: 1px solid #cbd5e1;
            border-bottom: 1px solid #cbd5e1;
          }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 16px; display: flex; gap: 10px;">
          <button onclick="window.print()" style="background: #0f766e; color: #fff; border: none; padding: 8px 18px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 12px;">
            🖨️ Print / Save as PDF
          </button>
          <button onclick="window.close()" style="background: #e2e8f0; color: #334155; border: none; padding: 8px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 12px;">
            Close
          </button>
        </div>

        <div class="header">
          <div>
            <h1 class="brand-title">${businessName}</h1>
            <div class="subtitle">Complete Customer Directory & Lifetime Analytics Report</div>
          </div>
          <div style="text-align: right; font-size: 10px; color: #64748b;">
            <div><strong>Generated:</strong> ${dateFormatted}</div>
            <div><strong>Admin Security:</strong> Authorized Executive Audit</div>
          </div>
        </div>

        <div class="metrics">
          <div class="metric-card">
            <div class="metric-label">Total Unique Customers</div>
            <div class="metric-val">${totalClients}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Total Cumulative Orders</div>
            <div class="metric-val">${totalOrders}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Total Client Revenue</div>
            <div class="metric-val">₹${totalRevenue.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align: center; width: 40px;">#</th>
              <th>Customer Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Delivery / Primary Address</th>
              <th style="text-align: center;">Orders</th>
              <th style="text-align: right;">Lifetime Spend</th>
              <th>Last Activity</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>

        <div style="margin-top: 20px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
          CONFIDENTIAL & PROPRIETARY — ${businessName} Customer Records. Generated via Admin & Master Admin Console.
        </div>

        <script>
          // Automatically prompt print dialog after load
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 400);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
