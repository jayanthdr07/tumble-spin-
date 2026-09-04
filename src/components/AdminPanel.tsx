import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, CheckCircle, Clock, Truck, ShieldCheck, Mail, MapPin, 
  Phone, User, Calendar, RefreshCw, X, ShieldAlert, Check, 
  ChevronDown, MessageSquare, ShoppingBag, Plus, Trash2, ListOrdered, Bell,
  Search, Settings, Store, Receipt, Download, ShoppingCart, Info, Minus,
  Printer, Package, Users, TrendingUp, Sun, Moon,
  Server, Key, Send, Eye, EyeOff, HelpCircle, AlertTriangle, Copy, FileSpreadsheet
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend
} from 'recharts';
import { useBusinessInfo, setBusinessInfo, getBusinessInfo, BusinessInfo } from '../utils/useBusinessInfo';
import { downloadInvoice } from '../utils/invoiceGenerator';
import { exportCustomersToExcel, printCustomerDirectory, CustomerSummary } from '../utils/customerExcelExporter';
import { db } from '../lib/firebase';
import { doc, deleteDoc, setDoc } from 'firebase/firestore';

import { ESTIMATOR_ITEMS } from './ServiceEstimator';
import { SUB_SERVICES } from './BookingModal';
import MasterPricingManager from './MasterPricingManager';

import HERO_IMAGE_PATH from '../assets/images/luxe_laundry_hero_1782710394352.jpg';
import logoImg from '../assets/images/tumblespin_header_logo.png';

interface SubServiceItem {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  serviceType: string;
}

interface OrderData {
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
  selectedServices: string[];
  subServices: SubServiceItem[];
  totalPrice: number;
  status: string;
  orderStatus?: 'Pending' | 'In-Progress' | 'Delivered';
  smsOptIn?: boolean;
  timeline: { step: number; title: string; desc: string; time: string; done: boolean; active: boolean }[];
  createdAt: string;
  adminViewed?: boolean;
}

const mapStatusToOrderStatus = (status: string): 'Pending' | 'In-Progress' | 'Delivered' => {
  if (status === 'Returned Flawless' || status === 'Delivered') {
    return 'Delivered';
  }
  if (['At Laundry Facility', 'In-Facility Fabric Screening', 'Quality Pressed & Inspected', 'Out for Valet Delivery', 'In-Progress'].includes(status)) {
    return 'In-Progress';
  }
  return 'Pending';
};

const STATUS_OPTIONS = [
  'Order Confirmed',
  'Valet Pickup Completed',
  'At Laundry Facility',
  'In-Facility Fabric Screening',
  'Quality Pressed & Inspected',
  'Out for Valet Delivery',
  'Returned Flawless'
];

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  promoConfig: {
    isEnabled: boolean;
    discountText: string;
    appliedOnText: string;
    bgColor: string;
    textColor: string;
  };
  onUpdatePromo: (newConfig: {
    isEnabled: boolean;
    discountText: string;
    appliedOnText: string;
    bgColor: string;
    textColor: string;
  }) => void;
  dynamicPricing?: {
    mode: 'surcharge' | 'discount' | 'none';
    percentage: number;
    label: string;
  };
  onUpdateDynamicPricing: (newConfig: {
    mode: 'surcharge' | 'discount' | 'none';
    percentage: number;
    label: string;
  }) => void;
}

export const computeCustomerDirectory = (ordersList: OrderData[]): CustomerSummary[] => {
  const customersMap = new Map<string, CustomerSummary>();

  ordersList.forEach(order => {
    const isDefaultWalkinEmail = !order.email || order.email.toLowerCase() === 'walkin@tumblespin.com';
    const key = isDefaultWalkinEmail ? `phone-${order.phone || 'unknown'}` : order.email.toLowerCase();

    const isOffline = order.selectedServices?.includes('Walk-in Counter Service') || 
                      order.pickupTimeSlot === 'Store Drop-off' || 
                      order.address === 'Offline Walk-in Customer';

    const price = order.totalPrice || 0;

    if (!customersMap.has(key)) {
      customersMap.set(key, {
        key,
        fullName: order.fullName || 'Anonymous Customer',
        email: order.email || 'walkin@tumblespin.com',
        phone: order.phone || 'N/A',
        address: order.address || 'N/A',
        offlineOrders: [],
        onlineOrders: [],
        totalSpend: 0,
        totalOfflineSpend: 0
      });
    }

    const cust = customersMap.get(key)!;
    
    if (isOffline) {
      cust.offlineOrders.push(order);
      cust.totalOfflineSpend += price;
    } else {
      cust.onlineOrders.push(order);
    }
    cust.totalSpend += price;

    if (order.fullName && order.fullName.toLowerCase() !== 'walkin' && cust.fullName === 'Anonymous Customer') {
      cust.fullName = order.fullName;
    }
    if (order.phone && cust.phone === 'N/A') {
      cust.phone = order.phone;
    }
    if (order.address && (cust.address === 'N/A' || cust.address === 'Offline Walk-in Customer')) {
      cust.address = order.address;
    }
  });

  return Array.from(customersMap.values()).sort((a, b) => b.totalSpend - a.totalSpend);
};

