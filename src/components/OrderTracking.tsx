import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, ShieldCheck, MapPin, Calendar, Clock, Phone, 
  Truck, CheckCircle2, RotateCw, Sparkles, MessageSquare, AlertCircle, FileText
} from 'lucide-react';
import { downloadInvoice } from '../utils/invoiceGenerator';
import { useBusinessInfo } from '../utils/useBusinessInfo';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface TrackingStatus {
  step: number;
  title: string;
  desc: string;
  time: string;
  done: boolean;
  active: boolean;
}

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
  timeline: TrackingStatus[];
  createdAt: string;
  isMock?: boolean;
}

export default function OrderTracking() {
  const businessInfo = useBusinessInfo();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedOrder, setSearchedOrder] = useState<OrderData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [allOrders, setAllOrders] = useState<OrderData[]>([]);

  // Load current admin profile from localStorage (defaults to Jayanth)
  const [adminProfile, setAdminProfile] = useState(() => {
    const saved = localStorage.getItem('tumblespin_admin_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {}
    }
    return { name: 'Prakash Chandra S', email: 'Prakashcsat@gmail.com', phone: '9606032491' };
  });

  // Seed default orders in localStorage if none exist, so there is real seed data to test with out of the box
  const getOrdersFromStorage = (): OrderData[] => {
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
        
        // Deduplicate orders by orderId before further processing
        const uniqueMap = new Map<string, OrderData>();
        filteredFromDeleted.forEach(o => {
          if (o && o.orderId) {
            if (!uniqueMap.has(o.orderId)) {
              uniqueMap.set(o.orderId, o);
            } else {
              const existing = uniqueMap.get(o.orderId)!;
              const timeExisting = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;
              const timeCurrent = o.createdAt ? new Date(o.createdAt).getTime() : 0;
              if (timeCurrent > timeExisting) {
                uniqueMap.set(o.orderId, o);
              }
            }
          }
        });
        const deduplicated = Array.from(uniqueMap.values());

        const hasRealOrders = deduplicated.some(o => !o.isMock);
        if (hasRealOrders) {
          // Filter out and permanently purge mock orders from storage
          const realOnly = deduplicated.filter(o => !o.isMock);
          if (realOnly.length !== deduplicated.length) {
            localStorage.setItem('tumblespin_orders', JSON.stringify(realOnly));
            return realOnly;
          }
        }
        return deduplicated;
      } catch (err) {
        console.error(err);
        return [];
      }
    }
    
    // Seed default orders with 'isMock: true' tag
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
        status: 'In-Facility Fabric Screening',
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
    return initialSeed;
  };

  // Load all orders on mount
  useEffect(() => {
    const list = getOrdersFromStorage();
    setAllOrders(list);

    // Listen to local storage changes to keep state reactively updated (e.g. if updated via Admin panel)
    const handleStorageChange = () => {
      const updated = getOrdersFromStorage();
      setAllOrders(updated);
      
      // If we currently have a searched order, refresh its state from storage
      if (searchedOrder) {
        const refreshed = updated.find(o => o.orderId === searchedOrder.orderId);
        if (refreshed) {
          setSearchedOrder(refreshed);
        }
      }

      // Also reload current admin profile dynamically
      const savedAdmin = localStorage.getItem('tumblespin_admin_profile');
      if (savedAdmin) {
        try {
          setAdminProfile(JSON.parse(savedAdmin));
        } catch (err) {}
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [searchedOrder]);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSearchedOrder(null);
    
    const queryStr = searchQuery.trim().toUpperCase();
    if (!queryStr) {
      setErrorMsg('Please enter an Order ID or 10-digit Phone Number.');
      return;
    }

    setIsSearching(true);

    try {
      const ordersList = getOrdersFromStorage();
      
      // 1. Look for match in actual bookings list locally first (either ID match or Phone match)
      const exactMatch = ordersList.find(o => o.orderId.toUpperCase() === queryStr);
      if (exactMatch) {
        setSearchedOrder(exactMatch);
        setIsSearching(false);
        return;
      }

      // Try finding by phone locally
      const cleanedQueryPhone = queryStr.replace(/\D/g, '');
      const phoneMatch = ordersList.find(o => o.phone.replace(/\D/g, '').endsWith(cleanedQueryPhone) && cleanedQueryPhone.length >= 6);
      if (phoneMatch) {
        setSearchedOrder(phoneMatch);
        setIsSearching(false);
        return;
      }

      // 2. Query Firestore directly for the specific order (secure, no database dump)
      const saveMatchedOrderToStorage = (matchedOrder: OrderData) => {
        try {
          const localStr = localStorage.getItem('tumblespin_orders') || '[]';
          let localArr = JSON.parse(localStr);
          if (!Array.isArray(localArr)) localArr = [];
          localArr = localArr.filter((o: any) => o && o.orderId !== matchedOrder.orderId);
          localArr.unshift(matchedOrder);
          localStorage.setItem('tumblespin_orders', JSON.stringify(localArr));
          window.dispatchEvent(new Event('storage'));
        } catch (e) {}
      };

      // Query by order doc id
      const orderDocRef = doc(db, 'orders', queryStr);
      const orderDocSnap = await getDoc(orderDocRef);
      if (orderDocSnap.exists()) {
        const foundData = orderDocSnap.data() as OrderData;
        saveMatchedOrderToStorage(foundData);
        setSearchedOrder(foundData);
        setIsSearching(false);
        return;
      }

      // Query by phone field in Firestore
      if (cleanedQueryPhone.length >= 6) {
        const q = query(collection(db, 'orders'), where('phone', '==', cleanedQueryPhone));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          const matchedOrders = qSnap.docs.map(d => d.data() as OrderData);
          matchedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const foundData = matchedOrders[0];
          saveMatchedOrderToStorage(foundData);
          setSearchedOrder(foundData);
          setIsSearching(false);
          return;
        }
      }

      // Try matching by phone formatted or unformatted in database
      const qAll = query(collection(db, 'orders'));
      const qAllSnap = await getDocs(qAll);
      const dbMatch = qAllSnap.docs.map(d => d.data() as OrderData).find(o => 
        o.orderId.toUpperCase() === queryStr || 
        (cleanedQueryPhone.length >= 6 && o.phone.replace(/\D/g, '').endsWith(cleanedQueryPhone))
      );

      if (dbMatch) {
        saveMatchedOrderToStorage(dbMatch);
        setSearchedOrder(dbMatch);
        setIsSearching(false);
        return;
      }

      setErrorMsg(`No active order found for "${searchQuery}". Please verify your Order ID (e.g. TS-2026-101) or Phone.`);
    } catch (fsErr) {
      console.warn('Firestore tracking fetch error:', fsErr);
      setErrorMsg('Network or database connection error. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Calculate percentage based on status
  const getProgressPercentage = (status: string) => {
    switch (status) {
      case 'Order Confirmed': return 20;
      case 'Valet Pickup Completed': return 40;
      case 'At Laundry Facility': return 55;
      case 'In-Facility Fabric Screening': return 70;
      case 'Quality Pressed & Inspected': return 85;
      case 'Out for Valet Delivery': return 95;
      case 'Returned Flawless': return 100;
      default: return 20;
    }
  };

  return (
    <section className="py-22 bg-white dark:bg-brand-dark" id="order-tracking">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        
        {/* Banner Card */}
        <div className="relative rounded-3xl bg-linear-to-br from-brand-teal/10 via-brand-primary/5 to-transparent dark:from-brand-teal/20 dark:via-brand-deep/40 dark:to-brand-dark/20 p-8 sm:p-12 border border-brand-primary/5 dark:border-brand-teal/10 shadow-xs overflow-hidden">
          
          <div className="absolute top-0 right-0 p-8 opacity-5 dark:opacity-10 pointer-events-none">
            <Truck className="h-40 w-40 text-brand-primary dark:text-brand-accent" />
          </div>

          <div className="max-w-2xl space-y-6 relative z-10">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary/10 dark:bg-brand-accent/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-brand-primary uppercase dark:text-brand-accent font-mono">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              Live Order Tracker
            </div>
            
            <h2 className="text-3xl font-serif text-slate-900 dark:text-white font-medium tracking-tight">
              Where are your garments right now?
            </h2>
            
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Track your laundry or premium dry cleaning status in real-time. Enter your booking <strong className="text-brand-primary dark:text-brand-accent">Order ID (e.g., TS-2026-101)</strong> or registered <strong className="text-brand-primary dark:text-brand-accent">Mobile Number ({businessInfo.phone})</strong>.
            </p>

            {/* Input Search Form */}
            <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-3 max-w-lg">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter Order ID or Registered Mobile..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-full border border-slate-200 bg-white/90 py-3.5 pl-11 pr-5 text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-brand-primary focus:ring-1 focus:ring-brand-primary dark:border-brand-teal/20 dark:bg-brand-deep/80 dark:text-white dark:focus:border-brand-accent"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="rounded-full bg-brand-primary px-8 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-brand-deep hover:-translate-y-0.5 active:translate-y-0 transition-all dark:bg-brand-accent dark:text-brand-deep dark:hover:bg-white flex items-center justify-center gap-2"
              >
                {isSearching ? (
                  <>
                    <RotateCw className="h-4 w-4 animate-spin" />
                    Locating Wardrobe...
                  </>
                ) : (
                  'Locate Wardrobe'
                )}
              </button>
            </form>

            {errorMsg && (
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-500 dark:text-rose-400 mt-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Search Result Presentation */}
          <AnimatePresence mode="wait">
            {searchedOrder && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 120 }}
                className="mt-10 bg-white dark:bg-brand-dark/95 rounded-2xl p-6 sm:p-8 border border-slate-100 dark:border-brand-teal/15 shadow-md space-y-6"
                id="search-result-panel"
              >
                {/* Meta details */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-100 dark:border-brand-teal/10">
                  <div>
                    <span className="text-[10px] font-bold text-brand-primary dark:text-brand-accent uppercase tracking-widest font-mono">
                      Active Booking
                    </span>
                    <h3 className="text-xl font-serif font-bold text-slate-800 dark:text-white mt-1">
                      ID: {searchedOrder.orderId}
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="bg-slate-50 dark:bg-brand-deep/40 px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300">
                      Owner: {searchedOrder.fullName}
                    </span>
                    <span className="bg-brand-primary/5 dark:bg-brand-accent/5 px-3 py-1.5 rounded-lg text-brand-primary dark:text-brand-accent">
                      Status: {searchedOrder.status}
                    </span>
                  </div>
                </div>

                {/* Visual Progress Bar and Milestones */}
                <div className="space-y-6 bg-slate-50/50 dark:bg-brand-deep/20 p-5 rounded-2xl border border-slate-100 dark:border-brand-teal/5">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">
                        Journey Tracking
                      </h4>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-300 mt-1">
                        Current Milestone: <span className="text-brand-primary dark:text-brand-accent">{searchedOrder.status}</span>
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold bg-brand-primary/10 text-brand-primary dark:bg-brand-accent/15 dark:text-brand-accent px-2.5 py-1 rounded-md">
                      {getProgressPercentage(searchedOrder.status)}% Completed
                    </span>
                  </div>

                  {/* The visual progress bar line */}
                  <div className="relative pt-2">
                    <div className="h-2.5 w-full bg-slate-200 dark:bg-brand-dark rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${getProgressPercentage(searchedOrder.status)}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-brand-teal via-brand-primary to-emerald-500 dark:from-brand-accent dark:via-white dark:to-emerald-400 rounded-full"
                      />
                    </div>
                  </div>

                  {/* Horizontal Milestone Nodes */}
                  <div className="grid grid-cols-5 gap-2 pt-2">
                    {[
                      { 
                        id: 1, 
                        label: 'Order Confirmed', 
                        desc: 'Received & verified', 
                        isDone: getProgressPercentage(searchedOrder.status) >= 20,
                        isActive: searchedOrder.status === 'Order Confirmed',
                        icon: '📝',
                        fallbackTime: searchedOrder.timeline[0]?.time || 'Confirmed'
                      },
                      { 
                        id: 2, 
                        label: 'Picked up', 
                        desc: 'Garments collected', 
                        isDone: getProgressPercentage(searchedOrder.status) >= 40,
                        isActive: searchedOrder.status === 'Valet Pickup Completed',
                        icon: '🧺',
                        fallbackTime: searchedOrder.timeline[1]?.done ? (searchedOrder.timeline[1]?.time || 'Completed') : 'Pending'
                      },
                      { 
                        id: 3, 
                        label: 'In-process', 
                        desc: 'Fabric treatment', 
                        isDone: getProgressPercentage(searchedOrder.status) >= 70,
                        isActive: searchedOrder.status === 'In-Facility Fabric Screening' || searchedOrder.status === 'At Laundry Facility',
                        icon: '🌀',
                        fallbackTime: searchedOrder.timeline[2]?.done ? (searchedOrder.timeline[2]?.time || 'Active') : 'Pending'
                      },
                      { 
                        id: 4, 
                        label: 'Out for delivery', 
                        desc: 'Dispatching to you', 
                        isDone: getProgressPercentage(searchedOrder.status) >= 95,
                        isActive: searchedOrder.status === 'Out for Valet Delivery',
                        icon: '🚚',
                        fallbackTime: searchedOrder.timeline[3]?.done ? (searchedOrder.timeline[3]?.time || 'Pending') : 'Pending'
                      },
                      { 
                        id: 5, 
                        label: 'Returned Flawless', 
                        desc: 'Delivered safely', 
                        isDone: getProgressPercentage(searchedOrder.status) >= 100,
                        isActive: searchedOrder.status === 'Returned Flawless',
                        icon: '✨',
                        fallbackTime: searchedOrder.timeline[4]?.done ? (searchedOrder.timeline[4]?.time || 'Pending') : 'Pending'
                      }
                    ].map((node) => {
                      return (
                        <div key={`track-node-${node.id}`} className="flex flex-col items-center text-center space-y-1.5">
                          {/* Circle indicator */}
                          <div className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                            node.isDone
                              ? 'bg-brand-primary dark:bg-brand-accent text-white dark:text-brand-deep border-brand-primary dark:border-brand-accent shadow-xs'
                              : 'bg-white dark:bg-brand-dark border-slate-200 dark:border-slate-800 text-slate-400'
                          } ${node.isActive ? 'ring-4 ring-brand-primary/20 dark:ring-brand-accent/20 scale-105' : ''}`}>
                            <span className="text-sm">{node.icon}</span>
                            {node.isDone && !node.isActive && (
                              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-white border border-white">
                                ✓
                              </span>
                            )}
                          </div>
                          {/* Label */}
                          <div className="space-y-0.5">
                            <p className={`text-[10px] font-extrabold leading-tight ${
                              node.isActive 
                                ? 'text-brand-primary dark:text-brand-accent' 
                                : node.isDone 
                                  ? 'text-slate-800 dark:text-slate-200' 
                                  : 'text-slate-400 dark:text-slate-500'
                            }`}>
                              {node.label}
                            </p>
                            <p className="text-[8px] text-slate-400 hidden sm:block">
                              {node.desc}
                            </p>
                            <p className={`text-[8px] font-mono leading-none ${node.isDone && node.fallbackTime !== 'Pending' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`}>
                              {node.fallbackTime}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Grid layout: Steps and Valet Details */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start pt-2">
                  
                  {/* Timeline Steps */}
                  <div className="md:col-span-8 space-y-6">
                    <h4 className="text-xs font-bold tracking-widest text-slate-400 uppercase font-mono mb-4">
                      Care Facility Milestones
                    </h4>

                    <div className="relative border-l-2 border-slate-100 dark:border-brand-teal/10 ml-3 pl-6 space-y-6">
                      {searchedOrder.timeline && searchedOrder.timeline.map((step, idx) => (
                        <div key={`${step.step || idx}-${step.title || 'step'}-${idx}`} className="relative">
                          {/* Dot indicator */}
                          <span className={`absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                            step.done 
                              ? 'bg-brand-primary border-brand-primary dark:bg-brand-accent dark:border-brand-accent' 
                              : 'bg-white border-slate-200 dark:bg-brand-dark dark:border-brand-teal/20'
                          }`}>
                            {step.done && <span className="h-1.5 w-1.5 rounded-full bg-white dark:bg-brand-deep" />}
                          </span>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h5 className={`text-sm font-semibold ${
                                step.active 
                                  ? 'text-brand-primary dark:text-brand-accent' 
                                  : step.done 
                                    ? 'text-slate-700 dark:text-slate-300' 
                                    : 'text-slate-400 dark:text-slate-500'
                              }`}>
                                {step.title}
                              </h5>
                              {step.active && (
                                <span className="text-[9px] font-bold text-white bg-brand-primary dark:bg-brand-accent dark:text-brand-deep px-1.5 py-0.5 rounded-sm animate-pulse uppercase">
                                  Live Now
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              {step.desc}
                            </p>
                            <span className="block text-[10px] font-mono text-slate-400 dark:text-slate-500">
                              {step.time}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right hand panel: stacked Valet and Supervisor cards */}
                  <div className="md:col-span-4 space-y-4">
                    {/* Valet Dispatch info card */}
                    <div className="bg-slate-50/50 dark:bg-brand-deep/20 rounded-2xl p-5 border border-slate-100 dark:border-brand-teal/5 space-y-4">
                      <h4 className="text-xs font-bold tracking-widest text-slate-400 uppercase font-mono">
                        Valet Concierge
                      </h4>

                      <div className="space-y-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-full bg-brand-primary/10 dark:bg-brand-accent/15 flex items-center justify-center text-brand-primary dark:text-brand-accent text-sm font-bold">
                            {searchedOrder.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-white">{searchedOrder.fullName}</p>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">Scheduled Valet</span>
                          </div>
                        </div>

                        <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-brand-teal/10">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-brand-secondary shrink-0" />
                            <span>Delivery: {searchedOrder.deliveryDate} @ {searchedOrder.deliveryTimeSlot}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-brand-secondary shrink-0 animate-bounce" />
                            <span className="truncate max-w-[180px]" title={searchedOrder.address}>{searchedOrder.address}</span>
                          </div>
                        </div>

                        {/* Item details */}
                        <div className="pt-2.5 border-t border-slate-100 dark:border-brand-teal/10">
                          <p className="text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider">Garments Vetted</p>
                          <div className="space-y-1.5 mt-1.5">
                            {searchedOrder.subServices && searchedOrder.subServices.map((sub, sidx) => (
                              <div key={`${sub.id || sub.name}-${sidx}`} className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                                <span>{sub.name} (x{sub.quantity})</span>
                                <span className="font-mono text-[10px]">₹{sub.price * sub.quantity}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between items-baseline pt-2 border-t border-dotted border-slate-200 mt-2 text-xs font-bold">
                            <span>Total Invoice:</span>
                            <span className="font-mono text-brand-primary dark:text-brand-accent">₹{searchedOrder.totalPrice}</span>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <a
                            href={`tel:+91${businessInfo.phone}`}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 py-2 text-[10px] font-bold uppercase tracking-wider dark:bg-brand-deep dark:border-brand-teal/20 dark:text-slate-300 dark:hover:text-white transition-colors"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            Call Valet
                          </a>
                          <a
                            href={`https://wa.me/91${businessInfo.phone}?text=${encodeURIComponent(`Hi, tracking order ID ${searchedOrder.orderId}`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] text-white py-2 text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
                          >
                            <MessageSquare className="h-3.5 w-3.5 fill-current" />
                            WhatsApp
                          </a>
                        </div>

                        <button
                          onClick={() => downloadInvoice(searchedOrder)}
                          type="button"
                          className="w-full flex items-center justify-center gap-2 rounded-lg border border-brand-primary text-brand-primary dark:border-brand-accent dark:text-brand-accent py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-brand-primary/10 dark:hover:bg-brand-accent/10 transition-colors mt-2.5"
                          id="track-download-invoice-btn"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Download Invoice (PDF)
                        </button>
                      </div>
                    </div>

                    {/* Care Facility Supervisor Oversight Card (prakash or modified admin) */}
                    <div className="bg-brand-primary/[0.02] dark:bg-brand-accent/[0.02] border border-brand-primary/10 dark:border-brand-accent/15 rounded-2xl p-5 space-y-3" id="admin-oversight-tracking-card">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-full bg-brand-primary/10 dark:bg-brand-accent/15 flex items-center justify-center text-brand-primary dark:text-brand-accent text-xs font-extrabold uppercase">
                          {adminProfile.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wide">
                            Care Facility Supervisor
                          </h4>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            Directly supervised by active administrator
                          </p>
                        </div>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-brand-teal/5 flex flex-col gap-2 text-[11px] text-slate-600 dark:text-slate-300 font-sans">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-bold">Active Manager:</span>
                          <span className="font-extrabold text-slate-800 dark:text-white">{adminProfile.name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-bold">Manager Email:</span>
                          <span className="font-semibold">{adminProfile.email}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-bold">Facility Phone:</span>
                          <span className="font-mono">{adminProfile.phone}</span>
                        </div>
                        <div className="mt-1.5 pt-2 border-t border-slate-100 dark:border-brand-teal/5 text-center">
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-brand-teal dark:text-brand-accent uppercase bg-brand-teal/5 dark:bg-brand-accent/5 px-2 py-0.5 rounded-full">
                            ✨ Custody & Process Supervision: {adminProfile.name}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>
    </section>
  );
}