export default function AdminPanel({ 
  isOpen, 
  onClose,
  promoConfig,
  onUpdatePromo,
  dynamicPricing = { mode: 'none', percentage: 15, label: 'Festival Season Demand Surcharge' },
  onUpdateDynamicPricing
}: AdminPanelProps) {
  const [adminRole, setAdminRole] = useState<'admin' | 'master' | null>(() => {
    const saved = localStorage.getItem('tumblespin_admin_role');
    return (saved === 'admin' || saved === 'master') ? saved : null;
  });
  const [isAuthorized, setIsAuthorized] = useState(() => {
    const saved = localStorage.getItem('tumblespin_admin_role');
    return saved === 'admin' || saved === 'master';
  });
  const [passcode, setPasscode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderData | null>(null);
  const [activeTab, setActiveTab] = useState<'bookings' | 'promo' | 'pricing' | 'profile' | 'business' | 'offline' | 'customers' | 'analytics' | 'deleted_orders' | 'webhooks'>('bookings');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);

  // Login Form states
  const [loginTab, setLoginTab] = useState<'admin' | 'master'>('admin');
  const [masterEmail, setMasterEmail] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [showMasterPassword, setShowMasterPassword] = useState(false);

  // Deleted orders list
  const [deletedOrders, setDeletedOrders] = useState<any[]>(() => {
    const saved = localStorage.getItem('tumblespin_deleted_orders');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {}
    }
    return [];
  });

  // Master Admin Password change states
  const [masterCurrentPass, setMasterCurrentPass] = useState('');
  const [masterNewPass, setMasterNewPass] = useState('');
  const [masterConfirmNewPass, setMasterConfirmNewPass] = useState('');
  const [masterPasswordSuccessMsg, setMasterPasswordSuccessMsg] = useState('');
  const [masterPasswordErrorMsg, setMasterPasswordErrorMsg] = useState('');

  const [notifToast, setNotifToast] = useState({ visible: false, message: '', status: '' });
  const [newBookingAlert, setNewBookingAlert] = useState<{
    visible: boolean;
    orderId: string;
    customerName: string;
    amount: number;
    phone: string;
    services: string[];
  } | null>(null);
  const [notificationLogs, setNotificationLogs] = useState<Array<{
    id: string;
    orderId: string;
    channel: 'SMS' | 'Email' | 'WhatsApp';
    recipient: string;
    message: string;
    timestamp: string;
    status: 'Delivered' | 'Sent' | 'Failed';
  }>>(() => {
    const saved = localStorage.getItem('tumblespin_notif_logs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {}
    }
    return [
      {
        id: 'notif-1',
        orderId: 'TS-2026-101',
        channel: 'Email',
        recipient: 'Prakashcsat@gmail.com',
        message: 'Your Tumble Spin order status updated to At Laundry Facility.',
        timestamp: new Date(Date.now() - 3600000 * 2).toLocaleString(),
        status: 'Delivered'
      },
      {
        id: 'notif-2',
        orderId: 'TS-2026-101',
        channel: 'SMS',
        recipient: '+91 9606032491',
        message: 'TUMBLE SPIN: Valet pickup scheduled successfully for order TS-2026-101.',
        timestamp: new Date(Date.now() - 3600000 * 3).toLocaleString(),
        status: 'Delivered'
      }
    ];
  });

  // Business details state
  const businessInfo = useBusinessInfo();
  const initialBusiness = getBusinessInfo();
  const [editBusinessName, setEditBusinessName] = useState(initialBusiness.name);
  const [editBusinessEmail, setEditBusinessEmail] = useState(initialBusiness.email);
  const [editBusinessPhone, setEditBusinessPhone] = useState(initialBusiness.phone);
  const [editBusinessAddress, setEditBusinessAddress] = useState(initialBusiness.address);
  const [editBusinessRazorpayUrl, setEditBusinessRazorpayUrl] = useState(initialBusiness.razorpayUrl || 'https://razorpay.me/@tumblespin');
  const [businessSuccessMsg, setBusinessSuccessMsg] = useState('');

  // Email Gateway Settings state (Admin mail notification on any host)
  const [adminNotifyEmail, setAdminNotifyEmail] = useState('tumblespin26@gmail.com');
  const [emailSmtpHost, setEmailSmtpHost] = useState('smtp.gmail.com');
  const [emailSmtpPort, setEmailSmtpPort] = useState('465');
  const [emailSmtpUser, setEmailSmtpUser] = useState('');
  const [emailSmtpPass, setEmailSmtpPass] = useState('');
  const [emailSmtpFrom, setEmailSmtpFrom] = useState('Tumble Spin Premium');
  const [emailResendApiKey, setEmailResendApiKey] = useState('');
  const [hasStoredSmtpPass, setHasStoredSmtpPass] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [emailSettingsLoading, setEmailSettingsLoading] = useState(false);
  const [emailSettingsMsg, setEmailSettingsMsg] = useState<{ type: string; text: string }>({ type: '', text: '' });
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<any>(null);

  // Webhook Logs & Payload Debugger state
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookFilterQuery, setWebhookFilterQuery] = useState('');
  const [selectedPayloadLog, setSelectedPayloadLog] = useState<any | null>(null);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [simulatingWebhook, setSimulatingWebhook] = useState(false);
  const [clearingMockWebhooks, setClearingMockWebhooks] = useState(false);

  const fetchWebhookLogs = async () => {
    try {
      setWebhookLoading(true);
      const res = await fetch('/api/admin/webhooks');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          setWebhookLogs(data.logs);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch webhook logs:', e);
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleClearMockWebhooks = async () => {
    try {
      setClearingMockWebhooks(true);
      const res = await fetch('/api/admin/clear-mock-webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        await fetchWebhookLogs();
      }
    } catch (e) {
      console.error('Error purging mock webhooks:', e);
    } finally {
      setClearingMockWebhooks(false);
    }
  };

  const handleSimulateWebhook = async () => {
    try {
      setSimulatingWebhook(true);
      const res = await fetch('/api/admin/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 660, status: 'SUCCESS' })
      });
      const data = await res.json();
      if (data.success) {
        await fetchWebhookLogs();
      }
    } catch (e) {
      console.error('Error triggering simulated webhook:', e);
    } finally {
      setSimulatingWebhook(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'webhooks') {
      fetchWebhookLogs();
    }
  }, [activeTab]);

  const fetchEmailSettings = async () => {
    try {
      setEmailSettingsLoading(true);
      const res = await fetch('/api/admin/email-settings');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.adminEmail) setAdminNotifyEmail(data.adminEmail);
          if (data.smtpHost) setEmailSmtpHost(data.smtpHost);
          if (data.smtpPort) setEmailSmtpPort(String(data.smtpPort));
          if (data.smtpUser) setEmailSmtpUser(data.smtpUser);
          if (data.smtpFrom) setEmailSmtpFrom(data.smtpFrom);
          if (data.resendApiKey) setEmailResendApiKey(data.resendApiKey);
          setHasStoredSmtpPass(data.hasSmtpPass);
          if (data.hasSmtpPass) {
            setEmailSmtpPass('***KEEP_EXISTING***');
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch email settings:', e);
    } finally {
      setEmailSettingsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'business') {
      fetchEmailSettings();
    }
  }, [activeTab]);

  const handleSaveEmailSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSettingsMsg({ type: '', text: '' });
    try {
      setEmailSettingsLoading(true);
      const res = await fetch('/api/admin/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: adminNotifyEmail,
          smtpHost: emailSmtpHost,
          smtpPort: emailSmtpPort,
          smtpUser: emailSmtpUser,
          smtpPass: emailSmtpPass,
          smtpFrom: emailSmtpFrom,
          resendApiKey: emailResendApiKey
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEmailSettingsMsg({ type: 'success', text: '🎉 Admin email gateway details saved & synced to Firestore successfully!' });
        fetchEmailSettings();
      } else {
        setEmailSettingsMsg({ type: 'error', text: data.error || 'Failed to save email settings' });
      }
    } catch (e: any) {
      setEmailSettingsMsg({ type: 'error', text: e?.message || 'Network error saving email settings' });
    } finally {
      setEmailSettingsLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    setTestEmailResult(null);
    setTestEmailLoading(true);
    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testEmail: adminNotifyEmail })
      });
      const data = await res.json();
      setTestEmailResult(data);
    } catch (e: any) {
      setTestEmailResult({ success: false, error: e?.message || 'Network error sending test email' });
    } finally {
      setTestEmailLoading(false);
    }
  };

  // Offline counter billing state
  const [offlineCustomerName, setOfflineCustomerName] = useState('');
  const [offlineCustomerPhone, setOfflineCustomerPhone] = useState('');
  const [offlineCustomerEmail, setOfflineCustomerEmail] = useState('');
  const [offlineCustomerAddress, setOfflineCustomerAddress] = useState('');
  const [offlineCareOption, setOfflineCareOption] = useState('standard');
  const [offlineSpecialInstructions, setOfflineSpecialInstructions] = useState('');
  const [offlineCart, setOfflineCart] = useState<SubServiceItem[]>([]);
  const [offlineSuccessMsg, setOfflineSuccessMsg] = useState('');

  // Load initial inventory state from localStorage
  const [inventory, setInventory] = useState<{ [id: string]: { name: string; stock: number; available: boolean } }>(() => {
    const saved = localStorage.getItem('tumblespin_inventory');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {}
    }
    const defaults = {
      'men-shirt': { name: 'Shirt / T-Shirt', stock: 50, available: true },
      'men-trouser': { name: 'Trouser / Jeans', stock: 40, available: true },
      'men-suit-2pc': { name: 'Men Suit 2 Pcs', stock: 15, available: true },
      'women-kurta': { name: 'Kurta Set', stock: 30, available: true },
      'women-saree': { name: 'Silk / Banarasi Saree', stock: 20, available: true },
      'wool-sweater': { name: 'Sweater / Cardigan', stock: 25, available: true },
      'wool-jacket': { name: 'Heavy Winter Jacket', stock: 15, available: true },
      'house-blanket-double': { name: 'Blanket Double Ply', stock: 10, available: true },
      'shoes-sneakers': { name: 'Sports / Canvas Sneakers', stock: 12, available: true },
      'laundry-wash-fold': { name: 'Wash & Fold (per kg)', stock: 100, available: true },
      'laundry-wash-steam-iron': { name: 'Wash & Steam Iron (per kg)', stock: 80, available: true }
    };
    localStorage.setItem('tumblespin_inventory', JSON.stringify(defaults));
    return defaults;
  });

  const [activeReceiptOrder, setActiveReceiptOrder] = useState<any | null>(null);
  const [isInventoryExpanded, setIsInventoryExpanded] = useState(false);

  // Helper to fetch an item's inventory safely
  const getItemInventory = (itemId: string) => {
    return inventory[itemId] || { name: itemId, stock: 999, available: true };
  };

  // Helper to deduct stock for active cart items when billing completes
  const adjustStockForCart = (cart: SubServiceItem[]) => {
    const updated = { ...inventory };
    let hasChanges = false;

    cart.forEach(cartItem => {
      const invItem = updated[cartItem.id];
      if (invItem) {
        const newStock = Math.max(0, invItem.stock - cartItem.quantity);
        updated[cartItem.id] = {
          ...invItem,
          stock: newStock,
          available: newStock > 0
        };
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setInventory(updated);
      localStorage.setItem('tumblespin_inventory', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    }
  };

  // Custom offline item state
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');

  const OFFLINE_CATALOG_ITEMS = [
    { id: 'men-shirt', name: 'Shirt / T-Shirt', category: 'men', price: 99, serviceType: 'Premium Dry Clean' },
    { id: 'men-trouser', name: 'Trouser / Jeans', category: 'men', price: 99, serviceType: 'Premium Dry Clean' },
    { id: 'men-suit-2pc', name: 'Men Suit 2 Pcs', category: 'men', price: 430, serviceType: 'Premium Dry Clean' },
    { id: 'women-kurta', name: 'Kurta Set', category: 'women', price: 149, serviceType: 'Premium Dry Clean' },
    { id: 'women-saree', name: 'Silk / Banarasi Saree', category: 'women', price: 230, serviceType: 'Premium Dry Clean' },
    { id: 'wool-sweater', name: 'Sweater / Cardigan', category: 'woolens', price: 149, serviceType: 'Woolen Dry Clean' },
    { id: 'wool-jacket', name: 'Heavy Winter Jacket', category: 'woolens', price: 299, serviceType: 'Woolen Dry Clean' },
    { id: 'house-blanket-double', name: 'Blanket Double Ply', category: 'household', price: 349, serviceType: 'Household Care' },
    { id: 'shoes-sneakers', name: 'Sports / Canvas Sneakers', category: 'shoes', price: 299, serviceType: 'Deep Clean' },
    { id: 'laundry-wash-fold', name: 'Wash & Fold (per kg)', category: 'laundry', price: 95, serviceType: 'Wash & Fold' },
    { id: 'laundry-wash-steam-iron', name: 'Wash & Steam Iron (per kg)', category: 'laundry', price: 129, serviceType: 'Wash & Iron' },
  ];

  const handleSaveBusinessInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setBusinessInfo({
      name: editBusinessName.trim(),
      email: editBusinessEmail.trim(),
      phone: editBusinessPhone.trim(),
      address: editBusinessAddress.trim(),
      razorpayUrl: editBusinessRazorpayUrl.trim()
    });
    setBusinessSuccessMsg('🎉 Business contact details synchronized successfully to Firestore!');
    setTimeout(() => setBusinessSuccessMsg(''), 4000);
  };

  const getOfflineSubtotal = () => {
    return offlineCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const getOfflineGrandTotal = () => {
    const subtotal = getOfflineSubtotal();
    if (dynamicPricing && dynamicPricing.mode !== 'none' && dynamicPricing.percentage > 0) {
      const isSurcharge = dynamicPricing.mode === 'surcharge';
      const change = Math.round((subtotal * dynamicPricing.percentage) / 100);
      return isSurcharge ? subtotal + change : Math.max(0, subtotal - change);
    }
    return subtotal;
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customItemName.trim() || !customItemPrice.trim()) return;
    const price = parseFloat(customItemPrice);
    if (isNaN(price) || price < 0) return;

    const newItem: SubServiceItem = {
      id: `custom-${Date.now()}`,
      name: customItemName.trim(),
      category: 'custom',
      price: price,
      quantity: 1,
      serviceType: 'Offline Item'
    };

    setOfflineCart([...offlineCart, newItem]);
    setCustomItemName('');
    setCustomItemPrice('');
  };

  const handleUpdateCartQuantity = (itemId: string, delta: number) => {
    setOfflineCart(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const handleAddCatalogToCart = (item: typeof OFFLINE_CATALOG_ITEMS[0]) => {
    const existing = offlineCart.find(c => c.id === item.id);
    if (existing) {
      handleUpdateCartQuantity(item.id, 1);
    } else {
      setOfflineCart([...offlineCart, { ...item, quantity: 1 }]);
    }
  };

  const handleGenerateOfflineBill = (e: React.FormEvent, action: 'whatsapp' | 'download' | 'save') => {
    e.preventDefault();
    if (!offlineCustomerName.trim() || !offlineCustomerPhone.trim()) {
      alert('Please enter at least customer name and phone number.');
      return;
    }
    if (offlineCart.length === 0) {
      alert('Please add at least one item to the cart.');
      return;
    }

    const orderId = `TS-OFF-${Date.now().toString().slice(-6)}`;
    const newOrder = {
      orderId,
      fullName: offlineCustomerName.trim(),
      email: offlineCustomerEmail.trim() || 'walkin@tumblespin.com',
      phone: offlineCustomerPhone.trim(),
      address: offlineCustomerAddress.trim() || 'Offline Walk-in Customer',
      pickupDate: new Date().toISOString().split('T')[0],
      pickupTimeSlot: 'Store Drop-off',
      deliveryDate: new Date(Date.now() + 172800000).toISOString().split('T')[0], // +2 days
      deliveryTimeSlot: 'Store Pickup',
      garmentCareOption: offlineCareOption,
      specialInstructions: offlineSpecialInstructions.trim(),
      selectedServices: ['Walk-in Counter Service'],
      subServices: offlineCart.map(i => ({
        name: i.name,
        serviceType: i.serviceType,
        price: i.price,
        quantity: i.quantity
      })),
      totalPrice: getOfflineGrandTotal(),
      status: 'Order Confirmed',
      paymentMethod: 'UPI / Dynamic QR',
      createdAt: new Date().toISOString(),
      dynamicPricing: dynamicPricing
    };

    if (action === 'download' || action === 'save') {
      downloadInvoice({
        orderId: newOrder.orderId,
        fullName: newOrder.fullName,
        email: newOrder.email,
        phone: newOrder.phone,
        address: newOrder.address,
        pickupDate: newOrder.pickupDate,
        pickupTimeSlot: newOrder.pickupTimeSlot,
        deliveryDate: newOrder.deliveryDate,
        deliveryTimeSlot: newOrder.deliveryTimeSlot,
        garmentCareOption: newOrder.garmentCareOption,
        specialInstructions: newOrder.specialInstructions,
        subServices: newOrder.subServices,
        totalPrice: newOrder.totalPrice,
        createdAt: newOrder.createdAt,
        paymentMethod: newOrder.paymentMethod,
        dynamicPricing: dynamicPricing
      });
    }

    if (action === 'whatsapp') {
      const itemsSummary = newOrder.subServices.map(i => `${i.name} (x${i.quantity})`).join(', ');
      const text = `✨ *TUMBLE SPIN - OFFLINE STORE INVOICE* ✨\n\n*Receipt:* ${newOrder.orderId}\n*Client:* ${newOrder.fullName}\n*Phone:* ${newOrder.phone}\n*Fresh Items:* ${itemsSummary}\n*Total Bill:* ₹${newOrder.totalPrice}\n*Store Operator:* ${adminProfile.name}\n\n_Thank you for visiting Tumble Spin! Your receipt has been generated successfully._`;
      const url = `https://wa.me/91${newOrder.phone}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    }

    if (action === 'save' || action === 'whatsapp' || action === 'download') {
      // Deduct stock levels for items in the cart
      adjustStockForCart(offlineCart);

      // Also save the order to the list so it is persisted in Firestore and shows up in Bookings list!
      const currentOrders = [...orders];
      const trackingTimeline = [
        { step: 1, title: 'Order Confirmed', desc: 'Walk-in Counter drop-off received and billed.', time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), done: true, active: true },
        { step: 2, title: 'In-Facility Fabric Screening', desc: 'Analyzing stains, sorting, and selecting care program.', time: 'Pending', done: false, active: false },
        { step: 3, title: 'Returned Flawless', desc: 'Garments refreshed, hand-finished and ready at counter.', time: 'Pending', done: false, active: false }
      ];

      const fullOrderRecord = {
        ...newOrder,
        adminViewed: true,
        timeline: trackingTimeline
      };

      const updatedOrders = [fullOrderRecord, ...currentOrders];
      setOrders(updatedOrders);
      localStorage.setItem('tumblespin_orders', JSON.stringify(updatedOrders));

      // Trigger the beautiful interactive Print Receipt Preview
      if (action === 'save') {
        setActiveReceiptOrder(fullOrderRecord);
      }
      
      setOfflineSuccessMsg(`🎉 Invoice ${orderId} successfully generated and stored!`);
      // Reset walk-in counter form fields
      setOfflineCustomerName('');
      setOfflineCustomerPhone('');
      setOfflineCustomerEmail('');
      setOfflineCustomerAddress('');
      setOfflineSpecialInstructions('');
      setOfflineCart([]);
      setTimeout(() => setOfflineSuccessMsg(''), 6000);
    }
  };

  // Admin Profile management state
  const [adminProfile, setAdminProfile] = useState(() => {
    const saved = localStorage.getItem('tumblespin_admin_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {}
    }
    return { name: 'Prakash Chandra S', email: 'Prakashcsat@gmail.com', phone: '9606032491' };
  });

  const [editAdminName, setEditAdminName] = useState(adminProfile.name);
  const [editAdminEmail, setEditAdminEmail] = useState(adminProfile.email);
  const [editAdminPhone, setEditAdminPhone] = useState(adminProfile.phone);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState('');

  // Password change states
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState('');
  const [passwordErrorMsg, setPasswordErrorMsg] = useState('');

  const [storedAdminPassword, setStoredAdminPassword] = useState(() => {
    return localStorage.getItem('tumblespin_admin_password') || 'admin123';
  });
  const [storedMasterPassword, setStoredMasterPassword] = useState(() => {
    return localStorage.getItem('tumblespin_master_password') || 'master';
  });

  // Promo editing fields
  const [promoEnabled, setPromoEnabled] = useState(promoConfig.isEnabled);
  const [promoDiscount, setPromoDiscount] = useState(promoConfig.discountText);
  const [promoAppliedOn, setPromoAppliedOn] = useState(promoConfig.appliedOnText);
  const [promoBg, setPromoBg] = useState(promoConfig.bgColor);

  // Dynamic pricing editing fields
  const [pricingMode, setPricingMode] = useState<'surcharge' | 'discount' | 'none'>(dynamicPricing.mode);
  const [pricingPercentage, setPricingPercentage] = useState<number>(dynamicPricing.percentage);
  const [pricingLabel, setPricingLabel] = useState<string>(dynamicPricing.label);

  // Manual Price Editor fields
  const [customPrices, setCustomPrices] = useState<any>(() => {
    const saved = localStorage.getItem('tumblespin_custom_prices');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return { services: {}, estimator: {}, booking: {} };
  });

  const [localPricesDraft, setLocalPricesDraft] = useState<any>({ services: {}, estimator: {}, booking: {} });
  const [priceEditorSearch, setPriceEditorSearch] = useState('');
  const [priceEditorTab, setPriceEditorTab] = useState<'services' | 'estimator' | 'booking'>('services');
  const [priceSuccessMessage, setPriceSuccessMessage] = useState('');

  // Theme state: permanently set to Night Light (dark mode) across entire website
  const adminTheme = 'dark';

  // Apply dark mode (Night Light) permanently
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.style.backgroundColor = '#0B0914';
    document.documentElement.style.colorScheme = 'dark';
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('tumblespin_admin_theme', 'dark');
  }, [isOpen, isAuthorized]);

  // Listen for real-time new booking notifications dispatched from Firebase snapshot listener
  useEffect(() => {
    const handleNewOrderAlert = (e: Event) => {
      const customEvent = e as CustomEvent;
      const order = customEvent.detail;
      if (order && order.orderId) {
        // Trigger alert state
        setNewBookingAlert({
          visible: true,
          orderId: order.orderId,
          customerName: order.fullName || 'Anonymous Client',
          amount: order.totalPrice || 0,
          phone: order.phone || '',
          services: order.selectedServices || []
        });

        // Instantly reload orders to show the new document in real-time
        loadOrders();

        // Optional: play a subtle premium alert chime
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(587.33, oscillator.context.currentTime); // D5
          gainNode.gain.setValueAtTime(0.12, oscillator.context.currentTime);
          oscillator.start();
          oscillator.stop(oscillator.context.currentTime + 0.12);
          
          setTimeout(() => {
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880, osc2.context.currentTime); // A5
            gain2.gain.setValueAtTime(0.12, osc2.context.currentTime);
            osc2.start();
            osc2.stop(osc2.context.currentTime + 0.22);
          }, 120);
        } catch (audioErr) {
          console.log('Chime blocked by browser policy:', audioErr);
        }
      }
    };

    window.addEventListener('tumblespin_new_order_alert', handleNewOrderAlert);
    return () => {
      window.removeEventListener('tumblespin_new_order_alert', handleNewOrderAlert);
    };
  }, []);

  // Search & Filter state variables for locating orders
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState('all');
  const [adminGroupFilter, setAdminGroupFilter] = useState<'all' | 'pending' | 'processing' | 'ready' | 'delivered' | 'unread'>('all');
  const [adminDateFilter, setAdminDateFilter] = useState('');
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  // Sync edits when prop updates
  useEffect(() => {
    if (isOpen) {
      setPromoEnabled(promoConfig.isEnabled);
      setPromoDiscount(promoConfig.discountText);
      setPromoAppliedOn(promoConfig.appliedOnText);
      setPromoBg(promoConfig.bgColor);

      setPricingMode(dynamicPricing.mode);
      setPricingPercentage(dynamicPricing.percentage);
      setPricingLabel(dynamicPricing.label);

      const savedPrices = localStorage.getItem('tumblespin_custom_prices');
      let parsedPrices = { services: {}, estimator: {}, booking: {} };
      if (savedPrices) {
        try {
          parsedPrices = JSON.parse(savedPrices);
        } catch (e) {}
      }
      setCustomPrices(parsedPrices);
      setLocalPricesDraft(JSON.parse(JSON.stringify(parsedPrices))); // deep copy

      // Load admin profile settings dynamically on open
      const savedAdmin = localStorage.getItem('tumblespin_admin_profile');
      if (savedAdmin) {
        try {
          const parsed = JSON.parse(savedAdmin);
          setAdminProfile(parsed);
          setEditAdminName(parsed.name);
          setEditAdminEmail(parsed.email);
          setEditAdminPhone(parsed.phone);
        } catch (err) {}
      }
    }
  }, [isOpen, promoConfig, dynamicPricing]);

  // Synchronize from localStorage when modified in background (Firestore real-time sync / multi-device updates)
  useEffect(() => {
    // Seed default master password if missing
    const savedMaster = localStorage.getItem('tumblespin_master_password');
    if (!savedMaster) {
      localStorage.setItem('tumblespin_master_password', 'master');
    }

    const handleStorageChange = () => {
      const savedInv = localStorage.getItem('tumblespin_inventory');
      if (savedInv) {
        try {
          setInventory(JSON.parse(savedInv));
        } catch (err) {}
      }

      const savedOrders = localStorage.getItem('tumblespin_orders');
      if (savedOrders) {
        try {
          setOrders(JSON.parse(savedOrders));
        } catch (err) {}
      }

      const savedDeleted = localStorage.getItem('tumblespin_deleted_orders');
      if (savedDeleted) {
        try {
          setDeletedOrders(JSON.parse(savedDeleted));
        } catch (err) {}
      }

      const savedPromo = localStorage.getItem('tumblespin_promo');
      if (savedPromo) {
        try {
          const parsed = JSON.parse(savedPromo);
          setPromoEnabled(parsed.isEnabled);
          setPromoDiscount(parsed.discountText);
          setPromoAppliedOn(parsed.appliedOnText);
          setPromoBg(parsed.bgColor);
        } catch (err) {}
      }

      const savedPricing = localStorage.getItem('tumblespin_dynamic_pricing');
      if (savedPricing) {
        try {
          const parsed = JSON.parse(savedPricing);
          setPricingMode(parsed.mode);
          setPricingPercentage(parsed.percentage);
          setPricingLabel(parsed.label);
        } catch (err) {}
      }

      const savedCustomPrices = localStorage.getItem('tumblespin_custom_prices');
      if (savedCustomPrices) {
        try {
          const parsed = JSON.parse(savedCustomPrices);
          setCustomPrices(parsed);
          setLocalPricesDraft(JSON.parse(JSON.stringify(parsed)));
        } catch (err) {}
      }

      const savedBusiness = localStorage.getItem('tumblespin_business_info');
      if (savedBusiness) {
        try {
          const parsed = JSON.parse(savedBusiness);
          setEditBusinessName(parsed.name);
          setEditBusinessEmail(parsed.email);
          setEditBusinessPhone(parsed.phone);
          setEditBusinessAddress(parsed.address);
          setEditBusinessRazorpayUrl(parsed.razorpayUrl || 'https://razorpay.me/@tumblespin');
        } catch (err) {}
      }

      const savedAdmin = localStorage.getItem('tumblespin_admin_profile');
      if (savedAdmin) {
        try {
          const parsed = JSON.parse(savedAdmin);
          setAdminProfile(parsed);
          setEditAdminName(parsed.name);
          setEditAdminEmail(parsed.email);
          setEditAdminPhone(parsed.phone);
        } catch (err) {}
      }

      const savedAdminPass = localStorage.getItem('tumblespin_admin_password');
      if (savedAdminPass) {
        setStoredAdminPassword(savedAdminPass);
      }

      const savedMasterPass = localStorage.getItem('tumblespin_master_password');
      if (savedMasterPass) {
        setStoredMasterPassword(savedMasterPass);
      }

      const savedRole = localStorage.getItem('tumblespin_admin_role');
      if (savedRole === 'admin' || savedRole === 'master') {
        setAdminRole(savedRole as any);
        setIsAuthorized(true);
      } else if (!savedRole) {
        setAdminRole(null);
        setIsAuthorized(false);
      }

      // Reload orders whenever local storage is modified
      loadOrders();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Authenticate Admin
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginTab === 'admin') {
      const storedPass = storedAdminPassword;
      if (passcode === storedPass || (storedPass === 'admin' && passcode === 'admin123') || (storedPass === 'admin123' && passcode === 'admin')) {
        setIsAuthorized(true);
        setAdminRole('admin');
        localStorage.setItem('tumblespin_admin_role', 'admin');
        setErrorMsg('');
      } else {
        setErrorMsg('Incorrect administrative passcode. Access Denied.');
      }
    } else {
      const storedMasterPass = storedMasterPassword;
      const isMasterEmail = masterEmail.trim().toLowerCase() === 'prakashcsat@gmail.com';
      if (isMasterEmail && masterPassword === storedMasterPass) {
        setIsAuthorized(true);
        setAdminRole('master');
        localStorage.setItem('tumblespin_admin_role', 'master');
        setErrorMsg('');
      } else {
        setErrorMsg('Incorrect Master Admin email or password. Access Denied.');
      }
    }
  };

  // Master Admin Password change action
  const handleUpdateMasterPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setMasterPasswordErrorMsg('');
    setMasterPasswordSuccessMsg('');

    const savedMasterPass = localStorage.getItem('tumblespin_master_password') || 'master';
    if (masterCurrentPass !== savedMasterPass) {
      setMasterPasswordErrorMsg('⚠️ Error: Current Master Admin password is incorrect.');
      return;
    }

    if (!masterNewPass.trim()) {
      setMasterPasswordErrorMsg('⚠️ Error: New password cannot be empty.');
      return;
    }

    if (masterNewPass !== masterConfirmNewPass) {
      setMasterPasswordErrorMsg('⚠️ Error: Password confirmation does not match.');
      return;
    }

    localStorage.setItem('tumblespin_master_password', masterNewPass.trim());
    setStoredMasterPassword(masterNewPass.trim());
    window.dispatchEvent(new Event('storage'));
    setMasterPasswordSuccessMsg('✨ Success: Master Admin password updated permanently!');
    setMasterCurrentPass('');
    setMasterNewPass('');
    setMasterConfirmNewPass('');
    
    setTimeout(() => {
      setMasterPasswordSuccessMsg('');
    }, 4000);
  };

  // Password change action
  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrorMsg('');
    setPasswordSuccessMsg('');

    const savedPass = localStorage.getItem('tumblespin_admin_password') || 'admin';
    if (currentPass !== savedPass && !(savedPass === 'admin' && currentPass === 'admin123')) {
      setPasswordErrorMsg('⚠️ Error: Current administrative passcode is incorrect.');
      return;
    }

    if (!newPass.trim()) {
      setPasswordErrorMsg('⚠️ Error: New passcode cannot be empty.');
      return;
    }

    if (newPass !== confirmNewPass) {
      setPasswordErrorMsg('⚠️ Error: Passcode confirmation does not match.');
      return;
    }

    localStorage.setItem('tumblespin_admin_password', newPass.trim());
    setStoredAdminPassword(newPass.trim());
    window.dispatchEvent(new Event('storage'));
    setPasswordSuccessMsg('✨ Success: Passcode updated permanently inside local database!');
    setCurrentPass('');
    setNewPass('');
    setConfirmNewPass('');
    
    setTimeout(() => {
      setPasswordSuccessMsg('');
    }, 4000);
  };

  // Profile save action
  const handleSaveAdminProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAdminName.trim()) {
      setProfileSuccessMessage('⚠️ Error: Admin Name cannot be empty.');
      return;
    }
    const updated = {
      name: editAdminName.trim(),
      email: editAdminEmail.trim() || 'Prakashcsat@gmail.com',
      phone: editAdminPhone.trim() || '9606032491'
    };
    setAdminProfile(updated);
    localStorage.setItem('tumblespin_admin_profile', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    
    setProfileSuccessMessage('✨ Success: Administrative credentials and details saved permanently!');
    setTimeout(() => {
      setProfileSuccessMessage('');
    }, 4000);
  };

  // Load orders from localStorage
  const loadOrders = () => {
    const stored = localStorage.getItem('tumblespin_orders');
    const deletedStr = localStorage.getItem('tumblespin_deleted_orders') || '[]';
    let deletedIds: string[] = [];
    try {
      const parsedDeleted = JSON.parse(deletedStr);
      if (Array.isArray(parsedDeleted)) {
        deletedIds = parsedDeleted.map((o: any) => o.orderId).filter(Boolean);
      }
    } catch (e) {}

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as (OrderData & { isMock?: boolean })[];
        // Filter out any orders that have been deleted
        const filteredFromDeleted = parsed.filter(o => o && o.orderId && !deletedIds.includes(o.orderId));

        // Check if we have any real user-created orders
        const hasRealOrders = filteredFromDeleted.some(o => !o.isMock);
        if (hasRealOrders) {
          // Permanently purge any pre-seeded mock orders!
          const realOnly = filteredFromDeleted.filter(o => !o.isMock);
          if (realOnly.length !== parsed.length) {
            localStorage.setItem('tumblespin_orders', JSON.stringify(realOnly));
            setOrders(realOnly);
            window.dispatchEvent(new Event('storage'));
            return;
          }
        }
        
        if (filteredFromDeleted.length !== parsed.length) {
          localStorage.setItem('tumblespin_orders', JSON.stringify(filteredFromDeleted));
          setOrders(filteredFromDeleted);
          window.dispatchEvent(new Event('storage'));
          return;
        }
        setOrders(filteredFromDeleted);
      } catch (err) {
        console.error(err);
      }
    } else {
      // Seed initial dummy reference orders so the screen isn't dry, with 'isMock: true' tag
      const initialSeed: (OrderData & { isMock: boolean })[] = [
        {
          orderId: 'TS-2026-101',
          fullName: 'Prakash Chandra S',
          phone: '9606032491',
          email: 'Prakashcsat@gmail.com',
          address: 'Tumble Spin, #6, 80 feet road, Kengeri Ring Rd, Mariyappana Palya, Bengaluru, Karnataka 560056, India',
          pickupDate: '2026-06-30',
          pickupTimeSlot: '11:00 AM - 02:00 PM',
          deliveryDate: '2026-07-03',
          deliveryTimeSlot: '05:00 PM - 08:00 PM',
          garmentCareOption: 'organic-scentless',
          specialInstructions: 'Please handle the Banarasi Silk Saree with absolute maximum attention.',
          selectedServices: ['dry-cleaning', 'premium-care'],
          subServices: [
            { id: 'men-suit-3pc', name: 'Men Suit 3 Pcs', category: 'men', price: 530, quantity: 1, serviceType: 'Dry Clean' },
            { id: 'women-saree', name: 'Silk Saree', category: 'women', price: 230, quantity: 1, serviceType: 'Dry Clean' }
          ],
          totalPrice: 760,
          status: 'At Laundry Facility',
          timeline: [
            { step: 1, title: 'Order Confirmed', desc: 'Booking received and digital invoice dispatched.', time: 'June 30, 2026 - 08:30 AM', done: true, active: false },
            { step: 2, title: 'Valet Pickup Completed', desc: 'Collected securely from doorstep by Ramesh Kumar.', time: 'June 30, 2026 - 11:15 AM', done: true, active: false },
            { step: 3, title: 'In-Facility Fabric Screening', desc: 'Screened by fabric masters; eco-safe wash initiated.', time: 'June 30, 2026 - 02:45 PM', done: true, active: true },
            { step: 4, title: 'Quality Pressed & Inspected', desc: 'Delicately steam pressed and vetted under high-density lighting.', time: 'July 01, 2026 - Pending', done: false, active: false },
            { step: 5, title: 'Returned Flawless', desc: 'Securely bagged in breathable linen; ready for delivery.', time: 'July 03, 2026 - Pending', done: false, active: false },
          ],
          createdAt: new Date().toISOString(),
          isMock: true
        },
        {
          orderId: 'TS-2026-102',
          fullName: 'Ananya Rao',
          phone: '9876543210',
          email: 'ananya.rao@gmail.com',
          address: 'Block C, Prestige Lakeside Habitat, Varthur, Bangalore',
          pickupDate: '2026-07-01',
          pickupTimeSlot: '08:00 AM - 11:00 AM',
          deliveryDate: '2026-07-03',
          deliveryTimeSlot: '05:00 PM - 08:00 PM',
          garmentCareOption: 'standard',
          selectedServices: ['wash-fold'],
          subServices: [
            { id: 'laundry-wash-fold', name: 'Wash & Fold', category: 'laundry', price: 95, quantity: 5, serviceType: 'Wash & Fold' }
          ],
          totalPrice: 475,
          status: 'Order Confirmed',
          timeline: [
            { step: 1, title: 'Order Confirmed', desc: 'Booking received. Valet dispatch initiated.', time: 'Just Now', done: true, active: true },
            { step: 2, title: 'Valet Pickup Completed', desc: 'Arjun Gowda is arriving for doorstep garment verification.', time: 'Arriving in 45 Mins', done: false, active: false },
            { step: 3, title: 'In-Facility Fabric Screening', desc: 'Processing at our master textile cleaning plant.', time: 'Pending Pickup', done: false, active: false },
            { step: 4, title: 'Quality Pressed & Inspected', desc: 'Inspected under pristine studio lighting.', time: 'Pending', done: false, active: false },
            { step: 5, title: 'Returned Flawless', desc: 'Handpacked in breathable protective garment covers.', time: 'Pending', done: false, active: false },
          ],
          createdAt: new Date().toISOString(),
          isMock: true
        }
      ];
      localStorage.setItem('tumblespin_orders', JSON.stringify(initialSeed));
      setOrders(initialSeed);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadOrders();
    }
  }, [isOpen]);

  // Update order status and reconstruct timeline dynamically
  const handleUpdateStatus = (orderId: string, newStatus: string) => {
    let targetOrder: OrderData | null = null;

    const updatedOrders = orders.map(order => {
      if (order.orderId === orderId) {
        targetOrder = order;
        // Reconstruct timeline depending on the step index
        const currentStepIndex = STATUS_OPTIONS.indexOf(newStatus) + 1;
        const newTimeline = order.timeline.map((item, idx) => {
          const stepNum = idx + 1;
          const isDone = stepNum < currentStepIndex;
          const isActive = stepNum === currentStepIndex;
          const statusText = stepNum === 1 ? 'Order Confirmed'
                           : stepNum === 2 ? 'Valet Pickup Completed'
                           : stepNum === 3 ? 'At Laundry Facility'
                           : stepNum === 4 ? 'Quality pressed'
                           : 'Ready for doorstep drop-off';

          return {
            ...item,
            done: isDone || isActive,
            active: isActive,
            time: isDone || isActive ? (item.time.includes('Pending') ? new Date().toLocaleString() : item.time) : 'Pending'
          };
        });

        const updated = {
          ...order,
          status: newStatus,
          orderStatus: mapStatusToOrderStatus(newStatus),
          timeline: newTimeline
        };

        if (selectedOrder?.orderId === orderId) {
          setSelectedOrder(updated);
        }

        return updated;
      }
      return order;
    });

    setOrders(updatedOrders);
    localStorage.setItem('tumblespin_orders', JSON.stringify(updatedOrders));

    // Direct Firestore update for instant synchronization
    const targetUpdated = updatedOrders.find(o => o.orderId === orderId);
    if (targetUpdated) {
      try {
        setDoc(doc(db, 'orders', orderId), targetUpdated).catch(err => {
          console.warn('Direct Firestore status update failed, sync will fallback:', err);
        });
      } catch (fsErr) {
        console.warn('Direct Firestore update error in handleUpdateStatus:', fsErr);
      }
    }

    // Dispatch custom storage change event for OrderTracking and other components to listen instantly
    window.dispatchEvent(new Event('storage'));

    // Trigger automatic Email & SMS notifications for status updates
    if (targetOrder) {
      const orderToNotify = targetOrder as OrderData;
      const timestamp = new Date().toLocaleString();
      
      const smsMessage = `TUMBLE SPIN: Your garment care order #${orderId} status has changed to [${newStatus}]. Track live status on our studio web app.`;
      const newSMSLog = {
        id: `notif-sms-${Date.now()}`,
        orderId,
        channel: 'SMS' as const,
        recipient: orderToNotify.phone || '+91 9606032491',
        message: smsMessage,
        timestamp,
        status: 'Delivered' as const
      };

      const emailMessage = `Dear ${orderToNotify.fullName || 'Valued Client'},\n\nWe wanted to let you know that your Tumble Spin luxury garment care order #${orderId} status has been updated to "${newStatus}".\n\nOur valet coordinators and fabric technicians are dedicated to refreshing your textiles beautifully.\n\nThank you,\nTeam Tumble Spin`;
      const newEmailLog = {
        id: `notif-email-${Date.now()}`,
        orderId,
        channel: 'Email' as const,
        recipient: orderToNotify.email || 'client@tumblespin.com',
        message: emailMessage,
        timestamp,
        status: 'Delivered' as const
      };

      const updatedLogs = [newSMSLog, newEmailLog, ...notificationLogs];
      setNotificationLogs(updatedLogs);
      localStorage.setItem('tumblespin_notif_logs', JSON.stringify(updatedLogs));

      setNotifToast({
        visible: true,
        message: `📢 Automated notifications fired! SMS sent to ${orderToNotify.phone} & Email to ${orderToNotify.email || 'client@tumblespin.com'}`,
        status: newStatus
      });
      setTimeout(() => {
        setNotifToast(prev => ({ ...prev, visible: false }));
      }, 5000);
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    const currentOrdersStr = localStorage.getItem('tumblespin_orders');
    let currentOrders = orders;
    if (currentOrdersStr) {
      try {
        currentOrders = JSON.parse(currentOrdersStr);
      } catch (err) {}
    }

    const targetOrder = currentOrders.find(o => o.orderId === orderId);
    const filtered = currentOrders.filter(o => o.orderId !== orderId);
    setOrders(filtered);
    localStorage.setItem('tumblespin_orders', JSON.stringify(filtered));

    // Direct delete from Firestore for instant cross-device synchronization
    try {
      deleteDoc(doc(db, 'orders', orderId)).catch(err => {
        console.warn('Direct Firestore delete failed, relying on localStorage fallback sync:', err);
      });
    } catch (e) {
      console.warn('Direct Firestore delete failed, relying on localStorage fallback sync:', e);
    }
    
    if (targetOrder) {
      const latestDeletedStr = localStorage.getItem('tumblespin_deleted_orders');
      let latestDeleted: any[] = [];
      if (latestDeletedStr) {
        try {
          latestDeleted = JSON.parse(latestDeletedStr);
        } catch (err) {}
      }

      if (!latestDeleted.some(o => o.orderId === orderId)) {
        const deletionEntry = {
          ...targetOrder,
          deletedAt: new Date().toLocaleString(),
          deletedBy: adminRole === 'master' ? 'Master Admin' : 'Admin'
        };
        const updatedDeleted = [deletionEntry, ...latestDeleted];
        setDeletedOrders(updatedDeleted);
        localStorage.setItem('tumblespin_deleted_orders', JSON.stringify(updatedDeleted));
      }
    }

    if (selectedOrder?.orderId === orderId) {
      setSelectedOrder(null);
    }
    window.dispatchEvent(new Event('storage'));
  };

  const handleRestoreOrder = (restoredOrder: any) => {
    // Read latest deleted orders from localStorage directly (synced with Firestore)
    const latestDeletedStr = localStorage.getItem('tumblespin_deleted_orders');
    let latestDeleted: any[] = [];
    if (latestDeletedStr) {
      try {
        latestDeleted = JSON.parse(latestDeletedStr);
      } catch (err) {}
    }

    // Remove from deleted orders list
    const updatedDeleted = latestDeleted.filter(o => o.orderId !== restoredOrder.orderId);
    setDeletedOrders(updatedDeleted);
    localStorage.setItem('tumblespin_deleted_orders', JSON.stringify(updatedDeleted));

    // Strip out deletion metadata
    const { deletedAt, deletedBy, ...cleanOrder } = restoredOrder;

    // Read latest active orders from localStorage directly (synced with Firestore)
    const currentOrdersStr = localStorage.getItem('tumblespin_orders');
    let currentOrders = orders;
    if (currentOrdersStr) {
      try {
        currentOrders = JSON.parse(currentOrdersStr);
      } catch (err) {}
    }

    // Add back to active orders
    const updatedOrders = [cleanOrder, ...currentOrders.filter(o => o.orderId !== cleanOrder.orderId)];
    setOrders(updatedOrders);
    localStorage.setItem('tumblespin_orders', JSON.stringify(updatedOrders));

    setNotifToast({
      visible: true,
      message: `♻️ Order #${restoredOrder.orderId} successfully restored to active bookings!`,
      status: restoredOrder.status
    });
    setTimeout(() => {
      setNotifToast(prev => ({ ...prev, visible: false }));
    }, 4000);
    window.dispatchEvent(new Event('storage'));
  };

  const handlePermanentlyDeleteArchivedOrder = (orderId: string) => {
    const updated = deletedOrders.filter(o => o.orderId !== orderId);
    setDeletedOrders(updated);
    localStorage.setItem('tumblespin_deleted_orders', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    setNotifToast({
      visible: true,
      message: `🗑️ Order #${orderId} permanently purged from system records.`,
      status: 'Ready'
    });
    setTimeout(() => {
      setNotifToast(prev => ({ ...prev, visible: false }));
    }, 3500);
  };

  const handlePurgeDeletedOrders = () => {
    setDeletedOrders([]);
    localStorage.setItem('tumblespin_deleted_orders', JSON.stringify([]));
    window.dispatchEvent(new Event('storage'));
    setNotifToast({
      visible: true,
      message: `🗑️ All archived order logs have been permanently purged.`,
      status: 'Ready'
    });
    setTimeout(() => {
      setNotifToast(prev => ({ ...prev, visible: false }));
    }, 3500);
  };

  // Derived state: Filtered Orders based on search query, status filter, and date filter
  const filteredOrders = orders.filter((order) => {
    const matchesSearch = 
      !adminSearchQuery.trim() ||
      order.fullName.toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
      order.orderId.toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
      order.email.toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
      order.phone.toLowerCase().includes(adminSearchQuery.toLowerCase());

    const matchesStatus = adminStatusFilter === 'all' || order.status === adminStatusFilter;

    let matchesGroup = true;
    if (adminGroupFilter === 'pending') {
      matchesGroup = order.status === 'Order Confirmed' || order.status === 'Valet Pickup Completed';
    } else if (adminGroupFilter === 'processing') {
      matchesGroup = order.status === 'At Laundry Facility' || order.status === 'In-Facility Fabric Screening';
    } else if (adminGroupFilter === 'ready') {
      matchesGroup = order.status === 'Quality Pressed & Inspected' || order.status === 'Out for Valet Delivery';
    } else if (adminGroupFilter === 'delivered') {
      matchesGroup = order.status === 'Returned Flawless';
    } else if (adminGroupFilter === 'unread') {
      matchesGroup = order.adminViewed === false;
    }

    const matchesDate = 
      !adminDateFilter || 
      order.pickupDate === adminDateFilter || 
      order.deliveryDate === adminDateFilter ||
      order.createdAt?.startsWith(adminDateFilter);

    return matchesSearch && matchesStatus && matchesGroup && matchesDate;
  });

  // Calculate order stats & financials
  const stats = (() => {
    let pendingCount = 0;
    let processingCount = 0;
    let readyCount = 0;
    let deliveredCount = 0;
    let totalRevenue = 0;
    let projectedRevenue = 0;
    let unreadCount = 0;

    orders.forEach((o) => {
      const status = o.status;
      const price = o.totalPrice || 0;
      projectedRevenue += price;

      if (o.adminViewed === false) {
        unreadCount++;
      }

      if (status === 'Order Confirmed' || status === 'Valet Pickup Completed') {
        pendingCount++;
      } else if (status === 'At Laundry Facility' || status === 'In-Facility Fabric Screening') {
        processingCount++;
      } else if (status === 'Quality Pressed & Inspected' || status === 'Out for Valet Delivery') {
        readyCount++;
      } else if (status === 'Returned Flawless') {
        deliveredCount++;
        totalRevenue += price;
      }
    });

    return {
      pendingCount,
      processingCount,
      readyCount,
      deliveredCount,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      projectedRevenue: Number(projectedRevenue.toFixed(2)),
      unreadCount
    };
  })();

  const handleSelectOrder = (o: OrderData) => {
    setSelectedOrder(o);
    if (o.adminViewed === false) {
      const updatedOrders = orders.map(order => {
        if (order.orderId === o.orderId) {
          return { ...order, adminViewed: true };
        }
        return order;
      });
      setOrders(updatedOrders);
      localStorage.setItem('tumblespin_orders', JSON.stringify(updatedOrders));
      window.dispatchEvent(new Event('storage'));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="admin-panel-container" className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md ${
          isAuthorized ? 'p-0 overflow-hidden' : 'p-2 sm:p-4 overflow-y-auto'
        }`}>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={`relative w-full border border-slate-100 dark:border-brand-teal/15 shadow-2xl flex flex-col ${
              !isAuthorized 
                ? 'max-w-md w-full my-auto rounded-3xl max-h-[96dvh] sm:max-h-[90vh] bg-white dark:bg-brand-dark overflow-hidden' 
                : 'max-w-7xl h-[100dvh] max-h-[100dvh] md:h-[95vh] md:max-h-[92vh] rounded-none md:rounded-3xl bg-white dark:bg-brand-dark overflow-hidden'
            }`}
          >
            {/* Automated Notification Trigger Floating Alert */}
            <AnimatePresence>
              {notifToast.visible && (
                <motion.div
                  initial={{ opacity: 0, y: -50, scale: 0.9 }}
                  animate={{ opacity: 1, y: 16, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.9 }}
                  className="absolute left-4 right-4 md:left-auto md:right-6 top-16 md:top-4 md:w-96 z-[999] p-4 rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-700/80 flex items-start gap-3"
                >
                  <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">
                    <MessageSquare className="h-5 w-5 animate-bounce" />
                  </div>
                  <div className="flex-1 space-y-1 text-left">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 font-mono">
                        Notif Trigger Fired
                      </span>
                      <button
                        onClick={() => setNotifToast(p => ({ ...p, visible: false }))}
                        className="text-slate-400 hover:text-white text-xs font-bold font-mono px-1"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-xs font-semibold leading-relaxed text-slate-200">
                      {notifToast.message}
                    </p>
                    <div className="flex items-center gap-1.5 pt-1 text-[9px] text-slate-400 font-mono">
                      <span>Status: {notifToast.status}</span>
                      <span>•</span>
                      <span>Status Updated</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Background image for mobile view when not authorized */}
            {!isAuthorized && (
              <div className="absolute inset-0 z-0 md:hidden select-none pointer-events-none">
                <img 
                  src={HERO_IMAGE_PATH} 
                  alt="Tumble Spin Premium Laundry background" 
                  className="w-full h-full object-cover opacity-30 dark:opacity-20"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-slate-950/80 dark:bg-brand-deep/85" />
              </div>
            )}

            {/* Header */}
            <div className={`p-4 sm:p-5 border-b border-slate-100 dark:border-brand-teal/10 flex justify-between items-center relative z-10 shrink-0 ${
              !isAuthorized 
                ? 'bg-slate-50/90 dark:bg-brand-deep/60 backdrop-blur-md' 
                : 'bg-slate-50 dark:bg-brand-deep/35'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary dark:bg-brand-accent/10 dark:text-brand-accent shrink-0">
                  <Lock className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-serif leading-tight">Tumble Spin Concierge</h3>
                  <p className="text-[9px] sm:text-[10px] uppercase font-mono tracking-widest text-slate-400 font-bold">Administrative Access</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                {isAuthorized && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const allCusts = computeCustomerDirectory(orders);
                        exportCustomersToExcel(allCusts, businessInfo.name);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer whitespace-nowrap"
                      title="Print / Export Entire Customer Data to Excel (.xlsx)"
                      id="global-export-customer-excel-btn"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Export Customers (Excel)</span>
                      <span className="sm:hidden">Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allCusts = computeCustomerDirectory(orders);
                        printCustomerDirectory(allCusts, businessInfo.name);
                      }}
                      className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-brand-deep/80 dark:hover:bg-brand-teal/20 text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-brand-teal/10 text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                      title="Print entire customer data sheet"
                      id="global-print-customer-data-btn"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Print Sheet</span>
                    </button>
                    <div
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-brand-teal/20 bg-brand-dark/60 text-xs font-bold text-slate-300 shadow-xs"
                      title="Night Light Mode Active"
                    >
                      <Moon className="h-3.5 w-3.5 text-brand-accent fill-brand-accent/20" />
                      <span className="hidden sm:inline text-[11px] font-bold uppercase tracking-wider font-mono text-brand-accent">Night Light</span>
                    </div>
                  </>
                )}
                <button 
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-brand-teal/20 text-slate-400 hover:text-slate-200 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Auth Gate Screen with Smooth Scroll on Compact Devices */}
            {!isAuthorized ? (
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-7 text-center max-w-md mx-auto space-y-4 sm:space-y-5 relative z-10 bg-white/40 dark:bg-brand-dark/20 backdrop-blur-xs md:bg-transparent md:backdrop-blur-none rounded-b-3xl w-full">
                <div className="space-y-1.5">
                  <ShieldAlert className="h-9 w-9 sm:h-11 sm:w-11 text-brand-primary dark:text-brand-accent mx-auto" />
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Admin Authentication</h4>
                  <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                    Please select your role and enter your secure credentials to manage real-time bookings.
                  </p>
                </div>

                {/* Login Role Switcher Tabs */}
                <div className="flex border border-slate-200 dark:border-brand-teal/20 p-1 rounded-xl bg-slate-50/80 dark:bg-brand-deep/50">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginTab('admin');
                      setErrorMsg('');
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      loginTab === 'admin'
                        ? 'bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    Normal Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginTab('master');
                      setErrorMsg('');
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      loginTab === 'master'
                        ? 'bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    Master Admin
                  </button>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-3.5 text-left">
                  {loginTab === 'admin' ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                          Admin Passcode
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowPasscode(!showPasscode)}
                          className="text-[10px] text-brand-primary dark:text-brand-accent font-bold flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          {showPasscode ? <><EyeOff className="h-3 w-3" /> Hide</> : <><Eye className="h-3 w-3" /> Show</>}
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showPasscode ? "text" : "password"}
                          placeholder="Enter passkey..."
                          value={passcode}
                          onChange={(e) => setPasscode(e.target.value)}
                          className="w-full text-center tracking-widest rounded-xl border border-slate-200 bg-white/95 px-10 py-2.5 sm:py-3 text-sm font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/90 dark:text-white focus:outline-hidden focus:border-brand-primary"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasscode(!showPasscode)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                        >
                          {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                          Master Email
                        </label>
                        <input
                          type="email"
                          placeholder="Enter master email (e.g. Prakashcsat@gmail.com)"
                          value={masterEmail}
                          onChange={(e) => setMasterEmail(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/90 dark:text-white focus:outline-hidden focus:border-brand-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                            Master Password
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowMasterPassword(!showMasterPassword)}
                            className="text-[10px] text-brand-primary dark:text-brand-accent font-bold flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            {showMasterPassword ? <><EyeOff className="h-3 w-3" /> Hide</> : <><Eye className="h-3 w-3" /> Show</>}
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showMasterPassword ? "text" : "password"}
                            placeholder="Enter master password..."
                            value={masterPassword}
                            onChange={(e) => setMasterPassword(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white/95 px-4 pr-10 py-2.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/90 dark:text-white focus:outline-hidden focus:border-brand-primary"
                          />
                          <button
                            type="button"
                            onClick={() => setShowMasterPassword(!showMasterPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                          >
                            {showMasterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {errorMsg && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                      <p className="text-xs font-semibold text-rose-400">{errorMsg}</p>
                    </div>
                  )}
                  <button
                    type="submit"
                    className="w-full min-h-[44px] rounded-full bg-brand-primary text-white py-2.5 sm:py-3 text-xs font-bold uppercase tracking-wider shadow-md hover:bg-brand-deep transition-all dark:bg-brand-accent dark:text-brand-deep cursor-pointer text-center flex items-center justify-center gap-2 mt-2"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Authorize Session</span>
                  </button>
                </form>
              </div>
            ) : (
              /* Authorized Dashboard Content */
              <>
                {/* Tab Switcher */}
                <div className="flex overflow-x-auto no-scrollbar scroll-smooth bg-slate-100/80 dark:bg-brand-deep/50 px-4 py-2.5 border-b border-slate-100 dark:border-brand-teal/10 gap-2 shrink-0 relative z-10 whitespace-nowrap">
                  <button
                    onClick={() => setActiveTab('bookings')}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-300 flex items-center gap-2 shrink-0 cursor-pointer ${
                      activeTab === 'bookings'
                        ? 'bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-brand-teal/5 bg-white dark:bg-brand-dark/40 border border-slate-200/40 dark:border-brand-teal/5'
                    }`}
                  >
                    <ListOrdered className="h-3.5 w-3.5" />
                    Orders & Bookings
                  </button>
                  <button
                    onClick={() => setActiveTab('promo')}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-300 flex items-center gap-2 shrink-0 cursor-pointer ${
                      activeTab === 'promo'
                        ? 'bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-brand-teal/5 bg-white dark:bg-brand-dark/40 border border-slate-200/40 dark:border-brand-teal/5'
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Promo Banner
                  </button>
                  <button
                    onClick={() => setActiveTab('pricing')}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-300 flex items-center gap-2 shrink-0 cursor-pointer ${
                      activeTab === 'pricing'
                        ? 'bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-brand-teal/5 bg-white dark:bg-brand-dark/40 border border-slate-200/40 dark:border-brand-teal/5'
                    }`}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Dynamic Pricing
                  </button>
                  <button
                    onClick={() => setActiveTab('profile')}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-300 flex items-center gap-2 shrink-0 cursor-pointer ${
                      activeTab === 'profile'
                        ? 'bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-brand-teal/5 bg-white dark:bg-brand-dark/40 border border-slate-200/40 dark:border-brand-teal/5'
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                    Admin Profile Settings
                  </button>

                  {adminRole === 'master' && (
                    <button
                      onClick={() => setActiveTab('business')}
                      className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-300 flex items-center gap-2 shrink-0 cursor-pointer ${
                        activeTab === 'business'
                          ? 'bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-brand-teal/5 bg-white dark:bg-brand-dark/40 border border-slate-200/40 dark:border-brand-teal/5'
                      }`}
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Business Settings
                    </button>
                  )}

                  <button
                    onClick={() => setActiveTab('offline')}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-300 flex items-center gap-2 shrink-0 cursor-pointer ${
                      activeTab === 'offline'
                        ? 'bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-brand-teal/5 bg-white dark:bg-brand-dark/40 border border-slate-200/40 dark:border-brand-teal/5'
                    }`}
                  >
                    <Store className="h-3.5 w-3.5" />
                    Offline Store Counter
                  </button>
                  <button
                    onClick={() => setActiveTab('customers')}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-300 flex items-center gap-2 shrink-0 cursor-pointer ${
                      activeTab === 'customers'
                        ? 'bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-brand-teal/5 bg-white dark:bg-brand-dark/40 border border-slate-200/40 dark:border-brand-teal/5'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    Customer Directory
                  </button>

                  {adminRole === 'master' && (
                    <button
                      onClick={() => setActiveTab('analytics')}
                      className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-300 flex items-center gap-2 shrink-0 cursor-pointer ${
                        activeTab === 'analytics'
                          ? 'bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-brand-teal/5 bg-white dark:bg-brand-dark/40 border border-slate-200/40 dark:border-brand-teal/5'
                      }`}
                    >
                      <TrendingUp className="h-3.5 w-3.5" />
                      Revenue Insights
                    </button>
                  )}

                  {adminRole === 'master' && (
                    <button
                      onClick={() => setActiveTab('deleted_orders')}
                      className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-300 flex items-center gap-2 shrink-0 cursor-pointer ${
                        activeTab === 'deleted_orders'
                          ? 'bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-brand-teal/5 bg-white dark:bg-brand-dark/40 border border-slate-200/40 dark:border-brand-teal/5'
                      }`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Deleted Orders Log
                    </button>
                  )}

                  <button
                    onClick={() => setActiveTab('webhooks')}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-300 flex items-center gap-2 shrink-0 cursor-pointer ${
                      activeTab === 'webhooks'
                        ? 'bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-brand-teal/5 bg-white dark:bg-brand-dark/40 border border-slate-200/40 dark:border-brand-teal/5'
                    }`}
                  >
                    <Server className="h-3.5 w-3.5" />
                    Webhook & Debug Logs
                  </button>

                  {/* Log Out button */}
                  <button
                    onClick={() => {
                      localStorage.removeItem('tumblespin_admin_role');
                      setAdminRole(null);
                      setIsAuthorized(false);
                      setPasscode('');
                      setMasterEmail('');
                      setMasterPassword('');
                      setActiveTab('bookings');
                      window.dispatchEvent(new Event('storage'));
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-300 text-rose-500 hover:bg-rose-500/10 border border-rose-500/25 shrink-0 cursor-pointer"
                  >
                    Log Out
                  </button>
                </div>

                {activeTab === 'bookings' && (
                  <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    
                    {/* INSIGHTS & LIFE-CYCLE STATUS BANNER */}
                    <div className="bg-slate-50 dark:bg-brand-deep/20 p-4 border-b border-slate-100 dark:border-brand-teal/10 shrink-0">
                      <div className="flex overflow-x-auto no-scrollbar scroll-smooth gap-3 pb-1 md:grid md:grid-cols-6 md:pb-0">
                        
                        {/* Financial Revenue Insight Card (Dual Metric display) */}
                        {adminRole === 'master' ? (
                          <div className="min-w-[220px] md:min-w-0 md:col-span-2 bg-gradient-to-br from-emerald-500/10 to-brand-primary/5 dark:from-brand-accent/15 dark:to-brand-deep border border-emerald-500/20 dark:border-brand-accent/20 rounded-2xl p-3 flex flex-col justify-between shadow-xs shrink-0">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                                  Financial Insights
                                </span>
                                <h3 className="text-lg font-black text-slate-800 dark:text-white mt-0.5 leading-none font-mono">
                                  ₹{Number(stats.totalRevenue).toFixed(2)}
                                </h3>
                              </div>
                              <div className="p-1.5 rounded-lg bg-emerald-500/10 dark:bg-brand-accent/10">
                                <Receipt className="h-4 w-4 text-emerald-600 dark:text-brand-accent" />
                              </div>
                            </div>
                            <div className="mt-2.5 flex justify-between items-center text-[10px] border-t border-slate-200/40 dark:border-brand-teal/10 pt-2 font-semibold">
                              <span className="text-slate-500 dark:text-slate-400">
                                Delivered: <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-black">₹{Number(stats.totalRevenue).toFixed(2)}</strong>
                              </span>
                              <span className="text-slate-400">|</span>
                              <span className="text-slate-500 dark:text-slate-400">
                                Projected: <strong className="text-brand-primary dark:text-slate-200 font-mono font-black">₹{Number(stats.projectedRevenue).toFixed(2)}</strong>
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="min-w-[220px] md:min-w-0 md:col-span-2 bg-slate-50 dark:bg-brand-deep/20 border border-slate-200/40 dark:border-brand-teal/10 rounded-2xl p-3 flex flex-col justify-center items-center shadow-xs shrink-0 text-center gap-1">
                            <Lock className="h-4 w-4 text-slate-400" />
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono block">Financial Insights</span>
                              <span className="text-[9px] font-semibold text-slate-400 italic block">Restricted to Master Admin</span>
                            </div>
                          </div>
                        )}

                        {/* All Bookings Card */}
                        <button
                          type="button"
                          onClick={() => {
                            setAdminGroupFilter('all');
                            setAdminStatusFilter('all');
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer min-w-[125px] md:min-w-0 shrink-0 ${
                            adminGroupFilter === 'all' && adminStatusFilter === 'all'
                              ? 'bg-brand-primary text-white border-brand-primary dark:bg-brand-accent dark:text-brand-deep dark:border-brand-accent shadow-sm'
                              : 'bg-white dark:bg-brand-deep/30 border-slate-100 dark:border-brand-teal/5 hover:border-slate-200 dark:hover:border-brand-accent/10'
                          }`}
                        >
                          <div className="flex justify-between items-start w-full">
                            <span className="text-[9px] font-bold uppercase tracking-wider font-mono">Total Bookings</span>
                            <ShoppingBag className="h-4 w-4 opacity-75" />
                          </div>
                          <div className="mt-2">
                            <span className="text-2xl font-black font-mono">{orders.length}</span>
                            <span className="text-[9px] block opacity-60 font-semibold uppercase mt-0.5">Show All</span>
                          </div>
                        </button>

                        {/* Pending Orders Card */}
                        <button
                          type="button"
                          onClick={() => {
                            setAdminGroupFilter('pending');
                            setAdminStatusFilter('all');
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer min-w-[125px] md:min-w-0 shrink-0 ${
                            adminGroupFilter === 'pending'
                              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                              : 'bg-white dark:bg-brand-deep/30 border-slate-100 dark:border-brand-teal/5 hover:border-slate-200 dark:hover:border-brand-accent/10'
                          }`}
                        >
                          <div className="flex justify-between items-start w-full">
                            <span className={`text-[9px] font-bold uppercase tracking-wider font-mono ${adminGroupFilter === 'pending' ? '' : 'text-slate-500 dark:text-slate-400'}`}>Pending</span>
                            <Clock className={`h-4 w-4 ${adminGroupFilter === 'pending' ? '' : 'text-amber-500'}`} />
                          </div>
                          <div className="mt-2">
                            <span className="text-2xl font-black font-mono">{stats.pendingCount}</span>
                            <span className="text-[9px] block opacity-60 font-semibold uppercase mt-0.5 font-mono">Confirmed</span>
                          </div>
                        </button>

                        {/* Processing Card */}
                        <button
                          type="button"
                          onClick={() => {
                            setAdminGroupFilter('processing');
                            setAdminStatusFilter('all');
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer min-w-[125px] md:min-w-0 shrink-0 ${
                            adminGroupFilter === 'processing'
                              ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                              : 'bg-white dark:bg-brand-deep/30 border-slate-100 dark:border-brand-teal/5 hover:border-slate-200 dark:hover:border-brand-accent/10'
                          }`}
                        >
                          <div className="flex justify-between items-start w-full">
                            <span className={`text-[9px] font-bold uppercase tracking-wider font-mono ${adminGroupFilter === 'processing' ? '' : 'text-slate-500 dark:text-slate-400'}`}>Processing</span>
                            <RefreshCw className={`h-4 w-4 ${adminGroupFilter === 'processing' ? 'animate-spin' : 'text-blue-500'}`} style={adminGroupFilter === 'processing' ? { animationDuration: '4s' } : undefined} />
                          </div>
                          <div className="mt-2">
                            <span className="text-2xl font-black font-mono">{stats.processingCount}</span>
                            <span className="text-[9px] block opacity-60 font-semibold uppercase mt-0.5 font-mono">In-Facility</span>
                          </div>
                        </button>

                        {/* Ready to Deliver Card */}
                        <button
                          type="button"
                          onClick={() => {
                            setAdminGroupFilter('ready');
                            setAdminStatusFilter('all');
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer min-w-[125px] md:min-w-0 shrink-0 ${
                            adminGroupFilter === 'ready'
                              ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                              : 'bg-white dark:bg-brand-deep/30 border-slate-100 dark:border-brand-teal/5 hover:border-slate-200 dark:hover:border-brand-accent/10'
                          }`}
                        >
                          <div className="flex justify-between items-start w-full">
                            <span className={`text-[9px] font-bold uppercase tracking-wider font-mono ${adminGroupFilter === 'ready' ? '' : 'text-slate-500 dark:text-slate-400'}`}>Ready</span>
                            <Truck className={`h-4 w-4 ${adminGroupFilter === 'ready' ? '' : 'text-indigo-500'}`} />
                          </div>
                          <div className="mt-2">
                            <span className="text-2xl font-black font-mono">{stats.readyCount}</span>
                            <span className="text-[9px] block opacity-60 font-semibold uppercase mt-0.5 font-mono">Completed</span>
                          </div>
                        </button>

                        {/* Delivered Card */}
                        <button
                          type="button"
                          onClick={() => {
                            setAdminGroupFilter('delivered');
                            setAdminStatusFilter('all');
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer min-w-[125px] md:min-w-0 shrink-0 ${
                            adminGroupFilter === 'delivered'
                              ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                              : 'bg-white dark:bg-brand-deep/30 border-slate-100 dark:border-brand-teal/5 hover:border-slate-200 dark:hover:border-brand-accent/10'
                          }`}
                        >
                          <div className="flex justify-between items-start w-full">
                            <span className={`text-[9px] font-bold uppercase tracking-wider font-mono ${adminGroupFilter === 'delivered' ? '' : 'text-slate-500 dark:text-slate-400'}`}>Delivered</span>
                            <ShieldCheck className={`h-4 w-4 ${adminGroupFilter === 'delivered' ? '' : 'text-emerald-500'}`} />
                          </div>
                          <div className="mt-2">
                            <span className="text-2xl font-black font-mono">{stats.deliveredCount}</span>
                            <span className="text-[9px] block opacity-60 font-semibold uppercase mt-0.5 font-mono">Returned</span>
                          </div>
                        </button>

                        {/* Unread Bookings Card */}
                        <button
                          type="button"
                          onClick={() => {
                            setAdminGroupFilter('unread');
                            setAdminStatusFilter('all');
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer min-w-[125px] md:min-w-0 shrink-0 relative ${
                            adminGroupFilter === 'unread'
                              ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                              : 'bg-white dark:bg-brand-deep/30 border-slate-100 dark:border-brand-teal/5 hover:border-slate-200 dark:hover:border-brand-accent/10'
                          }`}
                        >
                          <div className="flex justify-between items-start w-full">
                            <span className={`text-[9px] font-bold uppercase tracking-wider font-mono ${adminGroupFilter === 'unread' ? '' : 'text-slate-500 dark:text-slate-400'}`}>New Bookings</span>
                            <div className="relative">
                              <Bell className={`h-4 w-4 ${adminGroupFilter === 'unread' ? '' : 'text-rose-500'}`} />
                              {stats.unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-rose-600 h-2 w-2 rounded-full animate-ping" />
                              )}
                            </div>
                          </div>
                          <div className="mt-2">
                            <span className="text-2xl font-black font-mono flex items-center gap-1.5">
                              {stats.unreadCount}
                              {stats.unreadCount > 0 && (
                                <span className="text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-1.5 py-0.5 rounded-full font-bold">NEW</span>
                              )}
                            </span>
                            <span className="text-[9px] block opacity-60 font-semibold uppercase mt-0.5 font-mono">Unread</span>
                          </div>
                        </button>

                      </div>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
                    
                    {/* Left Side: Bookings list */}
                    <div className={`w-full md:w-2/5 border-r border-slate-100 dark:border-brand-teal/10 flex flex-col min-h-0 bg-slate-50/50 dark:bg-brand-deep/10 ${selectedOrder ? 'hidden md:flex' : 'flex'}`}>
                      <div className="p-4 bg-white dark:bg-brand-dark border-b border-slate-100 dark:border-brand-teal/5 flex justify-between items-center shrink-0">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                          Orders Index {filteredOrders.length !== orders.length ? `(${filteredOrders.length}/${orders.length})` : `(${orders.length})`}
                        </span>
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              const allCusts = computeCustomerDirectory(orders);
                              exportCustomersToExcel(allCusts, businessInfo.name);
                            }}
                            className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline cursor-pointer"
                            title="Export entire customer data to Excel (.xlsx)"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                            <span>Customers Excel</span>
                          </button>
                          <button 
                            onClick={loadOrders}
                            className="text-[10px] font-bold text-brand-primary dark:text-brand-accent flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Refresh
                          </button>
                        </div>
                      </div>

                      {/* Search & Filter controls */}
                      <div className="p-3 bg-white dark:bg-brand-dark/40 border-b border-slate-100 dark:border-brand-teal/5 space-y-2 shrink-0">
                        {/* Search Input */}
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search by customer, phone, ID..."
                            value={adminSearchQuery}
                            onChange={(e) => setAdminSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-8 py-1.5 text-xs font-medium text-slate-800 dark:border-brand-teal/10 dark:bg-brand-deep/60 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-primary/20"
                          />
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          {adminSearchQuery && (
                            <button
                              onClick={() => setAdminSearchQuery('')}
                              className="absolute right-2.5 top-1.5 hover:text-slate-800 dark:hover:text-white text-slate-400 font-bold text-xs cursor-pointer"
                            >
                              ×
                            </button>
                          )}
                        </div>

                        {/* Dropdowns for Status and Date side-by-side */}
                        <div className="grid grid-cols-2 gap-2">
                          {/* Status Filter */}
                          <div className="relative">
                            <select
                              value={adminStatusFilter}
                              onChange={(e) => setAdminStatusFilter(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-700 dark:border-brand-teal/10 dark:bg-brand-deep/60 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-brand-primary/20 appearance-none cursor-pointer"
                            >
                              <option value="all">All Statuses</option>
                              {STATUS_OPTIONS.map((opt, optIdx) => (
                                <option key={`opt-status-${opt}-${optIdx}`} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2.5 top-2.5 h-3 w-3 text-slate-400 pointer-events-none" />
                          </div>

                          {/* Date Filter */}
                          <div className="relative">
                            <input
                              type="date"
                              value={adminDateFilter}
                              onChange={(e) => setAdminDateFilter(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 dark:border-brand-teal/10 dark:bg-brand-deep/60 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-brand-primary/20 cursor-pointer"
                              title="Filter by Pickup or Delivery Date"
                            />
                            {adminDateFilter && (
                              <button
                                onClick={() => setAdminDateFilter('')}
                                className="absolute right-1 top-1.5 text-slate-400 hover:text-rose-500 font-extrabold text-[10px] cursor-pointer"
                                title="Clear Date"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Active filters indicators */}
                        {(adminSearchQuery || adminStatusFilter !== 'all' || adminGroupFilter !== 'all' || adminDateFilter) && (
                          <div className="flex justify-between items-center pt-1">
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
                              Active filters applied
                            </span>
                            <button
                              onClick={() => {
                                setAdminSearchQuery('');
                                setAdminStatusFilter('all');
                                setAdminGroupFilter('all');
                                setAdminDateFilter('');
                              }}
                              className="text-[9px] font-black text-rose-500 uppercase tracking-wider hover:underline cursor-pointer"
                            >
                              Clear All
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                        {orders.length === 0 ? (
                          <div className="py-20 text-center text-slate-400 dark:text-slate-500">
                            <ListOrdered className="h-8 w-8 mx-auto mb-2 opacity-40" />
                            <p className="text-xs">No active orders placed yet.</p>
                          </div>
                        ) : filteredOrders.length === 0 ? (
                          <div className="py-12 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-brand-dark/25 rounded-2xl border border-dashed border-slate-200 dark:border-brand-teal/5 p-4">
                            <Search className="h-6 w-6 mx-auto mb-2 opacity-30 text-brand-primary" />
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No matching orders found</p>
                            <p className="text-[10px] text-slate-400 mt-1 leading-normal">Try adjusting your keywords, date filter, or selecting a different order status.</p>
                            <button
                              onClick={() => {
                                setAdminSearchQuery('');
                                setAdminStatusFilter('all');
                                setAdminGroupFilter('all');
                                setAdminDateFilter('');
                              }}
                              className="mt-4 text-[10px] font-bold text-brand-primary dark:text-brand-accent hover:underline bg-brand-primary/5 dark:bg-brand-accent/5 px-3 py-1 rounded-full border border-brand-primary/10 cursor-pointer"
                            >
                              Reset Search Filters
                            </button>
                          </div>
                        ) : (
                          filteredOrders.map((o, idx) => {
                            const isSelected = selectedOrder?.orderId === o.orderId;
                            return (
                              <div
                                key={`admin-ord-${o.orderId || idx}-${idx}`}
                                onClick={() => handleSelectOrder(o)}
                                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-brand-primary/[0.04] border-brand-primary dark:bg-brand-accent/[0.04] dark:border-brand-accent shadow-xs'
                                    : 'bg-white dark:bg-brand-deep/30 border-slate-100 dark:border-brand-teal/5 hover:border-slate-300 dark:hover:border-brand-accent/25'
                                }`}
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                      {o.orderId}
                                      {o.adminViewed === false && (
                                        <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse shrink-0" title="New Booking Alert" />
                                      )}
                                    </span>
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-white mt-0.5 flex items-center gap-1.5">
                                      {o.fullName}
                                    </h4>
                                  </div>
                                  <span className="text-[9px] font-bold bg-brand-primary/10 text-brand-primary dark:bg-brand-accent/15 dark:text-brand-accent px-2 py-0.5 rounded-sm">
                                    ₹{Number(o.totalPrice || 0).toFixed(2)}
                                  </span>
                                </div>

                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed break-words">
                                  <span className="font-semibold text-slate-600 dark:text-slate-300">Services:</span> {o.subServices?.map(s => s.name).join(', ') || 'Standard Services'}
                                </p>

                                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-brand-teal/5 flex justify-between items-center flex-wrap gap-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded-md" title="Care Milestone">
                                      {o.status}
                                    </span>
                                    <span className={`text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-sm ${
                                      (o.orderStatus || mapStatusToOrderStatus(o.status)) === 'Delivered'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                                        : (o.orderStatus || mapStatusToOrderStatus(o.status)) === 'In-Progress'
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400'
                                    }`} title="Order Status">
                                      {o.orderStatus || mapStatusToOrderStatus(o.status)}
                                    </span>
                                    {o.smsOptIn !== false && (
                                      <span className="text-[8px] font-mono font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 px-1.5 py-0.5 rounded-sm" title="SMS Status Updates Enabled">
                                        💬 SMS
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[9px] text-slate-400 font-mono">
                                    {o.phone}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Right Side: Selected Order details */}
                    <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${selectedOrder ? 'block' : 'hidden md:block'}`}>
                      {selectedOrder ? (
                        <div className="space-y-6">
                          {/* Mobile Back Button */}
                          <button
                            onClick={() => setSelectedOrder(null)}
                            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200 dark:bg-brand-deep/80 dark:hover:bg-brand-teal/20 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200/40 dark:border-brand-teal/5"
                          >
                            ← Back to Orders List
                          </button>
                          
                          {/* Customer contact cards */}
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-100 dark:border-brand-teal/10">
                            <div>
                              <span className="text-[10px] font-mono font-bold text-brand-primary dark:text-brand-accent uppercase tracking-widest">
                                Customer Profile
                              </span>
                              <h3 className="text-xl font-serif font-bold text-slate-800 dark:text-white mt-1">
                                {selectedOrder.fullName}
                              </h3>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded-md">
                                  Milestone: {selectedOrder.status}
                                </span>
                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                  (selectedOrder.orderStatus || mapStatusToOrderStatus(selectedOrder.status)) === 'Delivered'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                                    : (selectedOrder.orderStatus || mapStatusToOrderStatus(selectedOrder.status)) === 'In-Progress'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400'
                                }`}>
                                  Status: {selectedOrder.orderStatus || mapStatusToOrderStatus(selectedOrder.status)}
                                </span>
                                {selectedOrder.smsOptIn !== false && (
                                  <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-md">
                                    💬 SMS Updates Opted-In
                                  </span>
                                )}
                              </div>
                            </div>

                            {deletingOrderId === selectedOrder.orderId ? (
                              <div className="flex flex-wrap items-center gap-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-200/40 dark:border-rose-500/20 px-3 py-2 rounded-xl">
                                <span className="text-[10px] font-black text-rose-600 dark:text-rose-400">Permanently Delete?</span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      handleDeleteOrder(selectedOrder.orderId);
                                      setDeletingOrderId(null);
                                    }}
                                    className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-extrabold hover:bg-rose-700 transition-colors cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    onClick={() => setDeletingOrderId(null)}
                                    className="px-2.5 py-1 bg-slate-200 dark:bg-brand-deep/60 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-extrabold hover:bg-slate-300 transition-colors cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-4 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setDeletingOrderId(selectedOrder.orderId)}
                                  className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer hover:bg-rose-500/5 px-2.5 py-1.5 rounded-lg transition-all"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete Order
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Detail lists */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 dark:bg-brand-deep/20 rounded-2xl border border-slate-100 dark:border-brand-teal/5 space-y-3 text-xs text-slate-700 dark:text-slate-300">
                              <h5 className="font-bold text-slate-800 dark:text-white font-mono uppercase tracking-wider text-[10px]">
                                Contact Details
                              </h5>
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-brand-teal shrink-0" />
                                <span>{selectedOrder.phone}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-brand-teal shrink-0" />
                                <span>{selectedOrder.email}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 text-brand-teal shrink-0 mt-0.5" />
                                <span>{selectedOrder.address}</span>
                              </div>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-brand-deep/20 rounded-2xl border border-slate-100 dark:border-brand-teal/5 space-y-3 text-xs text-slate-700 dark:text-slate-300">
                              <h5 className="font-bold text-slate-800 dark:text-white font-mono uppercase tracking-wider text-[10px]">
                                Service Slots
                              </h5>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-brand-secondary shrink-0" />
                                <span>Pickup: {selectedOrder.pickupDate} @ {selectedOrder.pickupTimeSlot}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4 text-brand-secondary shrink-0" />
                                <span>Delivery: {selectedOrder.deliveryDate} @ {selectedOrder.deliveryTimeSlot}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-brand-secondary shrink-0" />
                                <span>Detergent: {selectedOrder.garmentCareOption}</span>
                              </div>
                            </div>
                          </div>

                          {/* Items & Subservices Table */}
                          <div className="p-5 bg-slate-50 dark:bg-brand-deep/20 rounded-2xl border border-slate-100 dark:border-brand-teal/5 space-y-3">
                            <h5 className="font-bold text-slate-800 dark:text-white font-mono uppercase tracking-wider text-[10px]">
                              Itemized Garments & Costs
                            </h5>

                            <div className="divide-y divide-slate-200/60 dark:divide-brand-teal/5 space-y-2">
                              {selectedOrder.subServices && selectedOrder.subServices.length > 0 ? (
                                selectedOrder.subServices.map((sub, sidx) => (
                                  <div key={`admin-sub-${selectedOrder.orderId || 'ord'}-${sub.id || sub.name || sidx}-${sidx}`} className="flex justify-between items-center text-xs py-2">
                                    <div className="space-y-0.5">
                                      <p className="font-semibold text-slate-800 dark:text-white">{sub.name}</p>
                                      <p className="text-[10px] text-slate-400">{sub.serviceType} Care</p>
                                    </div>
                                    <div className="text-right font-mono">
                                      <span>{sub.quantity} × ₹{sub.price} = </span>
                                      <strong className="text-slate-900 dark:text-white font-bold ml-1">₹{sub.quantity * sub.price}</strong>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-slate-400">Standard general services selected.</p>
                              )}

                              <div className="flex justify-between items-baseline pt-3 font-bold text-sm">
                                <span className="text-slate-800 dark:text-white">Calculated Net Total:</span>
                                <span className="text-lg font-mono text-brand-primary dark:text-brand-accent">
                                  ₹{Number(selectedOrder.totalPrice || 0).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Special instructions */}
                          {selectedOrder.specialInstructions && (
                            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs">
                              <h6 className="font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider text-[9px] mb-1 font-mono">
                                Special Instructions From Client
                              </h6>
                              <p className="text-slate-600 dark:text-slate-300 leading-relaxed italic">
                                "{selectedOrder.specialInstructions}"
                              </p>
                            </div>
                          )}

                          {/* Update status action control */}
                          <div className="p-5 rounded-2xl bg-brand-primary/[0.02] dark:bg-brand-accent/[0.02] border border-brand-primary/10 dark:border-brand-accent/15 space-y-5">
                            
                            {/* Order-specific Notification Logs */}
                            <div className="space-y-2.5">
                              <h6 className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5">
                                📬 Automated Dispatched Alerts ({notificationLogs.filter(l => l.orderId === selectedOrder.orderId).length})
                              </h6>
                              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                {notificationLogs.filter(l => l.orderId === selectedOrder.orderId).length > 0 ? (
                                  notificationLogs.filter(l => l.orderId === selectedOrder.orderId).map((log, idx) => (
                                    <div key={`admin-log-${log.id || log.orderId || idx}-${idx}`} className="p-2.5 rounded-xl border border-slate-100 dark:border-brand-teal/5 bg-white dark:bg-brand-deep/30 flex items-start justify-between text-[11px] leading-normal gap-2">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5">
                                          <span className={`px-1.5 py-0.5 rounded-sm font-extrabold text-[8px] uppercase tracking-wider ${
                                            log.channel === 'Email' 
                                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' 
                                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                          }`}>
                                            {log.channel}
                                          </span>
                                          <span className="text-slate-400 font-medium font-mono text-[9px]">{log.timestamp}</span>
                                        </div>
                                        <p className="text-slate-600 dark:text-slate-300 font-medium">{log.message}</p>
                                        <p className="text-[9px] text-slate-400 font-mono">Recipient: {log.recipient}</p>
                                      </div>
                                      <span className="text-emerald-500 font-bold shrink-0 flex items-center gap-0.5 text-[10px]">
                                        ● {log.status}
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-[10px] text-slate-400 italic">No automated notifications dispatched for this order yet. Try updating the milestone below!</p>
                                )}
                              </div>
                            </div>

                            <div className="border-t border-slate-100 dark:border-brand-teal/5 pt-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <RefreshCw className="h-4 w-4 text-brand-primary dark:text-brand-accent animate-spin" style={{ animationDuration: '6s' }} />
                                <h5 className="text-xs font-bold text-slate-800 dark:text-white font-mono uppercase tracking-wider">
                                  Update Care Status Milestone
                                </h5>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {STATUS_OPTIONS.map((statusOpt, sIdx) => {
                                  const isCurrent = selectedOrder.status === statusOpt;
                                  return (
                                    <button
                                      key={`btn-status-${statusOpt}-${sIdx}`}
                                      onClick={() => handleUpdateStatus(selectedOrder.orderId, statusOpt)}
                                      className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 ${
                                        isCurrent
                                          ? 'bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep shadow-xs'
                                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-brand-deep/40 dark:border-brand-teal/10 dark:text-slate-300 dark:hover:bg-brand-deep/60'
                                      }`}
                                    >
                                      {isCurrent && <Check className="h-3 w-3" />}
                                      {statusOpt}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                        </div>
                      ) : (
                        <div className="py-24 text-center text-slate-400 dark:text-slate-500 space-y-3">
                          <ShoppingBag className="h-12 w-12 mx-auto opacity-30 stroke-[1.5]" />
                          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Booking Selected</h4>
                          <p className="text-xs max-w-xs mx-auto leading-relaxed">
                            Select any customer order from the index panel on the left to see full details, change tracking milestones, and manage accounts.
                          </p>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
                )}

                {activeTab === 'promo' && (
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-brand-dark/20 min-h-0">
                    <div className="max-w-2xl mx-auto space-y-6 py-4">
                      
                      {/* Active Preview */}
                      <div className="p-5 bg-white dark:bg-brand-dark rounded-2xl border border-slate-100 dark:border-brand-teal/10 shadow-xs space-y-3">
                        <span className="text-[10px] font-bold text-brand-primary dark:text-brand-accent uppercase tracking-widest font-mono">
                          Live Banner Preview
                        </span>
                        
                        {promoEnabled ? (
                          <div className={`w-full text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-between shadow-xs transition-all ${promoBg} text-white`}>
                            <div className="flex-1 text-center flex items-center justify-center gap-2">
                              <span className="inline-flex items-center justify-center bg-white/25 dark:bg-black/25 text-[9px] px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-extrabold font-mono shrink-0">
                                Offer
                              </span>
                              <span className="truncate">
                                <strong>{promoDiscount || 'Discount offer text'}</strong> {promoAppliedOn || 'offer parameters'}
                              </span>
                            </div>
                            <div className="p-1 rounded-full bg-white/10 text-white shrink-0 ml-2">
                              <X className="h-3 w-3" />
                            </div>
                          </div>
                        ) : (
                          <div className="py-6 text-center border-2 border-dashed border-slate-200 dark:border-brand-teal/10 rounded-xl text-slate-400 dark:text-slate-500 text-xs">
                            Announcement banner is currently disabled and hidden.
                          </div>
                        )}
                      </div>

                      {/* Controls Form */}
                      <div className="p-6 bg-white dark:bg-brand-dark rounded-2xl border border-slate-100 dark:border-brand-teal/10 shadow-xs space-y-5">
                        <h4 className="text-xs font-extrabold text-slate-800 dark:text-white font-mono uppercase tracking-wider">
                          Promo Banner Settings
                        </h4>

                        {/* Toggle Status */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-brand-deep/30 rounded-xl border border-slate-100 dark:border-brand-teal/5">
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-white">Enable Promotional Banner</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">Toggle whether this announcement bar is rendered globally at the absolute top of the page.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPromoEnabled(!promoEnabled)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                              promoEnabled ? 'bg-brand-primary dark:bg-brand-accent' : 'bg-slate-200 dark:bg-brand-deep/60'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                promoEnabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Input Fields */}
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Discount Offer Text (e.g., 'First order 20% off')
                            </label>
                            <input
                              type="text"
                              value={promoDiscount}
                              onChange={(e) => setPromoDiscount(e.target.value)}
                              placeholder="e.g. First order 20% off"
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Offer Scope (e.g., 'on your first doorstep dry clean & laundry valet pickups')
                            </label>
                            <input
                              type="text"
                              value={promoAppliedOn}
                              onChange={(e) => setPromoAppliedOn(e.target.value)}
                              placeholder="e.g. on all premium laundry services"
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary"
                            />
                          </div>

                          {/* Gradient Selection */}
                          <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Banner Theme Style
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {[
                                { name: 'Sunset Gold (High Visibility)', class: 'bg-linear-to-r from-amber-500 to-orange-600' },
                                { name: 'Tumble Royal (Brand)', class: 'bg-linear-to-r from-brand-primary to-brand-secondary' },
                                { name: 'Mint Emerald (Fresh)', class: 'bg-linear-to-r from-emerald-500 to-teal-600' },
                                { name: 'Rose Velvet (Chic)', class: 'bg-linear-to-r from-rose-500 to-pink-600' }
                              ].map((theme, tIdx) => {
                                const isSelected = promoBg === theme.class;
                                return (
                                  <button
                                    key={`theme-${theme.class}-${tIdx}`}
                                    type="button"
                                    onClick={() => setPromoBg(theme.class)}
                                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                                      isSelected
                                        ? 'border-brand-primary dark:border-brand-accent bg-slate-50 dark:bg-brand-deep/30 ring-1 ring-brand-primary dark:ring-brand-accent'
                                        : 'border-slate-100 dark:border-brand-teal/10 hover:bg-slate-50 dark:hover:bg-brand-deep/20'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={`h-4.5 w-4.5 rounded-full ${theme.class} shrink-0 shadow-xs`} />
                                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{theme.name}</span>
                                    </div>
                                    {isSelected && <Check className="h-3.5 w-3.5 text-brand-primary dark:text-brand-accent" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Apply & Save Buttons */}
                        <div className="pt-4 border-t border-slate-100 dark:border-brand-teal/5 flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setPromoEnabled(promoConfig.isEnabled);
                              setPromoDiscount(promoConfig.discountText);
                              setPromoAppliedOn(promoConfig.appliedOnText);
                              setPromoBg(promoConfig.bgColor);
                            }}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                          >
                            Reset Fields
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onUpdatePromo({
                                isEnabled: promoEnabled,
                                discountText: promoDiscount,
                                appliedOnText: promoAppliedOn,
                                bgColor: promoBg,
                                textColor: 'text-white'
                              });
                            }}
                            className="px-5 py-2.5 rounded-full bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep text-xs font-bold uppercase tracking-wider shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all"
                          >
                            Publish Announcement
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {activeTab === 'pricing' && (
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-brand-dark/20 min-h-0">
                    <div className="max-w-6xl mx-auto py-2">
                      <MasterPricingManager 
                        dynamicPricing={dynamicPricing} 
                        onUpdateDynamicPricing={onUpdateDynamicPricing} 
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'profile' && (
                  <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    <div className="max-w-2xl mx-auto space-y-6">
                      <div className="space-y-1">
                        <h4 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider font-mono">
                          👤 Administrative Credentials & Identity
                        </h4>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          Configure your staff identification profile. Updates will reactively synchronize across tracking dashboards and customer order receipts.
                        </p>
                      </div>

                      <form onSubmit={handleSaveAdminProfile} className="bg-white dark:bg-brand-deep/20 rounded-2xl p-5 md:p-6 border border-slate-100 dark:border-brand-teal/5 space-y-5" id="admin-profile-settings-form">
                        
                        {profileSuccessMessage && (
                          <div className={`p-4 rounded-xl text-xs font-bold font-sans ${
                            profileSuccessMessage.startsWith('⚠️')
                              ? 'bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/10 dark:text-red-400'
                              : 'bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/15 dark:text-brand-accent'
                          }`}>
                            {profileSuccessMessage}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Name Input */}
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Supervisor Name
                            </label>
                            <input
                              type="text"
                              value={editAdminName}
                              onChange={(e) => setEditAdminName(e.target.value)}
                              placeholder="Enter Admin Name (e.g. Jayanth)"
                              required
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary"
                            />
                          </div>

                          {/* Email Input */}
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Administrative Contact Email
                            </label>
                            <input
                              type="email"
                              value={editAdminEmail}
                              onChange={(e) => setEditAdminEmail(e.target.value)}
                              placeholder="e.g. Prakashcsat@gmail.com"
                              required
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary"
                            />
                          </div>
                        </div>

                        {/* Phone input */}
                        <div className="space-y-1.5 max-w-sm">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Facility Hot-Line Phone
                          </label>
                          <input
                            type="tel"
                            value={editAdminPhone}
                            onChange={(e) => setEditAdminPhone(e.target.value)}
                            placeholder="e.g. 9606032491"
                            required
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary font-mono"
                          />
                        </div>

                        {/* Informational callout */}
                        <div className="p-4 bg-slate-50 dark:bg-brand-deep/40 rounded-xl border border-slate-100 dark:border-brand-teal/5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                          💡 <strong>Data Custody Notice:</strong> Your admin profile status and credentials are securely persisted inside the application storage layer. Customer tracking screens will dynamically reflect that orders have safely arrived and are under direct facility custody of supervisor <strong>{adminProfile.name}</strong> ({adminProfile.email}).
                        </div>

                        {/* Action buttons */}
                        <div className="pt-4 border-t border-slate-100 dark:border-brand-teal/5 flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setEditAdminName(adminProfile.name);
                              setEditAdminEmail(adminProfile.email);
                              setEditAdminPhone(adminProfile.phone);
                            }}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                          >
                            Reset Fields
                          </button>
                          <button
                            type="submit"
                            className="px-5 py-2.5 rounded-full bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep text-xs font-bold uppercase tracking-wider shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all"
                            id="save-admin-profile-submit-btn"
                          >
                            Save & Publish Credentials
                          </button>
                        </div>
                      </form>

                      {/* CONDITIONAL RENDER BY ROLE */}
                      {adminRole === 'master' ? (
                        <>
                          {/* MASTER ADMIN CREDENTIAL CARD */}
                          <div className="space-y-1 pt-4">
                            <h4 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider font-mono flex items-center gap-2">
                              👑 Master Admin Access Password
                            </h4>
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              Update the secure password required to authenticate as the supreme Master Administrator.
                            </p>
                          </div>

                          <form onSubmit={handleUpdateMasterPassword} className="bg-white dark:bg-brand-deep/20 rounded-2xl p-5 md:p-6 border border-slate-100 dark:border-brand-teal/5 space-y-5" id="master-password-update-form">
                            {masterPasswordSuccessMsg && (
                              <div className="p-4 rounded-xl text-xs font-bold bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/15 dark:text-brand-accent">
                                {masterPasswordSuccessMsg}
                              </div>
                            )}
                            {masterPasswordErrorMsg && (
                              <div className="p-4 rounded-xl text-xs font-bold bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/10 dark:text-red-400">
                                {masterPasswordErrorMsg}
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                  Current Master Password
                                </label>
                                <input
                                  type="password"
                                  value={masterCurrentPass}
                                  onChange={(e) => setMasterCurrentPass(e.target.value)}
                                  placeholder="Current password"
                                  required
                                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                  New Master Password
                                </label>
                                <input
                                  type="password"
                                  value={masterNewPass}
                                  onChange={(e) => setMasterNewPass(e.target.value)}
                                  placeholder="Enter new password"
                                  required
                                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                  Confirm New Password
                                </label>
                                <input
                                  type="password"
                                  value={masterConfirmNewPass}
                                  onChange={(e) => setMasterConfirmNewPass(e.target.value)}
                                  placeholder="Confirm new password"
                                  required
                                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary"
                                />
                              </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-brand-teal/5 flex items-center justify-end gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setMasterCurrentPass('');
                                  setMasterNewPass('');
                                  setMasterConfirmNewPass('');
                                  setMasterPasswordErrorMsg('');
                                  setMasterPasswordSuccessMsg('');
                                }}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                              >
                                Clear
                              </button>
                              <button
                                type="submit"
                                className="px-5 py-2.5 rounded-full bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep text-xs font-bold uppercase tracking-wider shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all"
                              >
                                Update Master Password
                              </button>
                            </div>
                          </form>

                          {/* MASTER AUDIT: VIEW AND RESET NORMAL ADMIN PASSCODE */}
                          <div className="space-y-1 pt-4">
                            <h4 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider font-mono flex items-center gap-2">
                              🛡️ Normal Admin Passcode Audit
                            </h4>
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              As Master Admin, you have supreme custody to audit and modify the passcode used by regular staff administrators.
                            </p>
                          </div>

                          <div className="bg-white dark:bg-brand-deep/20 rounded-2xl p-5 md:p-6 border border-slate-100 dark:border-brand-teal/5 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-brand-deep/40 p-4 rounded-xl border border-slate-100 dark:border-brand-teal/5">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Current Live Staff Passcode</span>
                                <p className="text-lg font-black text-rose-500 dark:text-brand-accent tracking-widest mt-0.5 font-mono font-black">
                                  {storedAdminPassword}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const newP = prompt("Enter a new Staff Passcode:", storedAdminPassword);
                                  if (newP !== null) {
                                    if (!newP.trim()) {
                                      alert("Passcode cannot be empty.");
                                      return;
                                    }
                                    localStorage.setItem('tumblespin_admin_password', newP.trim());
                                    setStoredAdminPassword(newP.trim());
                                    window.dispatchEvent(new Event('storage'));
                                    alert("Staff passcode has been successfully updated!");
                                  }
                                }}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-brand-primary dark:text-brand-accent bg-brand-primary/10 dark:bg-brand-accent/10 hover:bg-brand-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer border border-brand-primary/10 dark:border-brand-accent/15"
                              >
                                Change Staff Passcode
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-400 italic">
                              *Staff members must enter this precise code when selecting the \'Normal Admin\' login method. Keep this passcode confidential.
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* STANDARD PASSCODE CHANGE CARD FOR REGULAR ADMIN */}
                          <div className="space-y-1 pt-4">
                            <h4 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider font-mono">
                              🔑 Regular Admin Access Passcode
                            </h4>
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              Update the passcode required for standard staff login credentials. This is synchronized across devices.
                            </p>
                          </div>

                          <form onSubmit={handleUpdatePassword} className="bg-white dark:bg-brand-deep/20 rounded-2xl p-5 md:p-6 border border-slate-100 dark:border-brand-teal/5 space-y-5" id="admin-passcode-update-form">
                            {passwordSuccessMsg && (
                              <div className="p-4 rounded-xl text-xs font-bold bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/15 dark:text-brand-accent">
                                {passwordSuccessMsg}
                              </div>
                            )}
                            {passwordErrorMsg && (
                              <div className="p-4 rounded-xl text-xs font-bold bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/10 dark:text-red-400">
                                {passwordErrorMsg}
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                  Current Passcode
                                </label>
                                <input
                                  type="password"
                                  value={currentPass}
                                  onChange={(e) => setCurrentPass(e.target.value)}
                                  placeholder="Current passcode"
                                  required
                                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                  New Passcode
                                </label>
                                <input
                                  type="password"
                                  value={newPass}
                                  onChange={(e) => setNewPass(e.target.value)}
                                  placeholder="Enter new passcode"
                                  required
                                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                  Confirm New Passcode
                                </label>
                                <input
                                  type="password"
                                  value={confirmNewPass}
                                  onChange={(e) => setConfirmNewPass(e.target.value)}
                                  placeholder="Confirm new passcode"
                                  required
                                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary"
                                />
                              </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-brand-teal/5 flex items-center justify-end gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setCurrentPass('');
                                  setNewPass('');
                                  setConfirmNewPass('');
                                  setPasswordErrorMsg('');
                                  setPasswordSuccessMsg('');
                                }}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                              >
                                Clear
                              </button>
                              <button
                                type="submit"
                                className="px-5 py-2.5 rounded-full bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep text-xs font-bold uppercase tracking-wider shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all"
                                id="change-admin-passcode-submit-btn"
                              >
                                Update Admin Passcode
                              </button>
                            </div>
                          </form>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'business' && (
                  <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    <div className="max-w-2xl mx-auto space-y-6">
                      <div className="space-y-1">
                        <h4 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider font-mono">
                          🏢 Business Profile Settings
                        </h4>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          Edit the public business contact details shown across the website, invoice generation, WhatsApp booking notifications, and footer. This is synchronized across devices.
                        </p>
                      </div>

                      <form onSubmit={handleSaveBusinessInfo} className="bg-white dark:bg-brand-deep/20 rounded-2xl p-5 md:p-6 border border-slate-100 dark:border-brand-teal/5 space-y-5" id="business-settings-form">
                        
                        {businessSuccessMsg && (
                          <div className="p-4 rounded-xl text-xs font-bold bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/15 dark:text-brand-accent">
                            {businessSuccessMsg}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Business Name */}
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Business / Store Name
                            </label>
                            <input
                              type="text"
                              value={editBusinessName}
                              onChange={(e) => setEditBusinessName(e.target.value)}
                              placeholder="e.g. Tumble Spin"
                              required
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary"
                            />
                          </div>

                          {/* Business Email */}
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Public Contact Email
                            </label>
                            <input
                              type="email"
                              value={editBusinessEmail}
                              onChange={(e) => setEditBusinessEmail(e.target.value)}
                              placeholder="e.g. support@tumblespin.com"
                              required
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary"
                            />
                          </div>
                        </div>

                        {/* Business Phone */}
                        <div className="space-y-1.5 max-w-sm">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Public Hot-Line Phone / WhatsApp (10 digits)
                          </label>
                          <input
                            type="tel"
                            value={editBusinessPhone}
                            onChange={(e) => setEditBusinessPhone(e.target.value)}
                            placeholder="e.g. 9606032491"
                            required
                            pattern="[0-9]{10}"
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary font-mono"
                          />
                        </div>

                        {/* Business Address */}
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Physical Store Address
                          </label>
                          <textarea
                            value={editBusinessAddress}
                            onChange={(e) => setEditBusinessAddress(e.target.value)}
                            placeholder="Store full address"
                            required
                            rows={3}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary"
                          />
                        </div>

                        {/* Razorpay Payment Profile URL */}
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Razorpay Payment Profile URL
                          </label>
                          <input
                            type="url"
                            value={editBusinessRazorpayUrl}
                            onChange={(e) => setEditBusinessRazorpayUrl(e.target.value)}
                            placeholder="e.g. https://razorpay.me/@tumblespin"
                            required
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary font-mono"
                          />
                        </div>

                        {/* Action buttons */}
                        <div className="pt-4 border-t border-slate-100 dark:border-brand-teal/5 flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              const curr = getBusinessInfo();
                              setEditBusinessName(curr.name);
                              setEditBusinessEmail(curr.email);
                              setEditBusinessPhone(curr.phone);
                              setEditBusinessAddress(curr.address);
                              setEditBusinessRazorpayUrl(curr.razorpayUrl || 'https://razorpay.me/@tumblespin');
                            }}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                          >
                            Reset
                          </button>
                          <button
                            type="submit"
                            className="px-5 py-2.5 rounded-full bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep text-xs font-bold uppercase tracking-wider shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all"
                            id="save-business-details-btn"
                          >
                            Save & Sync Store Profile
                          </button>
                        </div>
                      </form>

                      {/* Admin Email Notification Gateway Card */}
                      <div className="space-y-1 pt-6 border-t border-slate-200/60 dark:border-brand-teal/10">
                        <h4 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider font-mono flex items-center gap-2">
                          <Mail className="h-4 w-4 text-brand-primary dark:text-brand-accent" />
                          📧 Admin Email Notification Gateway (Universal Host Setup)
                        </h4>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          Ensure admin instant booking emails are delivered to your inbox regardless of where the website is hosted (Vercel, Render, Cloud Run, VPS, Hostinger, AWS, cPanel).
                        </p>
                      </div>

                      <form onSubmit={handleSaveEmailSettings} className="bg-white dark:bg-brand-deep/20 rounded-2xl p-5 md:p-6 border border-slate-100 dark:border-brand-teal/5 space-y-5" id="email-settings-form">
                        
                        {emailSettingsMsg.text && (
                          <div className={`p-4 rounded-xl text-xs font-bold border ${
                            emailSettingsMsg.type === 'success' 
                              ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/15 dark:text-brand-accent'
                              : 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/15 dark:text-red-300'
                          }`}>
                            {emailSettingsMsg.text}
                          </div>
                        )}

                        {/* Admin Notification Recipient Email */}
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Bell className="h-3 w-3 text-brand-primary dark:text-brand-accent" />
                            Admin Notification Recipient Email
                          </label>
                          <input
                            type="email"
                            value={adminNotifyEmail}
                            onChange={(e) => setAdminNotifyEmail(e.target.value)}
                            placeholder="e.g. tumblespin26@gmail.com"
                            required
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary font-mono"
                          />
                          <p className="text-[10px] text-slate-400">
                            All new customer order confirmations and booking alerts will be dispatched directly to this admin email address.
                          </p>
                        </div>

                        {/* SMTP Server Configuration */}
                        <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-brand-deep/40 border border-slate-200/60 dark:border-brand-teal/10 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                              <Server className="h-3.5 w-3.5 text-brand-primary dark:text-brand-accent" />
                              SMTP Email Credentials (e.g., Gmail App Password)
                            </span>
                            <span className="text-[10px] bg-brand-primary/10 text-brand-primary dark:bg-brand-accent/10 dark:text-brand-accent px-2 py-0.5 rounded-full font-extrabold uppercase font-mono">
                              Recommended
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                            <div className="sm:col-span-8 space-y-1">
                              <label className="block text-[9px] font-bold text-slate-400 uppercase">SMTP Host</label>
                              <input
                                type="text"
                                value={emailSmtpHost}
                                onChange={(e) => setEmailSmtpHost(e.target.value)}
                                placeholder="smtp.gmail.com"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/80 dark:text-white"
                              />
                            </div>
                            <div className="sm:col-span-4 space-y-1">
                              <label className="block text-[9px] font-bold text-slate-400 uppercase">SMTP Port</label>
                              <select
                                value={emailSmtpPort}
                                onChange={(e) => setEmailSmtpPort(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/80 dark:text-white"
                              >
                                <option value="465">465 (SSL / Gmail)</option>
                                <option value="587">587 (TLS / Standard)</option>
                                <option value="25">25 (Plain)</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="block text-[9px] font-bold text-slate-400 uppercase">SMTP Username / Email</label>
                              <input
                                type="email"
                                value={emailSmtpUser}
                                onChange={(e) => setEmailSmtpUser(e.target.value)}
                                placeholder="tumblespin26@gmail.com"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/80 dark:text-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[9px] font-bold text-slate-400 uppercase flex items-center justify-between">
                                <span>SMTP Password / App Password</span>
                                {hasStoredSmtpPass && (
                                  <span className="text-[9px] text-green-600 dark:text-brand-accent font-bold">Saved in DB</span>
                                )}
                              </label>
                              <div className="relative">
                                <input
                                  type={showSmtpPass ? 'text' : 'password'}
                                  value={emailSmtpPass}
                                  onChange={(e) => setEmailSmtpPass(e.target.value)}
                                  placeholder="e.g. 16-digit Google App Password"
                                  className="w-full rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-2 text-xs font-mono text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/80 dark:text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowSmtpPass(!showSmtpPass)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                                >
                                  {showSmtpPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[9px] font-bold text-slate-400 uppercase">Sender Display Name</label>
                            <input
                              type="text"
                              value={emailSmtpFrom}
                              onChange={(e) => setEmailSmtpFrom(e.target.value)}
                              placeholder="Tumble Spin Premium"
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/80 dark:text-white"
                            />
                          </div>
                        </div>

                        {/* Optional Resend API Key alternative */}
                        <div className="p-4 rounded-2xl bg-slate-50/40 dark:bg-brand-deep/20 border border-slate-200/50 dark:border-brand-teal/10 space-y-2">
                          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Key className="h-3 w-3 text-brand-primary dark:text-brand-accent" />
                            Alternative: Resend API Key (Optional)
                          </label>
                          <input
                            type="password"
                            value={emailResendApiKey}
                            onChange={(e) => setEmailResendApiKey(e.target.value)}
                            placeholder="e.g. re_123456789..."
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-mono text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white"
                          />
                        </div>

                        {/* Gmail App Password Setup Guide */}
                        <div className="p-4 rounded-xl bg-blue-50/60 text-blue-900 border border-blue-100 dark:bg-blue-950/30 dark:text-blue-200 dark:border-blue-900/30 text-[11px] leading-relaxed space-y-1.5">
                          <p className="font-bold flex items-center gap-1.5">
                            <HelpCircle className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                            💡 How to setup Gmail App Password for 100% Guaranteed Inbox Delivery Anywhere:
                          </p>
                          <ol className="list-decimal list-inside space-y-0.5 text-[10.5px] opacity-90 pl-1">
                            <li>Go to your Google Account (<span className="font-mono font-bold">myaccount.google.com</span>) &rarr; Security.</li>
                            <li>Ensure <span className="font-bold">2-Step Verification</span> is turned ON.</li>
                            <li>Search for <span className="font-bold">&quot;App Passwords&quot;</span> in Google Account search, generate a 16-character password, and paste it in the <span className="font-bold">SMTP Password</span> box above.</li>
                          </ol>
                        </div>

                        {/* Actions & Test Email Buttons */}
                        <div className="pt-2 border-t border-slate-100 dark:border-brand-teal/5 flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={handleSendTestEmail}
                            disabled={testEmailLoading}
                            className="px-4 py-2.5 rounded-full border border-brand-primary text-brand-primary hover:bg-brand-primary/5 dark:border-brand-accent dark:text-brand-accent dark:hover:bg-brand-accent/10 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50 transition-all"
                          >
                            <Send className="h-3.5 w-3.5" />
                            {testEmailLoading ? 'Dispatching Test Email...' : 'Send Test Admin Email'}
                          </button>

                          <button
                            type="submit"
                            disabled={emailSettingsLoading}
                            className="px-6 py-2.5 rounded-full bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep text-xs font-bold uppercase tracking-wider shadow-md hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all"
                          >
                            {emailSettingsLoading ? 'Saving Settings...' : 'Save Email Gateway Settings'}
                          </button>
                        </div>

                        {/* Test Email Result Banner */}
                        {testEmailResult && (
                          <div className={`p-4 rounded-xl text-xs font-mono border ${
                            testEmailResult.success 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
                              : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40'
                          }`}>
                            <div className="font-bold flex items-center gap-1.5 mb-1 text-sm font-sans">
                              {testEmailResult.success ? (
                                <>
                                  <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                  Test Admin Notification Dispatched Successfully!
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                  Test Notification Failed / Sandbox Warning
                                </>
                              )}
                            </div>
                            <p className="text-[11px] mb-1">Method Used: <span className="font-bold uppercase text-brand-primary dark:text-brand-accent">{testEmailResult.method || 'Unknown'}</span></p>
                            <p className="text-[11px] mb-1">Target Admin Email: <span className="font-bold">{testEmailResult.recipientEmail || adminNotifyEmail}</span></p>
                            {testEmailResult.etherealUrl && (
                              <p className="text-[11px] mt-2 pt-2 border-t border-amber-200/50 dark:border-amber-800/50">
                                ℹ️ <span className="font-bold">Ethereal Preview Link:</span> <a href={testEmailResult.etherealUrl} target="_blank" rel="noreferrer" className="underline text-blue-600 dark:text-blue-400 break-all">{testEmailResult.etherealUrl}</a> (Note: Configure SMTP/Gmail App Pass above to receive real inbox emails).
                              </p>
                            )}
                            {testEmailResult.error && (
                              <p className="text-[11px] text-red-600 dark:text-red-400 font-bold mt-1">
                                Error: {testEmailResult.error}
                              </p>
                            )}
                          </div>
                        )}

                      </form>
                    </div>
                  </div>
                )}

                {activeTab === 'offline' && (
                  <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    <div className="max-w-5xl mx-auto space-y-6">
                      
                      <div className="space-y-1">
                        <h4 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider font-mono">
                          🏬 Walk-In Offline Customer Billing Console
                        </h4>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          Create bills, generate invoices, send receipts directly to customer WhatsApp numbers, and automatically log the order in the active bookings directory.
                        </p>
                      </div>

                      {offlineSuccessMsg && (
                        <div className="p-4 rounded-xl text-xs font-bold bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/15 dark:text-brand-accent animate-bounce">
                          {offlineSuccessMsg}
                        </div>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        
                        {/* LEFT COLUMN: Customer & Catalog Selection */}
                        <div className="lg:col-span-7 space-y-6">
                          
                          {/* Part 1: Customer Metadata */}
                          <div className="bg-white dark:bg-brand-deep/20 rounded-2xl p-5 md:p-6 border border-slate-100 dark:border-brand-teal/5 space-y-4">
                            <h5 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono border-b border-slate-100 dark:border-brand-teal/5 pb-2">
                              📋 Customer Contact Details
                            </h5>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="block text-[9px] font-bold text-slate-500 uppercase">Customer Name *</label>
                                <input
                                  type="text"
                                  value={offlineCustomerName}
                                  onChange={(e) => setOfflineCustomerName(e.target.value)}
                                  placeholder="e.g. Anil Kumar"
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="block text-[9px] font-bold text-slate-500 uppercase">WhatsApp Mobile Number *</label>
                                <input
                                  type="tel"
                                  value={offlineCustomerPhone}
                                  onChange={(e) => setOfflineCustomerPhone(e.target.value)}
                                  placeholder="10 digits e.g. 9876543210"
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary font-mono"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="block text-[9px] font-bold text-slate-500 uppercase">Email (Optional)</label>
                                <input
                                  type="email"
                                  value={offlineCustomerEmail}
                                  onChange={(e) => setOfflineCustomerEmail(e.target.value)}
                                  placeholder="customer@example.com"
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="block text-[9px] font-bold text-slate-500 uppercase">Detergent / Care Option</label>
                                <select
                                  value={offlineCareOption}
                                  onChange={(e) => setOfflineCareOption(e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-slate-300 focus:outline-hidden focus:border-brand-primary"
                                >
                                  <option value="standard">Standard Premium Detergent</option>
                                  <option value="hypoallergenic">Hypoallergenic Eco-Wash</option>
                                  <option value="organic">Organic Scent-free Care</option>
                                </select>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[9px] font-bold text-slate-500 uppercase">Address / Special Instructions (Optional)</label>
                              <input
                                type="text"
                                value={offlineCustomerAddress}
                                onChange={(e) => setOfflineCustomerAddress(e.target.value)}
                                placeholder="Store pickup or client home delivery address..."
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary"
                              />
                            </div>
                          </div>

                          {/* Part 2: Quick-Add Item Catalog */}
                          <div className="bg-white dark:bg-brand-deep/20 rounded-2xl p-5 md:p-6 border border-slate-100 dark:border-brand-teal/5 space-y-4">
                            <h5 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono border-b border-slate-100 dark:border-brand-teal/5 pb-2">
                              👕 Interactive Garment Services Catalog
                            </h5>
                            
                            <p className="text-[11px] text-slate-400">Click any garment package below to add it directly to customer's offline invoice:</p>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {OFFLINE_CATALOG_ITEMS.map((item, idx) => {
                                const inv = getItemInventory(item.id);
                                const isOutOfStock = !inv.available || inv.stock <= 0;
                                return (
                                  <button
                                    key={`pos-item-${item.id}-${idx}`}
                                    type="button"
                                    disabled={isOutOfStock}
                                    onClick={() => handleAddCatalogToCart(item)}
                                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between h-24 group relative ${
                                      isOutOfStock
                                        ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed dark:border-brand-teal/5 dark:bg-brand-deep/10 text-slate-400'
                                        : 'border-slate-100 hover:border-brand-primary hover:bg-brand-primary/5 dark:border-brand-teal/5 dark:hover:border-brand-accent dark:hover:bg-brand-teal/5'
                                    }`}
                                  >
                                    <div className="w-full">
                                      <span className={`text-[11px] font-bold block line-clamp-1 ${isOutOfStock ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200 group-hover:text-brand-primary dark:group-hover:text-brand-accent'}`}>
                                        {item.name}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-mono block leading-none mt-0.5">{item.serviceType}</span>
                                    </div>
                                    <div className="flex justify-between items-end w-full mt-1">
                                      <span className={`text-[9px] font-mono font-bold ${
                                        isOutOfStock 
                                          ? 'text-rose-500 dark:text-rose-400' 
                                          : inv.stock < 10 
                                            ? 'text-amber-500 font-extrabold' 
                                            : 'text-slate-400'
                                      }`}>
                                        {isOutOfStock ? 'Out of Stock' : `Stock: ${inv.stock}`}
                                      </span>
                                      <span className={`text-xs font-extrabold font-mono ${isOutOfStock ? 'text-slate-400' : 'text-slate-800 dark:text-white'}`}>
                                        ₹{item.price}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Part 3: Custom Item Input */}
                            <div className="border-t border-slate-100 dark:border-brand-teal/5 pt-4">
                              <h6 className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 font-mono">➕ Add Custom Unlisted Garment / Weight</h6>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={customItemName}
                                  onChange={(e) => setCustomItemName(e.target.value)}
                                  placeholder="Garment name (e.g. Silk Carpet)"
                                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden"
                                />
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={customItemPrice}
                                  onChange={(e) => setCustomItemPrice(e.target.value)}
                                  placeholder="Price ₹"
                                  className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={handleAddCustomItem}
                                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-900 text-xs font-bold uppercase tracking-wider dark:bg-brand-accent dark:text-brand-deep transition-all shrink-0 cursor-pointer"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Part 4: Stock & Service Availability Manager (Collapsible) */}
                          <div className="bg-white dark:bg-brand-deep/20 rounded-2xl border border-slate-100 dark:border-brand-teal/5 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setIsInventoryExpanded(!isInventoryExpanded)}
                              className="w-full flex justify-between items-center px-5 py-4 text-left font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono hover:bg-slate-50 dark:hover:bg-brand-teal/5 transition-colors"
                            >
                              <span className="flex items-center gap-1.5">
                                <Package className="h-4 w-4 text-brand-teal" />
                                📦 Real-time Inventory & Service Capacity
                              </span>
                              <span className="text-[10px] text-brand-primary dark:text-brand-accent font-extrabold">
                                {isInventoryExpanded ? 'Hide Controls ▲' : 'Show Controls ▼'}
                              </span>
                            </button>

                            {isInventoryExpanded && (
                              <div className="p-5 md:p-6 border-t border-slate-100 dark:border-brand-teal/5 bg-slate-50/50 dark:bg-brand-deep/10 space-y-4">
                                <p className="text-[11px] text-slate-400">
                                  View and adjust live stock counts or temporarily pause service packages. Changes automatically sync across all store devices via Firestore.
                                </p>
                                
                                <div className="divide-y divide-slate-100 dark:divide-brand-teal/5 space-y-3 max-h-72 overflow-y-auto pr-1">
                                  {Object.entries(inventory).map(([id, rawItem], idx) => {
                                    const invItem = rawItem as { name: string; stock: number; available: boolean };
                                    const catalogItem = OFFLINE_CATALOG_ITEMS.find(c => c.id === id);
                                    if (!catalogItem) return null;
                                    return (
                                      <div key={`inv-${id}-${idx}`} className="flex justify-between items-center text-xs pt-3 first:pt-0">
                                        <div className="space-y-0.5 max-w-[50%]">
                                          <p className="font-bold text-slate-800 dark:text-white truncate">{invItem.name || catalogItem.name}</p>
                                          <p className="text-[10px] text-slate-400 italic">{catalogItem.serviceType}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                          {/* Stock counter controls */}
                                          <div className="flex items-center border border-slate-200 dark:border-brand-teal/15 rounded-md overflow-hidden bg-white dark:bg-brand-deep">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const updated = { ...inventory };
                                                const nextStock = Math.max(0, invItem.stock - 5);
                                                updated[id] = { ...invItem, stock: nextStock, available: nextStock > 0 };
                                                setInventory(updated);
                                                localStorage.setItem('tumblespin_inventory', JSON.stringify(updated));
                                                window.dispatchEvent(new Event('storage'));
                                              }}
                                              className="px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-brand-teal/5 font-extrabold font-mono text-[10px]"
                                              title="Reduce stock by 5"
                                            >
                                              -5
                                            </button>
                                            <input
                                              type="number"
                                              value={invItem.stock}
                                              onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                const updated = { ...inventory };
                                                const nextStock = isNaN(val) ? 0 : Math.max(0, val);
                                                updated[id] = { ...invItem, stock: nextStock, available: nextStock > 0 };
                                                setInventory(updated);
                                                localStorage.setItem('tumblespin_inventory', JSON.stringify(updated));
                                                window.dispatchEvent(new Event('storage'));
                                              }}
                                              className="w-12 text-center text-[11px] font-extrabold font-mono text-slate-800 dark:text-white focus:outline-hidden border-x border-slate-200 dark:border-brand-teal/15 py-1"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const updated = { ...inventory };
                                                const nextStock = invItem.stock + 10;
                                                updated[id] = { ...invItem, stock: nextStock, available: nextStock > 0 };
                                                setInventory(updated);
                                                localStorage.setItem('tumblespin_inventory', JSON.stringify(updated));
                                                window.dispatchEvent(new Event('storage'));
                                              }}
                                              className="px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-brand-teal/5 font-extrabold font-mono text-[10px]"
                                              title="Add stock by 10"
                                            >
                                              +10
                                            </button>
                                          </div>

                                          {/* Toggle Availability Badge/Switch */}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updated = { ...inventory };
                                              const nextAvailable = !invItem.available;
                                              const nextStock = nextAvailable && invItem.stock === 0 ? 10 : invItem.stock;
                                              updated[id] = { ...invItem, available: nextAvailable, stock: nextStock };
                                              setInventory(updated);
                                              localStorage.setItem('tumblespin_inventory', JSON.stringify(updated));
                                              window.dispatchEvent(new Event('storage'));
                                            }}
                                            className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                                              invItem.available && invItem.stock > 0
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                            }`}
                                          >
                                            {invItem.available && invItem.stock > 0 ? 'Active' : 'Paused'}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                        </div>

                        {/* RIGHT COLUMN: Active Cart Invoice Preview */}
                        <div className="lg:col-span-5 bg-white dark:bg-brand-deep/20 rounded-2xl p-5 md:p-6 border border-slate-100 dark:border-brand-teal/5 space-y-4">
                          <div className="flex justify-between items-center border-b border-slate-100 dark:border-brand-teal/5 pb-2">
                            <h5 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                              <ShoppingCart className="h-4 w-4 text-brand-primary dark:text-brand-accent" />
                              Billed Cart Items
                            </h5>
                            <span className="text-[10px] font-bold bg-slate-100 dark:bg-brand-deep px-2 py-0.5 rounded-full text-slate-500 font-mono">
                              {offlineCart.reduce((s, i) => s + i.quantity, 0)} Items
                            </span>
                          </div>

                          {offlineCart.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 text-xs italic space-y-2 border border-dashed border-slate-200 dark:border-brand-teal/10 rounded-xl bg-slate-50/50 dark:bg-brand-deep/10">
                              <ShoppingBag className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-700 animate-pulse" />
                              <p>Shopping cart is currently empty.</p>
                              <p className="text-[10px]">Click catalog garments on the left or add a custom item to bill!</p>
                            </div>
                          ) : (
                            <div className="space-y-3.5 max-h-60 overflow-y-auto pr-1">
                              {offlineCart.map((item, idx) => (
                                <div key={`cart-item-${item.id}-${idx}`} className="flex justify-between items-center text-xs pb-2 border-b border-slate-100 dark:border-brand-teal/5">
                                  <div className="space-y-0.5 max-w-[65%]">
                                    <p className="font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{item.name}</p>
                                    <p className="text-[10px] text-slate-400 italic">{item.serviceType}</p>
                                  </div>
                                  <div className="flex items-center gap-2.5">
                                    <div className="flex items-center border border-slate-200 dark:border-brand-teal/15 rounded-md overflow-hidden bg-white dark:bg-brand-deep">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateCartQuantity(item.id, -1)}
                                        className="p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-brand-teal/5 font-extrabold"
                                      >
                                        <Minus className="h-3 w-3" />
                                      </button>
                                      <span className="px-2 text-[11px] font-extrabold font-mono text-slate-800 dark:text-white">
                                        {item.quantity}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateCartQuantity(item.id, 1)}
                                        className="p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-brand-teal/5 font-extrabold"
                                      >
                                        <Plus className="h-3 w-3" />
                                      </button>
                                    </div>
                                    <span className="font-mono font-bold text-slate-800 dark:text-white w-14 text-right">
                                      ₹{item.price * item.quantity}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Price Calculation Summary */}
                          <div className="bg-slate-50 dark:bg-brand-deep/30 rounded-xl p-3.5 space-y-2 border border-slate-100 dark:border-brand-teal/5 text-xs">
                            <div className="flex justify-between text-slate-500">
                              <span>Items Subtotal:</span>
                              <span className="font-mono">₹{getOfflineSubtotal()}</span>
                            </div>

                            {dynamicPricing && dynamicPricing.mode !== 'none' && dynamicPricing.percentage > 0 && (
                              <div className="flex justify-between text-brand-primary dark:text-brand-accent font-bold">
                                <span>{dynamicPricing.label || (dynamicPricing.mode === 'surcharge' ? 'Demand Surcharge' : 'Dynamic Discount')} ({dynamicPricing.percentage}%):</span>
                                <span className="font-mono">
                                  {dynamicPricing.mode === 'surcharge' ? '+' : '-'}₹{Math.round((getOfflineSubtotal() * dynamicPricing.percentage) / 100)}
                                </span>
                              </div>
                            )}

                            <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 dark:border-brand-teal/10 text-slate-950 dark:text-white font-extrabold">
                              <span className="uppercase tracking-wider text-[10px]">Grand Total Bill:</span>
                              <span className="font-mono text-base text-brand-primary dark:text-brand-accent">₹{getOfflineGrandTotal()}</span>
                            </div>
                          </div>

                          {/* ACTION BUTTONS */}
                          <div className="space-y-2 pt-2">
                            <button
                              type="button"
                              onClick={(e) => handleGenerateOfflineBill(e, 'save')}
                              className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep py-3 text-xs font-bold uppercase tracking-wider shadow-sm hover:scale-[1.01] transition-transform cursor-pointer"
                            >
                              <Receipt className="h-4 w-4" />
                              Save, Record & Print Receipt
                            </button>

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={(e) => handleGenerateOfflineBill(e, 'download')}
                                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-brand-teal/20 dark:bg-brand-deep dark:text-slate-300 dark:hover:text-white py-2.5 text-[10px] font-extrabold uppercase tracking-widest transition-colors cursor-pointer"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Download PDF
                              </button>

                              <button
                                type="button"
                                onClick={(e) => handleGenerateOfflineBill(e, 'whatsapp')}
                                className="flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] hover:opacity-95 text-white py-2.5 text-[10px] font-extrabold uppercase tracking-widest transition-opacity cursor-pointer"
                              >
                                <MessageSquare className="h-3.5 w-3.5 fill-current" />
                                Send WhatsApp
                              </button>
                            </div>
                          </div>

                        </div>

                      </div>

                    </div>
                  </div>
                )}

                {activeTab === 'customers' && (() => {
                  const allCustomers = computeCustomerDirectory(orders);
                  const filteredCustomers = allCustomers.filter(c => {
                    const q = customerSearchQuery.toLowerCase();
                    return c.fullName.toLowerCase().includes(q) || 
                           c.email.toLowerCase().includes(q) || 
                           c.phone.toLowerCase().includes(q) ||
                           c.address.toLowerCase().includes(q);
                  });

                  const selectedCustomer = selectedCustomerKey ? allCustomers.find(c => c.key === selectedCustomerKey) || null : null;

                  return (
                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
                      {/* Left Side: Customers list */}
                      <div className={`w-full md:w-2/5 border-r border-slate-100 dark:border-brand-teal/10 flex flex-col min-h-0 bg-slate-50/50 dark:bg-brand-deep/10 ${selectedCustomer ? 'hidden md:flex' : 'flex'}`}>
                        <div className="p-3.5 bg-white dark:bg-brand-dark border-b border-slate-100 dark:border-brand-teal/5 flex flex-wrap justify-between items-center gap-2 shrink-0">
                          <div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider font-mono block">
                              Customer Directory ({filteredCustomers.length})
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => exportCustomersToExcel(filteredCustomers.length > 0 ? filteredCustomers : allCustomers, businessInfo.name)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer whitespace-nowrap"
                              title="Export all customers to Excel (.xlsx) spreadsheet"
                              id="export-customer-directory-excel-btn"
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5" />
                              <span>Export Excel (.xlsx)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => printCustomerDirectory(filteredCustomers.length > 0 ? filteredCustomers : allCustomers, businessInfo.name)}
                              className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-brand-deep/80 dark:hover:bg-brand-teal/20 text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-brand-teal/10 transition-all cursor-pointer whitespace-nowrap"
                              title="Print entire customer data sheet"
                              id="print-customer-directory-btn"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Print</span>
                            </button>
                          </div>
                        </div>

                        {/* Search bar */}
                        <div className="p-3 bg-white dark:bg-brand-dark/40 border-b border-slate-100 dark:border-brand-teal/5 space-y-2 shrink-0">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Search customers..."
                              value={customerSearchQuery}
                              onChange={(e) => setCustomerSearchQuery(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-8 py-1.5 text-xs font-medium text-slate-800 dark:border-brand-teal/10 dark:bg-brand-deep/60 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-primary/20"
                            />
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            {customerSearchQuery && (
                              <button
                                onClick={() => setCustomerSearchQuery('')}
                                className="absolute right-2.5 top-1.5 hover:text-slate-800 dark:hover:text-white text-slate-400 font-bold text-xs cursor-pointer"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Customers scroll list */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                          {filteredCustomers.length === 0 ? (
                            <div className="text-center py-10 space-y-2">
                              <User className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto" />
                              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">No customers found</p>
                            </div>
                          ) : (
                            filteredCustomers.map((c, idx) => {
                              const isSelected = selectedCustomerKey === c.key;
                              return (
                                <div
                                  key={`${c.key}-${idx}`}
                                  onClick={() => setSelectedCustomerKey(c.key)}
                                  className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                                    isSelected
                                      ? 'bg-brand-primary/5 dark:bg-brand-accent/5 border-brand-primary dark:border-brand-accent shadow-xs'
                                      : 'bg-white dark:bg-brand-dark/65 border-slate-200/40 dark:border-brand-teal/5 hover:border-slate-200 dark:hover:border-brand-accent/10'
                                  }`}
                                >
                                  <div className="flex justify-between items-start gap-2">
                                    <div className="flex items-center gap-3">
                                      <div className="h-8 w-8 rounded-full bg-brand-primary/10 text-brand-primary dark:bg-brand-accent/10 dark:text-brand-accent flex items-center justify-center font-bold text-xs font-mono">
                                        {c.fullName.substring(0, 2).toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate font-mono">
                                          {c.fullName}
                                        </h4>
                                        <p className="text-[10px] text-slate-400 truncate">
                                          {c.phone !== 'N/A' ? c.phone : c.email}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-xs font-black text-slate-800 dark:text-white font-mono block">
                                        ₹{Number(c.totalSpend || 0).toFixed(2)}
                                      </span>
                                      <span className="text-[9px] font-bold text-slate-400 block">
                                        {c.offlineOrders.length + c.onlineOrders.length} orders
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Right Side: Selected Customer Details */}
                      <div className={`flex-1 overflow-y-auto p-6 space-y-6 bg-white dark:bg-brand-dark/40 ${selectedCustomer ? 'block' : 'hidden md:block'}`}>
                        {selectedCustomer ? (
                          <div className="space-y-6">
                            {/* Mobile Back Button */}
                            <button
                              onClick={() => setSelectedCustomerKey(null)}
                              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200 dark:bg-brand-deep/80 dark:hover:bg-brand-teal/20 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200/40 dark:border-brand-teal/5"
                            >
                              ← Back to Customer List
                            </button>

                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-100 dark:border-brand-teal/10">
                              <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-2xl bg-brand-primary/10 text-brand-primary dark:bg-brand-accent/10 dark:text-brand-accent flex items-center justify-center font-black text-lg font-mono shadow-xs">
                                  {selectedCustomer.fullName.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <span className="text-[10px] font-mono font-bold text-brand-primary dark:text-brand-accent uppercase tracking-widest">
                                    Customer Directory
                                  </span>
                                  <h3 className="text-lg font-serif font-bold text-slate-800 dark:text-white mt-1">
                                    {selectedCustomer.fullName}
                                  </h3>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => exportCustomersToExcel([selectedCustomer], businessInfo.name)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer"
                                  title="Export this customer data into Excel (.xlsx) sheet"
                                >
                                  <FileSpreadsheet className="h-3.5 w-3.5" />
                                  <span>Excel Sheet</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => printCustomerDirectory([selectedCustomer], businessInfo.name)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-brand-deep/80 dark:hover:bg-brand-teal/20 text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-brand-teal/10 transition-all cursor-pointer"
                                  title="Print customer profile"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                  <span>Print</span>
                                </button>
                                <div className="bg-slate-50 dark:bg-brand-deep/30 border border-slate-100 dark:border-brand-teal/5 rounded-2xl p-3 text-center min-w-[90px]">
                                  <span className="text-[9px] uppercase font-mono text-slate-400 font-bold block">Total Spent</span>
                                  <strong className="text-md font-black font-mono text-brand-primary dark:text-brand-accent">₹{Number(selectedCustomer.totalSpend || 0).toFixed(2)}</strong>
                                </div>
                                <div className="bg-slate-50 dark:bg-brand-deep/30 border border-slate-100 dark:border-brand-teal/5 rounded-2xl p-3 text-center min-w-[90px]">
                                  <span className="text-[9px] uppercase font-mono text-slate-400 font-bold block">Offline Spent</span>
                                  <strong className="text-md font-black font-mono text-emerald-600 dark:text-emerald-400">₹{Number(selectedCustomer.totalOfflineSpend || 0).toFixed(2)}</strong>
                                </div>
                              </div>
                            </div>

                            {/* Contact Card Details */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="bg-slate-50/50 dark:bg-brand-deep/10 border border-slate-100 dark:border-brand-teal/5 p-4 rounded-2xl space-y-2">
                                <span className="text-[9px] uppercase font-mono text-slate-400 font-bold block">Contact Information</span>
                                <div className="space-y-1.5 text-xs font-semibold">
                                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                                    <span className="truncate">{selectedCustomer.email}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                                    <span>{selectedCustomer.phone}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-slate-50/50 dark:bg-brand-deep/10 border border-slate-100 dark:border-brand-teal/5 p-4 rounded-2xl space-y-2">
                                <span className="text-[9px] uppercase font-mono text-slate-400 font-bold block">Default Delivery Address</span>
                                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-start gap-2">
                                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                                  <span>{selectedCustomer.address}</span>
                                </div>
                              </div>
                            </div>

                            {/* Historical Offline Billing Order Summaries */}
                            <div className="space-y-3">
                              <h4 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider font-mono flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-brand-teal/5">
                                <Receipt className="h-4 w-4 text-emerald-500" />
                                Historical Offline Billing Order Summaries ({selectedCustomer.offlineOrders.length})
                              </h4>

                              {selectedCustomer.offlineOrders.length === 0 ? (
                                <div className="text-center py-8 bg-slate-50/50 dark:bg-brand-deep/10 border border-slate-100 dark:border-brand-teal/5 rounded-2xl">
                                  <Info className="h-5 w-5 text-slate-400 mx-auto mb-2" />
                                  <p className="text-xs text-slate-400 font-bold font-mono uppercase">No Offline Billing Orders Found</p>
                                  <p className="text-[10px] text-slate-400/80 mt-1">Orders placed via walk-in counter will appear here.</p>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {selectedCustomer.offlineOrders.map((order, idx) => (
                                    <div 
                                      key={`cust-ord-${order.orderId || idx}-${idx}`}
                                      className="p-4 bg-white dark:bg-brand-deep/20 border border-slate-200/50 dark:border-brand-teal/5 rounded-2xl hover:shadow-xs transition-shadow"
                                    >
                                      <div className="flex flex-wrap justify-between items-start gap-2 border-b border-slate-100 dark:border-brand-teal/5 pb-2.5 mb-2.5">
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-slate-800 dark:text-white font-mono">
                                              #{order.orderId}
                                            </span>
                                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-brand-teal/10 dark:text-brand-accent">
                                              Offline Bill
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-slate-400 mt-1 font-mono">
                                            Placed: {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' }) : 'N/A'}
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <span className="text-xs font-black text-slate-800 dark:text-white font-mono block">
                                            ₹{order.totalPrice}
                                          </span>
                                          <span className={`text-[9px] font-extrabold font-mono uppercase ${
                                            order.status === 'Returned Flawless' ? 'text-emerald-500' : 'text-amber-500'
                                          }`}>
                                            {order.status}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="space-y-1.5">
                                        <span className="text-[9px] uppercase font-mono text-slate-400 font-bold block">Service Details</span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                          {order.subServices?.map((item, idx) => (
                                            <div key={`cust-sub-${item.id || item.name || idx}-${idx}`} className="flex justify-between items-center bg-slate-50/50 dark:bg-brand-deep/10 px-2.5 py-1 rounded-lg">
                                              <span className="truncate">{item.name} <span className="text-[9px] text-slate-400">({item.serviceType})</span></span>
                                              <span className="font-mono text-slate-700 dark:text-slate-200 shrink-0 ml-2">x{item.quantity}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-center p-6 border border-dashed border-slate-200 dark:border-brand-teal/15 rounded-3xl">
                            <div className="space-y-2">
                              <User className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto" />
                              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider font-mono">Select a Customer</h4>
                              <p className="text-xs text-slate-400">Choose a customer from the directory list on the left to inspect their profile contact details and offline order summaries.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {activeTab === 'analytics' && (() => {
                  const revenueData = (() => {
                    const data = [];
                    const now = new Date();
                    
                    // Create 30 days array back from today
                    for (let i = 29; i >= 0; i--) {
                      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
                      const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
                      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); // e.g. "Jul 3"
                      
                      data.push({
                        date: dateStr,
                        label,
                        Online: 0,
                        Offline: 0,
                        Total: 0
                      });
                    }
                    
                    orders.forEach(order => {
                      if (!order.createdAt) return;
                      const orderDateStr = order.createdAt.split('T')[0];
                      const match = data.find(item => item.date === orderDateStr);
                      if (match) {
                        const isOffline = order.selectedServices?.includes('Walk-in Counter Service') || 
                                          order.pickupTimeSlot === 'Store Drop-off' || 
                                          order.address === 'Offline Walk-in Customer';
                        const price = order.totalPrice || 0;
                        if (isOffline) {
                          match.Offline += price;
                        } else {
                          match.Online += price;
                        }
                        match.Total += price;
                      }
                    });
                    
                    return data;
                  })();

                  // Calculate metrics
                  let total30DayRevenue = 0;
                  let totalOnlineRevenue = 0;
                  let totalOfflineRevenue = 0;
                  let onlineOrdersCount = 0;
                  let offlineOrdersCount = 0;

                  orders.forEach(order => {
                    if (!order.createdAt) return;
                    const diffTime = Math.abs(new Date().getTime() - new Date(order.createdAt).getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays <= 30) {
                      const isOffline = order.selectedServices?.includes('Walk-in Counter Service') || 
                                        order.pickupTimeSlot === 'Store Drop-off' || 
                                        order.address === 'Offline Walk-in Customer';
                      const price = order.totalPrice || 0;
                      if (isOffline) {
                        totalOfflineRevenue += price;
                        offlineOrdersCount++;
                      } else {
                        totalOnlineRevenue += price;
                        onlineOrdersCount++;
                      }
                      total30DayRevenue += price;
                    }
                  });

                  return (
                    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-50/30 dark:bg-brand-deep/5">
                      <div className="max-w-5xl mx-auto space-y-6">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <h4 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider font-mono">
                              📈 30-Day Revenue & Performance Insights
                            </h4>
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              Real-time analytics showing daily revenue trends, order volume splits, and digital concierge performance.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const allCusts = computeCustomerDirectory(orders);
                                exportCustomersToExcel(allCusts, businessInfo.name);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer whitespace-nowrap"
                              title="Export entire customer database to Excel (.xlsx)"
                              id="analytics-export-customers-excel-btn"
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5" />
                              <span>Export All Customers (.xlsx)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const allCusts = computeCustomerDirectory(orders);
                                printCustomerDirectory(allCusts, businessInfo.name);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-brand-deep/80 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-brand-teal/10 shadow-xs transition-all cursor-pointer whitespace-nowrap"
                              title="Print customer directory report"
                              id="analytics-print-customers-btn"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              <span>Print Customers</span>
                            </button>
                          </div>
                        </div>

                        {/* Summary Metrics Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="bg-gradient-to-br from-brand-primary/10 to-brand-secondary/5 dark:from-brand-teal/15 dark:to-brand-deep border border-brand-primary/20 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                                Total 30-Day Revenue
                              </span>
                              <TrendingUp className="h-4 w-4 text-brand-primary dark:text-brand-accent" />
                            </div>
                            <div className="mt-3">
                              <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-none font-mono">
                                ₹{total30DayRevenue.toFixed(2)}
                              </h3>
                              <span className="text-[10px] text-slate-400 mt-1 block">Combined Offline + Online sales</span>
                            </div>
                          </div>

                          <div className="bg-slate-50 dark:bg-brand-deep/30 border border-slate-100 dark:border-brand-teal/5 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                                Online Concierge Channels
                              </span>
                              <div className="p-1 rounded-md bg-brand-primary/10">
                                <Truck className="h-4 w-4 text-brand-primary dark:text-brand-accent" />
                              </div>
                            </div>
                            <div className="mt-3">
                              <h3 className="text-2xl font-black text-brand-primary dark:text-slate-200 leading-none font-mono">
                                ₹{totalOnlineRevenue.toFixed(2)}
                              </h3>
                              <span className="text-[10px] text-slate-400 mt-1 block">{onlineOrdersCount} deliveries scheduled</span>
                            </div>
                          </div>

                          <div className="bg-slate-50 dark:bg-brand-deep/30 border border-slate-100 dark:border-brand-teal/5 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                                Walk-in Counter Channels
                              </span>
                              <div className="p-1 rounded-md bg-emerald-500/10">
                                <Store className="h-4 w-4 text-emerald-500" />
                              </div>
                            </div>
                            <div className="mt-3">
                              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none font-mono">
                                ₹{totalOfflineRevenue.toFixed(2)}
                              </h3>
                              <span className="text-[10px] text-slate-400 mt-1 block">{offlineOrdersCount} walk-in counter sales completed</span>
                            </div>
                          </div>
                        </div>

                        {/* Chart Area */}
                        <div className="bg-white dark:bg-brand-deep/10 border border-slate-100 dark:border-brand-teal/5 rounded-2xl p-5 space-y-4">
                          <h5 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
                            📊 Daily Revenue Trends (Last 30 Days)
                          </h5>

                          <div className="h-80 w-full" id="revenue-trend-chart-container">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart
                                data={revenueData}
                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                              >
                                <defs>
                                  <linearGradient id="colorOnline" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#9D4EDD" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#9D4EDD" stopOpacity={0}/>
                                  </linearGradient>
                                  <linearGradient id="colorOffline" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#5EEAD4" stopOpacity={0.25}/>
                                    <stop offset="95%" stopColor="#5EEAD4" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(157, 78, 221, 0.05)" />
                                <XAxis 
                                  dataKey="label" 
                                  tickLine={false} 
                                  axisLine={false}
                                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600, fontFamily: 'monospace' }}
                                />
                                <YAxis 
                                  tickLine={false} 
                                  axisLine={false}
                                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600, fontFamily: 'monospace' }}
                                  tickFormatter={(v) => `₹${v}`}
                                />
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: '#0f172a', 
                                    borderRadius: '16px', 
                                    border: '1px solid rgba(157, 78, 221, 0.1)',
                                    color: '#f8fafc',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    fontFamily: 'monospace'
                                  }}
                                  itemStyle={{ color: '#f8fafc' }}
                                />
                                <Legend 
                                  verticalAlign="top" 
                                  height={36}
                                  iconType="circle"
                                  iconSize={8}
                                  wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase' }}
                                />
                                <Area 
                                  type="monotone" 
                                  dataKey="Online" 
                                  stroke="#9D4EDD" 
                                  strokeWidth={2}
                                  fillOpacity={1} 
                                  fill="url(#colorOnline)" 
                                />
                                <Area 
                                  type="monotone" 
                                  dataKey="Offline" 
                                  stroke="#5EEAD4" 
                                  strokeWidth={2}
                                  fillOpacity={1} 
                                  fill="url(#colorOffline)" 
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Order Composition and Split stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-slate-50/50 dark:bg-brand-deep/10 border border-slate-100 dark:border-brand-teal/5 p-5 rounded-2xl">
                            <h5 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono border-b border-slate-100 dark:border-brand-teal/5 pb-2 mb-3">
                              Concierge Performance Analysis
                            </h5>
                            <div className="space-y-3 font-mono text-[11px]">
                              <div className="flex justify-between items-center font-bold">
                                <span className="text-slate-500">Average Concierge Ticket:</span>
                                <span className="text-slate-800 dark:text-white">
                                  ₹{onlineOrdersCount > 0 ? Math.round(totalOnlineRevenue / onlineOrdersCount) : 0}
                                </span>
                              </div>
                              <div className="flex justify-between items-center font-bold">
                                <span className="text-slate-500">Average Walk-In Ticket:</span>
                                <span className="text-slate-800 dark:text-white">
                                  ₹{offlineOrdersCount > 0 ? Math.round(totalOfflineRevenue / offlineOrdersCount) : 0}
                                </span>
                              </div>
                              <div className="flex justify-between items-center font-bold">
                                <span className="text-slate-500">Revenue Split:</span>
                                <span className="text-brand-primary dark:text-brand-accent">
                                  {total30DayRevenue > 0 ? Math.round((totalOnlineRevenue / total30DayRevenue) * 100) : 0}% Online / {total30DayRevenue > 0 ? Math.round((totalOfflineRevenue / total30DayRevenue) * 100) : 0}% Offline
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-slate-50/50 dark:bg-brand-deep/10 border border-slate-100 dark:border-brand-teal/5 p-5 rounded-2xl">
                            <h5 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono border-b border-slate-100 dark:border-brand-teal/5 pb-2 mb-3">
                              Service Demand Analysis
                            </h5>
                            <div className="space-y-3 font-mono text-[11px]">
                              <div className="flex justify-between items-center font-bold">
                                <span className="text-slate-500">Active Concierge Surcharge Mode:</span>
                                <span className="text-brand-primary dark:text-brand-accent uppercase">
                                  {dynamicPricing?.mode !== 'none' ? `${dynamicPricing?.mode} (${dynamicPricing?.percentage}%)` : 'Disabled'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center font-bold">
                                <span className="text-slate-500">Peak Demand Label:</span>
                                <span className="text-slate-800 dark:text-white truncate max-w-[150px]">
                                  {dynamicPricing?.label || 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center font-bold">
                                <span className="text-slate-500">Total System Transactions:</span>
                                <span className="text-slate-800 dark:text-white">
                                  {orders.length} orders
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })()}

                {activeTab === 'deleted_orders' && adminRole === 'master' && (
                  <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-brand-teal/5 pb-5">
                      <div className="space-y-1">
                        <h4 className="text-md font-extrabold text-slate-800 dark:text-white uppercase tracking-wider font-mono flex items-center gap-2">
                          🗑️ Archived & Deleted Orders Log
                        </h4>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          Inspect and recover orders deleted by administrators. Ensure direct custody, business audit-trail consistency, and transaction transparency.
                        </p>
                      </div>
                      {deletedOrders.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Are you absolutely sure you want to permanently purge all deleted order logs? This action is irreversible.")) {
                              handlePurgeDeletedOrders();
                            }
                          }}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 border border-rose-200/50 dark:border-rose-900/30 transition-all cursor-pointer"
                        >
                          Purge Archived Logs
                        </button>
                      )}
                    </div>

                    {deletedOrders.length === 0 ? (
                      <div className="text-center py-16 bg-slate-50/50 dark:bg-brand-deep/10 border border-dashed border-slate-200 dark:border-brand-teal/15 rounded-3xl">
                        <ShieldCheck className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                        <h5 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">No Deleted Orders Found</h5>
                        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                          Every time an order is deleted from the active board by any supervisor, it is archived safely here for master audit.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {deletedOrders.map((order, idx) => (
                          <div 
                            key={`del-ord-${order.orderId || 'deleted'}-${idx}`}
                            className="bg-white dark:bg-brand-deep/20 rounded-2xl p-5 border border-slate-100 dark:border-brand-teal/5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6"
                          >
                            <div className="space-y-2.5 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2.5">
                                <span className="text-xs font-black text-slate-800 dark:text-white font-mono">
                                  #{order.orderId}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-brand-teal/15 dark:text-brand-accent">
                                  Deleted by {order.deletedBy || 'Admin'}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono">
                                  on {order.deletedAt || 'N/A'}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                <div>
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Client Details</span>
                                  <span className="font-extrabold text-slate-700 dark:text-slate-300 block truncate">{order.fullName}</span>
                                  <span className="text-slate-400 dark:text-slate-500 block truncate">{order.phone} • {order.email}</span>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Logistics Slot</span>
                                  <span className="text-slate-500 dark:text-slate-400 block">Pick: {order.pickupDate} ({order.pickupTimeSlot})</span>
                                  <span className="text-slate-500 dark:text-slate-400 block">Del: {order.deliveryDate} ({order.deliveryTimeSlot})</span>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Financial Status</span>
                                  <span className="font-mono font-black text-slate-700 dark:text-white block">₹{Number(order.totalPrice || 0).toFixed(2)}</span>
                                  <span className="text-[10px] font-bold block text-slate-500 dark:text-slate-400 uppercase mt-0.5">{order.status}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto border-t md:border-t-0 border-slate-100 dark:border-brand-teal/5 pt-3.5 md:pt-0">
                              <button
                                type="button"
                                onClick={() => handleRestoreOrder(order)}
                                className="px-4 py-2 rounded-xl bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep text-xs font-bold uppercase tracking-wider shadow-xs hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center gap-1.5 cursor-pointer"
                                title="Restore back to active orders board"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Restore
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePermanentlyDeleteArchivedOrder(order.orderId)}
                                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                title="Permanently delete from archive logs"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Purge
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'webhooks' && (
                  <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-brand-teal/5 pb-5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-md font-extrabold text-slate-800 dark:text-white uppercase tracking-wider font-mono flex items-center gap-2">
                            <Server className="h-4 w-4 text-brand-primary dark:text-brand-accent" />
                            ⚡ Live Payment Gateway Webhooks & Payload Debugger
                          </h4>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/50 uppercase font-mono">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Real Webhooks Only
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          Inspect real-time incoming payment gateway webhooks, raw JSON payloads, transaction IDs, amounts, and verification statuses.
                        </p>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={handleClearMockWebhooks}
                          disabled={clearingMockWebhooks}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:text-rose-300 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 border border-rose-200 dark:border-rose-800/40 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {clearingMockWebhooks ? 'Purging...' : 'Purge Test/Mock Logs'}
                        </button>
                        <button
                          type="button"
                          onClick={fetchWebhookLogs}
                          disabled={webhookLoading}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-brand-deep/50 dark:hover:bg-brand-deep dark:text-slate-200 border border-slate-200 dark:border-brand-teal/15 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${webhookLoading ? 'animate-spin' : ''}`} />
                          Refresh Logs
                        </button>
                      </div>
                    </div>

                    {/* Metric Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-2xl bg-white dark:bg-brand-deep/20 border border-slate-100 dark:border-brand-teal/5 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Total Logged Webhooks</span>
                        <div className="text-xl font-black text-slate-800 dark:text-white font-mono">{webhookLogs.length}</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800/20 space-y-1">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-mono">Verified Success Events</span>
                        <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 font-mono">
                          {webhookLogs.filter(l => (l.paymentStatus || '').toUpperCase() === 'SUCCESS' || (l.paymentStatus || '').toLowerCase() === 'paid').length}
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-800/20 space-y-1">
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider font-mono">Pending / Non-Success Signals</span>
                        <div className="text-xl font-black text-amber-700 dark:text-amber-300 font-mono">
                          {webhookLogs.filter(l => (l.paymentStatus || '').toUpperCase() !== 'SUCCESS' && (l.paymentStatus || '').toLowerCase() !== 'paid').length}
                        </div>
                      </div>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={webhookFilterQuery}
                        onChange={(e) => setWebhookFilterQuery(e.target.value)}
                        placeholder="Search webhooks by Order ID, Cashfree Payment ID, Status, or Gateway..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-800 dark:border-brand-teal/20 dark:bg-brand-deep/50 dark:text-white focus:outline-hidden focus:border-brand-primary"
                      />
                    </div>

                    {/* Display Table */}
                    {(() => {
                      const filteredLogs = webhookLogs.filter(log => {
                        if (!webhookFilterQuery.trim()) return true;
                        const q = webhookFilterQuery.toLowerCase();
                        return (
                          (log.merchantTransactionId || '').toLowerCase().includes(q) ||
                          (log.cfPaymentId || '').toLowerCase().includes(q) ||
                          (log.paymentStatus || '').toLowerCase().includes(q) ||
                          (log.gateway || '').toLowerCase().includes(q) ||
                          (log.eventId || '').toLowerCase().includes(q)
                        );
                      });

                      if (filteredLogs.length === 0) {
                        return (
                          <div className="text-center py-16 bg-slate-50/50 dark:bg-brand-deep/10 border border-dashed border-slate-200 dark:border-brand-teal/15 rounded-3xl space-y-2">
                            <Server className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto" />
                            <h5 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">No Webhook Logs Found</h5>
                            <p className="text-xs text-slate-400 max-w-md mx-auto">
                              Incoming Cashfree or gateway webhook events will appear here in real-time along with their raw JSON payloads for manual debugging.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="bg-white dark:bg-brand-deep/20 rounded-2xl border border-slate-200/80 dark:border-brand-teal/10 overflow-hidden shadow-xs">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 dark:bg-brand-deep/50 border-b border-slate-200/80 dark:border-brand-teal/10 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                                <tr>
                                  <th className="px-4 py-3">Processed At</th>
                                  <th className="px-4 py-3">Order / Txn ID</th>
                                  <th className="px-4 py-3">Gateway Payment ID</th>
                                  <th className="px-4 py-3">Status</th>
                                  <th className="px-4 py-3">Amount</th>
                                  <th className="px-4 py-3 text-right">Raw Payload</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-brand-teal/5 font-mono">
                                {filteredLogs.map((log, idx) => {
                                  const isSuccess = (log.paymentStatus || '').toUpperCase() === 'SUCCESS' || (log.paymentStatus || '').toLowerCase() === 'paid';
                                  const formattedDate = log.processedAt ? new Date(log.processedAt).toLocaleString('en-IN', {
                                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                                  }) : 'N/A';

                                  return (
                                    <tr key={`wh-log-${log.id || log.eventId || idx}-${idx}`} className="hover:bg-slate-50/60 dark:hover:bg-brand-deep/40 transition-colors">
                                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap text-[11px]">
                                        {formattedDate}
                                      </td>
                                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-white whitespace-nowrap">
                                        #{log.merchantTransactionId || log.id}
                                      </td>
                                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap text-[11px]">
                                        {log.cfPaymentId || 'N/A'}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                          isSuccess
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                                        }`}>
                                          {isSuccess ? <Check className="h-3 w-3" /> : <Info className="h-3 w-3" />}
                                          {log.paymentStatus || 'RECORDED'}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-white whitespace-nowrap">
                                        ₹{Number(log.receivedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </td>
                                      <td className="px-4 py-3 text-right whitespace-nowrap">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedPayloadLog(log)}
                                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-brand-deep/60 dark:hover:bg-brand-deep text-slate-700 dark:text-slate-200 text-[10px] font-bold border border-slate-200 dark:border-brand-teal/20 transition-all cursor-pointer flex items-center gap-1 ml-auto"
                                        >
                                          <Eye className="h-3 w-3 text-brand-primary dark:text-brand-accent" />
                                          Inspect Payload
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </>
            )}

          </motion.div>
          
        </div>
      )}

      {/* PRINTABLE THERMAL RECEIPT OVERLAY MODAL */}
      <AnimatePresence>
        {activeReceiptOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs no-print"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200/50 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                  🧾 IN-STORE CUSTOMER RECEIPT
                </span>
                <button
                  type="button"
                  onClick={() => setActiveReceiptOrder(null)}
                  className="p-1 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Thermal Print Area */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-950 flex justify-center">
                <div
                  id="thermal-receipt-print-area"
                  className="bg-white text-slate-950 border border-slate-300 shadow-sm p-6 w-[320px] font-mono text-xs space-y-4"
                  style={{ color: '#000000', backgroundColor: '#ffffff' }}
                >
                  <style dangerouslySetInnerHTML={{__html: `
                    @media print {
                      body * {
                        visibility: hidden !important;
                      }
                      #thermal-receipt-print-area, #thermal-receipt-print-area * {
                        visibility: visible !important;
                      }
                      #thermal-receipt-print-area {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        background: white !important;
                        color: black !important;
                      }
                      .no-print {
                        display: none !important;
                      }
                    }
                  `}} />
                  
                  {/* Logo / Header */}
                  <div className="text-center space-y-1">
                    {logoImg && (
                      <div className="flex justify-center mb-1.5">
                        <img 
                          src={logoImg} 
                          alt="Tumble Spin Logo" 
                          className="h-14 w-auto object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <h2 className="text-base font-extrabold tracking-wider uppercase">TUMBLE SPIN</h2>
                    <p className="text-[10px] uppercase font-bold text-slate-700">Luxe Laundry & Dry Care</p>
                    <p className="text-[9px] text-slate-500 leading-tight">
                      {businessInfo?.address || 'Tumble Spin, #6, 80 feet road, Kengeri Ring Rd, Mariyappana Palya, Bengaluru, Karnataka 560056, India'}
                    </p>
                    <p className="text-[9px] text-slate-700 font-bold">Manager Contact: {businessInfo?.phone || '+91 96060 32491'}</p>
                    <p className="text-[9px] text-slate-500">Email: {businessInfo?.email || 'Prakashcsat@gmail.com'}</p>
                  </div>

                  <div className="border-t border-dashed border-slate-400 my-2"></div>

                  {/* Booking / Receipt details */}
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span>INVOICE:</span>
                      <span className="font-bold">{activeReceiptOrder.orderId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>DATE:</span>
                      <span>{new Date(activeReceiptOrder.createdAt || Date.now()).toLocaleDateString()} {new Date(activeReceiptOrder.createdAt || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CUSTOMER:</span>
                      <span className="font-bold uppercase truncate max-w-[150px]">{activeReceiptOrder.fullName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>PHONE:</span>
                      <span>{activeReceiptOrder.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CARE OPT:</span>
                      <span className="uppercase font-semibold">{activeReceiptOrder.garmentCareOption}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-slate-400 my-2"></div>

                  {/* Items header */}
                  <div className="text-[10px] font-bold grid grid-cols-12 pb-1 border-b border-slate-200">
                    <span className="col-span-6">ITEM / PROGRAM</span>
                    <span className="col-span-2 text-center">QTY</span>
                    <span className="col-span-4 text-right">PRICE (₹)</span>
                  </div>

                  {/* Item Rows */}
                  <div className="space-y-2.5 text-[10px]">
                    {activeReceiptOrder.subServices && activeReceiptOrder.subServices.length > 0 ? (
                      activeReceiptOrder.subServices.map((sub: any, idx: number) => (
                        <div key={`${sub.id || sub.name}-${idx}`} className="grid grid-cols-12 items-start">
                          <div className="col-span-6">
                            <span className="font-bold uppercase block">{sub.name}</span>
                            <span className="text-[8px] text-slate-500 italic block leading-none">{sub.serviceType}</span>
                          </div>
                          <span className="col-span-2 text-center font-bold">{sub.quantity}</span>
                          <span className="col-span-4 text-right font-bold">₹{sub.quantity * sub.price}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between font-bold">
                        <span>Luxe Laundry Treatment</span>
                        <span>₹{activeReceiptOrder.totalPrice}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-dashed border-slate-400 my-2"></div>

                  {/* Totals */}
                  <div className="space-y-1.5 text-[10px] font-bold">
                    <div className="flex justify-between font-normal">
                      <span>SUBTOTAL:</span>
                      <span>₹{activeReceiptOrder.subServices?.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0) || activeReceiptOrder.totalPrice}</span>
                    </div>

                    {activeReceiptOrder.dynamicPricing && activeReceiptOrder.dynamicPricing.mode !== 'none' && activeReceiptOrder.dynamicPricing.percentage > 0 && (
                      <div className="flex justify-between text-[9px] font-semibold">
                        <span className="uppercase text-left">
                          {activeReceiptOrder.dynamicPricing.label || (activeReceiptOrder.dynamicPricing.mode === 'surcharge' ? 'Surcharge' : 'Discount')} ({activeReceiptOrder.dynamicPricing.percentage}%):
                        </span>
                        <span>
                          {activeReceiptOrder.dynamicPricing.mode === 'surcharge' ? '+' : '-'}₹{Math.round(((activeReceiptOrder.subServices?.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0) || activeReceiptOrder.totalPrice) * activeReceiptOrder.dynamicPricing.percentage) / 100)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between border-t border-double border-slate-950 pt-2 text-sm font-black">
                      <span>TOTAL BILL:</span>
                      <span>₹{activeReceiptOrder.totalPrice}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-slate-400 my-2"></div>

                  {/* Dynamic UPI QR Code */}
                  <div className="flex flex-col items-center justify-center p-2.5 border border-slate-300 rounded-lg bg-white space-y-1 my-2">
                    <p className="text-[8px] font-bold text-slate-800 uppercase tracking-widest font-sans">Dynamic UPI QR Code</p>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                        `upi://pay?pa=prakashcsat@oksbi&pn=Tumble%20Spin&am=${Number(activeReceiptOrder.totalPrice).toFixed(2)}&cu=INR&tn=Order_${(activeReceiptOrder.orderId || '').replace(/\s+/g, '_')}&tr=Order_${(activeReceiptOrder.orderId || '').replace(/\s+/g, '_')}`
                      )}`}
                      onError={(e) => {
                        const target = e.currentTarget;
                        const upiIntent = `upi://pay?pa=prakashcsat@oksbi&pn=Tumble%20Spin&am=${Number(activeReceiptOrder.totalPrice).toFixed(2)}&cu=INR&tn=Order_${(activeReceiptOrder.orderId || '').replace(/\s+/g, '_')}&tr=Order_${(activeReceiptOrder.orderId || '').replace(/\s+/g, '_')}`;
                        const alternateUrl = `https://quickchart.io/qr?size=150&text=${encodeURIComponent(upiIntent)}`;
                        if (target.src !== alternateUrl) {
                          target.src = alternateUrl;
                        }
                      }}
                      alt="UPI QR Code"
                      className="h-28 w-28 object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <p className="text-[7px] text-slate-500 font-bold uppercase font-mono tracking-wider">Scan with PhonePe / GPay / Paytm</p>
                    <p className="text-[7px] text-slate-600 font-black uppercase font-mono mt-0.5">VPA: prakashcsat@oksbi</p>
                  </div>

                  <div className="border-t border-dashed border-slate-400 my-2"></div>

                  {/* Footers */}
                  <div className="text-center space-y-1 text-[9px] text-slate-600 font-semibold uppercase">
                    <p>✨ Freshness Restored. Flawless Style. ✨</p>
                    <p className="font-normal text-[8px] leading-tight">Thank you for choosing Tumble Spin.<br />Track your booking status at any time via phone!</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white dark:bg-brand-accent dark:text-brand-deep py-3 text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                >
                  <Printer className="h-4 w-4" />
                  Print Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReceiptOrder(null)}
                  className="px-5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-brand-teal/20 dark:text-slate-300 dark:hover:bg-brand-deep text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* REAL-TIME NEW BOOKING NOTIFICATION POPUP */}
      <AnimatePresence>
        {newBookingAlert && newBookingAlert.visible && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.9 }}
            className="fixed top-6 right-6 z-[250] max-w-sm w-full bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md text-white rounded-2xl border border-brand-accent/30 shadow-2xl overflow-hidden pointer-events-auto"
          >
            <div className="p-5 space-y-3.5 relative">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-accent"></span>
                  </span>
                  <span className="text-[10px] font-mono font-bold tracking-widest text-brand-accent uppercase">
                    Real-Time Booking Alert
                  </span>
                </div>
                <button
                  onClick={() => setNewBookingAlert(null)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-white">
                  {newBookingAlert.customerName}
                </h4>
                <p className="text-xs text-slate-400 font-mono flex items-center gap-1">
                  <span>ID:</span> <span className="text-white font-bold">{newBookingAlert.orderId}</span>
                </p>
                {newBookingAlert.phone && (
                  <p className="text-[10px] text-slate-500 font-mono">
                    Phone: {newBookingAlert.phone}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                <span className="text-slate-400">Total Projection:</span>
                <span className="text-brand-accent font-black text-sm">
                  ₹{newBookingAlert.amount}
                </span>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    const matchedOrder = orders.find(o => o.orderId === newBookingAlert.orderId);
                    if (matchedOrder) {
                      handleSelectOrder(matchedOrder);
                    } else {
                      loadOrders();
                    }
                    setNewBookingAlert(null);
                  }}
                  className="flex-1 py-2 bg-brand-accent text-brand-deep rounded-xl text-[11px] font-black uppercase text-center hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                >
                  View Details
                </button>
                <button
                  onClick={() => setNewBookingAlert(null)}
                  className="px-3 py-2 bg-slate-800 text-slate-300 rounded-xl text-[11px] font-bold uppercase hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RAW WEBHOOK JSON PAYLOAD INSPECTOR MODAL */}
      <AnimatePresence>
        {selectedPayloadLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[85vh] text-white"
            >
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                <span className="text-xs font-bold font-mono text-brand-accent flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  RAW WEBHOOK JSON PAYLOAD INSPECTOR
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPayloadLog(null)}
                  className="p-1 rounded-full text-slate-400 hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 bg-slate-950/60 border-b border-slate-800 text-xs font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Order / Txn ID:</span>
                  <span className="font-bold text-white">#{selectedPayloadLog.merchantTransactionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cashfree Txn ID:</span>
                  <span className="font-bold text-white">{selectedPayloadLog.cfPaymentId || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Processed At:</span>
                  <span className="text-slate-300">{selectedPayloadLog.processedAt}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-slate-950 font-mono text-xs">
                <pre className="text-emerald-400 bg-slate-900 p-4 rounded-xl border border-slate-800 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(selectedPayloadLog.payload || selectedPayloadLog, null, 2)}
                </pre>
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(selectedPayloadLog.payload || selectedPayloadLog, null, 2));
                    setCopiedLogId(selectedPayloadLog.eventId || 'copied');
                    setTimeout(() => setCopiedLogId(null), 2000);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5 text-brand-accent" />
                  {copiedLogId ? 'Copied to Clipboard!' : 'Copy Raw JSON'}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPayloadLog(null)}
                  className="px-5 py-2 rounded-xl bg-brand-accent text-brand-deep text-xs font-bold uppercase transition-all cursor-pointer"
                >
                  Close Inspector
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
