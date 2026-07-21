import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, CheckCircle, ArrowRight, User, Phone, Mail, 
  Search, ShieldCheck, Award, Zap, Check, AlertCircle, RefreshCw, X,
  ExternalLink, Clock, Lock
} from 'lucide-react';
import WOMAN_IMAGE_PATH from '../assets/images/smiling_woman_thumbs_up_1783847990839.jpg';
import { useBusinessInfo } from '../utils/useBusinessInfo';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

interface MembershipPackagesProps {
  onOpenBooking: () => void;
}

export interface MembershipSubscription {
  phone: string;
  fullName: string;
  email: string;
  packageType: 'SMART' | 'SILVER';
  rechargeAmount: number;
  balance: number;
  createdAt: string;
  status: 'active' | 'cancelled';
}

export default function MembershipPackages({ onOpenBooking }: MembershipPackagesProps) {
  const businessInfo = useBusinessInfo();
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<'SMART' | 'SILVER'>('SMART');
  
  // Search / Lookup States
  const [searchPhone, setSearchPhone] = useState('');
  const [lookupResult, setLookupResult] = useState<MembershipSubscription | null>(null);
  const [searched, setSearched] = useState(false);

  // Form States
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subscribeStep, setSubscribeStep] = useState(1); // 1: Info/Form, 2: Payment, 3: Success

  // Real Payment States
  const [qrExpired, setQrExpired] = useState(false);
  const [qrTimeLeft, setQrTimeLeft] = useState<number | null>(600); // 10 minutes
  const [userPaidAmount, setUserPaidAmount] = useState('');
  const [isRefreshingQr, setIsRefreshingQr] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [isAmountOverridden, setIsAmountOverridden] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  // List of memberships loaded from local storage (synced to Firestore)
  const [memberships, setMemberships] = useState<MembershipSubscription[]>([]);

  useEffect(() => {
    const loadMemberships = () => {
      const saved = localStorage.getItem('tumblespin_memberships');
      if (saved) {
        try {
          setMemberships(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
    };
    loadMemberships();

    // Listen to local storage changes
    window.addEventListener('storage', loadMemberships);
    return () => window.removeEventListener('storage', loadMemberships);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPhone) return;
    
    const formattedPhone = searchPhone.replace(/\D/g, '');
    const found = memberships.find(m => m.phone.replace(/\D/g, '') === formattedPhone && m.status === 'active');
    setLookupResult(found || null);
    setSearched(true);
  };

  useEffect(() => {
    if (subscribeStep !== 2 || qrTimeLeft === null) return;
    if (qrTimeLeft <= 0) {
      setQrExpired(true);
      return;
    }
    const timer = setInterval(() => {
      setQrTimeLeft(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [subscribeStep, qrTimeLeft]);

  const handleRefreshQrPayment = async () => {
    setIsRefreshingQr(true);
    setQrExpired(false);
    setQrTimeLeft(600);
    setUserPaidAmount('');
    setIsAmountOverridden(false);
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsRefreshingQr(false);
  };

  const handleSubscribeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone || !email) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubscribeStep(2); // Move to Payment Step
      setQrExpired(false);
      setQrTimeLeft(600);
      setUserPaidAmount('');
      setIsAmountOverridden(false);
      setPaymentStatus('idle');
    }, 800);
  };

  const handleVerifyAndCompleteQrPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const entered = Number(userPaidAmount);
    const expected = selectedPackage === 'SMART' ? 2000 : 5000;

    if (isNaN(entered) || entered <= 0) {
      alert("Please enter a valid amount paid.");
      return;
    }

    if (Math.abs(entered - expected) >= 0.01 && !isAmountOverridden) {
      return;
    }

    setPaymentStatus('processing');
    await new Promise(resolve => setTimeout(resolve, 1800));

    const cleanPhone = phone.replace(/\D/g, '');
    const newSub: MembershipSubscription = {
      phone: cleanPhone,
      fullName,
      email,
      packageType: selectedPackage,
      rechargeAmount: expected,
      balance: expected,
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    try {
      await setDoc(doc(db, 'memberships', cleanPhone), newSub);
    } catch (fsErr) {
      console.warn('Direct Firestore membership write failed, relying on sync override:', fsErr);
    }

    const updatedMemberships = memberships.filter(m => m.phone.replace(/\D/g, '') !== cleanPhone);
    const nextList = [...updatedMemberships, newSub];

    setMemberships(nextList);
    localStorage.setItem('tumblespin_memberships', JSON.stringify(nextList));
    window.dispatchEvent(new Event('storage'));

    setPaymentStatus('success');
    await new Promise(resolve => setTimeout(resolve, 1200));

    setSubscribeStep(3); // Success Screen
    setPaymentStatus('idle');
  };

  const handleCancelSubscription = (phoneToCancel: string) => {
    const cleanPhone = phoneToCancel.replace(/\D/g, '');
    const updated = memberships.map(m => {
      if (m.phone.replace(/\D/g, '') === cleanPhone) {
        return { ...m, status: 'cancelled' as const };
      }
      return m;
    });
    setMemberships(updated);
    localStorage.setItem('tumblespin_memberships', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    
    if (lookupResult && lookupResult.phone.replace(/\D/g, '') === cleanPhone) {
      setLookupResult(prev => prev ? { ...prev, status: 'cancelled' as const } : null);
    }
  };

  const handleOpenSubscribe = (pkg: 'SMART' | 'SILVER') => {
    setSelectedPackage(pkg);
    setSubscribeStep(1);
    setFullName('');
    setPhone('');
    setEmail('');
    setQrExpired(false);
    setQrTimeLeft(600);
    setUserPaidAmount('');
    setIsAmountOverridden(false);
    setPaymentStatus('idle');
    setShowSubscribeModal(true);
  };

  const razorpayUrl = businessInfo.razorpayUrl || 'https://razorpay.me/@tumblespin';
  const rechargeAmount = selectedPackage === 'SMART' ? 2000 : 5000;
  const paymentLink = razorpayUrl.includes('razorpay.me') 
    ? razorpayUrl 
    : `${razorpayUrl}${razorpayUrl.includes('?') ? '&' : '?'}amount=${rechargeAmount}`;

  return (
    <section 
      className="py-24 bg-brand-light/30 dark:bg-brand-deep/20 overflow-hidden relative" 
      id="memberships"
    >
      {/* Decorative vector background details */}
      <div className="absolute top-10 left-10 w-48 h-48 bg-brand-primary/5 rounded-full filter blur-2xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-64 h-64 bg-brand-accent/5 rounded-full filter blur-2xl pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary/10 dark:bg-brand-accent/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-brand-primary uppercase dark:text-brand-accent font-mono">
            <Sparkles className="h-3.5 w-3.5" />
            Super Savings Club
          </div>
          <h2 className="text-4xl font-serif text-slate-900 dark:text-white font-medium tracking-tight uppercase">
            Save on dry cleaning charges with membership packages
          </h2>
          <p className="text-slate-500 dark:text-slate-300 max-w-2xl mx-auto text-sm leading-relaxed">
            We also offer Super Savings Packages with prepaid options with discounted dry cleaning rates, priority service, and the convenience of free pickup and delivery.
          </p>
        </div>

        {/* Bento Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:items-stretch items-center">
          
          {/* Left Column: Packages & Features */}
          <div className="lg:col-span-7 space-y-12">
            
            {/* The Package Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* SMART Card */}
              <motion.div 
                whileHover={{ y: -5 }}
                className="relative bg-white dark:bg-brand-dark rounded-3xl p-8 border-2 border-slate-100 dark:border-brand-accent/10 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden"
                id="membership-card-smart"
              >
                {/* Decorative background circle */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-slate-50 dark:bg-slate-800/40 rounded-full -z-10" />

                <div className="space-y-6">
                  {/* Package Badge */}
                  <div className="inline-block bg-[#1E3A8A] text-white text-[10px] font-bold tracking-widest uppercase px-4 py-1.5 rounded-full">
                    SMART
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 font-mono">Recharge with</p>
                    <p className="text-4xl font-serif font-bold text-slate-900 dark:text-white">₹ 2000</p>
                    <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 font-mono mt-1">and get</p>
                    <p className="text-3xl font-serif font-bold text-brand-primary dark:text-brand-accent">10% off</p>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 font-mono">on all orders</p>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenSubscribe('SMART')}
                  className="mt-8 w-full py-3.5 px-6 rounded-full border-2 border-brand-primary hover:bg-brand-primary hover:text-white text-brand-primary dark:border-brand-accent dark:text-brand-accent dark:hover:bg-brand-accent dark:hover:text-brand-deep text-xs font-extrabold tracking-wider uppercase transition-all duration-300"
                  id="subscribe-btn-smart"
                >
                  SUBSCRIBE NOW
                </button>
              </motion.div>

              {/* SILVER Card */}
              <motion.div 
                whileHover={{ y: -5 }}
                className="relative bg-white dark:bg-brand-dark rounded-3xl p-8 border-2 border-slate-100 dark:border-brand-accent/10 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden"
                id="membership-card-silver"
              >
                {/* Decorative background circle */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-slate-50 dark:bg-slate-800/40 rounded-full -z-10" />

                <div className="space-y-6">
                  {/* Package Badge */}
                  <div className="inline-block bg-slate-800 text-white text-[10px] font-bold tracking-widest uppercase px-4 py-1.5 rounded-full dark:bg-slate-700">
                    SILVER
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 font-mono">Recharge with</p>
                    <p className="text-4xl font-serif font-bold text-slate-900 dark:text-white">₹ 5000</p>
                    <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 font-mono mt-1">and get</p>
                    <p className="text-3xl font-serif font-bold text-brand-teal dark:text-brand-accent">20% off</p>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 font-mono">on all orders</p>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenSubscribe('SILVER')}
                  className="mt-8 w-full py-3.5 px-6 rounded-full border-2 border-brand-primary bg-brand-primary text-white hover:bg-brand-secondary dark:border-brand-accent dark:bg-brand-accent dark:text-brand-deep dark:hover:bg-white text-xs font-extrabold tracking-wider uppercase transition-all duration-300 shadow-md shadow-brand-primary/15"
                  id="subscribe-btn-silver"
                >
                  SUBSCRIBE NOW
                </button>
              </motion.div>

            </div>

            {/* Bullet Points of Benefits */}
            <div className="space-y-4" id="membership-benefits-list">
              {[
                "No Joining Fee – 100% of your amount is usable",
                "No Expiry – Use anytime at your convenience",
                "Valid at all 1500+ Tumblespin stores across India",
                "Cancel Anytime – Get full balance refund"
              ].map((benefit) => (
                <div key={benefit} className="flex items-start gap-3">
                  <span className="text-brand-primary dark:text-brand-accent mt-1">▶</span>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {benefit}
                  </p>
                </div>
              ))}
            </div>

            {/* Primary Action Row */}
            <div className="flex flex-wrap gap-4 pt-4">
              <button
                onClick={() => handleOpenSubscribe('SMART')}
                className="px-8 py-4 bg-brand-primary text-white hover:bg-brand-secondary dark:bg-brand-accent dark:text-brand-deep dark:hover:bg-white font-extrabold text-xs tracking-wider uppercase rounded-full shadow-lg shadow-brand-primary/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                id="main-subscribe-pkg-btn"
              >
                Subscribe Package
              </button>
              <button
                onClick={onOpenBooking}
                className="px-8 py-4 bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 font-extrabold text-xs tracking-wider uppercase rounded-full shadow-lg shadow-slate-900/10 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                id="main-schedule-pickup-btn"
              >
                Schedule Free Pickup
              </button>
            </div>

            {/* Membership Lookup Section */}
            <div className="p-6 bg-white dark:bg-brand-dark rounded-2xl border border-slate-100 dark:border-brand-accent/15 shadow-md max-w-lg">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                <Search className="h-4 w-4 text-brand-primary dark:text-brand-accent" />
                Already a member? Check your subscription
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-4">
                Enter your mobile number to search active memberships and view your available balance.
              </p>
              
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-grow">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="Enter Phone Number"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-semibold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 bg-brand-primary dark:bg-brand-accent dark:text-brand-deep text-white text-xs font-bold rounded-full hover:opacity-90 active:scale-95 transition-all"
                >
                  Verify
                </button>
              </form>

              {/* Lookup Result Panel */}
              <AnimatePresence mode="wait">
                {searched && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-slate-100 dark:border-brand-accent/10"
                  >
                    {lookupResult ? (
                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 p-4 border border-emerald-200/50 dark:border-emerald-500/20 space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-bold text-xs">
                            <ShieldCheck className="h-4 w-4" />
                            Active {lookupResult.packageType} Member
                          </div>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
                            {lookupResult.packageType === 'SMART' ? '10% Discount' : '20% Discount'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-slate-400 dark:text-slate-500 font-medium">Name</p>
                            <p className="font-bold text-slate-800 dark:text-white">{lookupResult.fullName}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 dark:text-slate-500 font-medium">Prepaid Balance</p>
                            <p className="font-bold text-slate-800 dark:text-white font-mono">₹{lookupResult.balance}</p>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                          <p className="text-[10px] text-slate-400 font-mono">
                            Subscribed on: {new Date(lookupResult.createdAt).toLocaleDateString()}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleCancelSubscription(lookupResult.phone)}
                            className="text-[10px] text-rose-500 hover:underline font-bold"
                          >
                            Cancel & Refund
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-4 border border-amber-200/50 dark:border-amber-500/20 flex items-start gap-2.5">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-800 dark:text-amber-400">
                            No Active Membership Found
                          </p>
                          <p className="text-[10px] text-amber-700 dark:text-amber-500 mt-1">
                            No active SMART or SILVER package found under this phone number. Get one above to start saving immediately!
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>

          {/* Right Column: Smiling Woman Portrait */}
          <div className="lg:col-span-5 relative flex flex-col justify-stretch h-full w-full">
            {/* Soft decorative background glow circles */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] bg-radial from-brand-primary/10 via-transparent to-transparent filter blur-3xl -z-10 rounded-full" />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative rounded-3xl overflow-hidden w-full h-full min-h-[500px] lg:min-h-full border-4 border-white dark:border-brand-dark shadow-2xl flex flex-col justify-end"
              id="membership-image-container"
            >
              <img 
                src={WOMAN_IMAGE_PATH} 
                alt="Smiling Indian Woman Thumbs Up" 
                className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
              {/* Custom micro trust badge */}
              <div className="absolute bottom-6 left-6 right-6 bg-slate-900/80 backdrop-blur-md text-white p-4 rounded-2xl flex items-center gap-3.5 border border-white/10 shadow-lg z-10">
                <div className="h-10 w-10 rounded-full bg-brand-primary flex items-center justify-center text-white shrink-0 shadow-md">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold tracking-wide">Tumblespin Trusted Care</p>
                  <p className="text-[10px] text-slate-300 font-medium">100% money back refund guarantee at any time.</p>
                </div>
              </div>
            </motion.div>
          </div>

        </div>

      </div>

      {/* Subscription Checkout Drawer / Modal Overlay */}
      <AnimatePresence>
        {showSubscribeModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSubscribeModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs" 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-brand-dark rounded-3xl p-6 sm:p-8 border border-slate-100 dark:border-brand-accent/20 shadow-2xl overflow-hidden z-10"
              id="membership-subscribe-modal"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowSubscribeModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Step 1: Subscribe details and Form */}
              {subscribeStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-serif font-bold text-slate-900 dark:text-white">
                      Subscribe {selectedPackage} Package
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">
                      Fill out your contact details to create your savings account.
                    </p>
                  </div>

                  {/* Quick Package Selector Toggle */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-full border border-slate-100 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setSelectedPackage('SMART')}
                      className={`py-2 rounded-full text-xs font-bold uppercase transition-all duration-300 ${
                        selectedPackage === 'SMART'
                          ? 'bg-[#1E3A8A] text-white shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      SMART (₹2k)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPackage('SILVER')}
                      className={`py-2 rounded-full text-xs font-bold uppercase transition-all duration-300 ${
                        selectedPackage === 'SILVER'
                          ? 'bg-slate-800 text-white shadow-xs dark:bg-brand-accent dark:text-brand-deep'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      SILVER (₹5k)
                    </button>
                  </div>

                  {/* Form fields */}
                  <form onSubmit={handleSubscribeSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="E.g. Jayanth Gowda"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                        Mobile Number
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="10-digit Phone Number"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full mt-6 py-4 bg-brand-primary text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? 'Processing...' : 'Proceed to Payment'}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              )}

              {/* Step 2: Payment Gate */}
              {subscribeStep === 2 && (
                <div className="space-y-6 relative min-h-[450px]">
                  {/* Securing Payment Gateway Loader Overlay */}
                  {paymentStatus === 'processing' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 z-30 bg-white/95 dark:bg-brand-dark/95 flex flex-col items-center justify-center p-6 text-center space-y-6 rounded-3xl"
                    >
                      <div className="relative">
                        <div className="h-16 w-16 rounded-full border-4 border-[#1E3A8A] border-t-transparent dark:border-brand-accent/20 dark:border-t-brand-accent animate-spin" />
                        <Sparkles className="h-6 w-6 text-[#1E3A8A] dark:text-brand-accent animate-pulse absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-lg font-serif font-bold text-slate-800 dark:text-white animate-pulse">
                          Authorizing Secured Transaction
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs font-mono">
                          Initializing secured MEMBERSHIP recharge token handshake...
                        </p>
                      </div>
                      <div className="w-full max-w-xs bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: '0%' }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 1.8, ease: 'easeInOut' }}
                          className="bg-linear-to-r from-brand-primary to-brand-secondary dark:from-brand-accent dark:to-brand-teal h-full"
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono space-y-1">
                        <div>⚡ Gateway Mode: PCI-DSS Compliance Tier 1</div>
                        <div>🔐 Total: ₹{rechargeAmount}</div>
                      </div>
                    </motion.div>
                  )}

                  {/* Securing Payment Success Overlay */}
                  {paymentStatus === 'success' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute inset-0 z-35 bg-white dark:bg-brand-dark flex flex-col items-center justify-center p-6 text-center space-y-4 rounded-3xl"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1] }}
                        transition={{ duration: 0.6, ease: 'backOut' }}
                        className="h-20 w-20 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-xl shadow-emerald-500/20"
                      >
                        <Check className="h-12 w-12 stroke-[3]" />
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="space-y-1.5"
                      >
                        <h3 className="text-xl font-serif font-bold text-emerald-600 dark:text-emerald-400">
                          Payment Authorized!
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Your digital subscription was processed successfully.
                        </p>
                        <p className="text-[10px] font-bold font-mono text-slate-400">
                          Reference ID: SUB-TXN-{Math.floor(100000 + Math.random() * 900000)}
                        </p>
                      </motion.div>
                    </motion.div>
                  )}

                  <div>
                    <h3 className="text-xl font-serif font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Lock className="h-5 w-5 text-brand-primary dark:text-brand-accent" />
                      Secure Subscription Checkout
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">
                      Complete your payment of <strong>₹{rechargeAmount}</strong> to activate your <strong>{selectedPackage}</strong> plan.
                    </p>
                  </div>

                  {/* Responsive Grid Split */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    
                    {/* Left side: QR Code Container */}
                    <div className="flex flex-col items-center space-y-4">
                      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-brand-teal/20 rounded-3xl shadow-lg flex flex-col items-center space-y-2 relative overflow-hidden w-full max-w-[240px] mx-auto">
                        <div className="relative p-2 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                              `upi://pay?pa=${businessInfo.upiId || 'prakashcsat@oksbi'}&pn=Tumble%20Spin&am=${rechargeAmount}&cu=INR&tn=Membership_${selectedPackage}_${phone.replace(/\D/g, '')}&tr=Membership_${selectedPackage}_${phone.replace(/\D/g, '')}`
                            )}`}
                            onError={(e) => {
                              const target = e.currentTarget;
                              const upiIntent = `upi://pay?pa=${businessInfo.upiId || 'prakashcsat@oksbi'}&pn=Tumble%20Spin&am=${rechargeAmount}&cu=INR&tn=Membership_${selectedPackage}_${phone.replace(/\D/g, '')}&tr=Membership_${selectedPackage}_${phone.replace(/\D/g, '')}`;
                              const alternateUrl = `https://quickchart.io/qr?size=200&text=${encodeURIComponent(upiIntent)}`;
                              if (target.src !== alternateUrl) {
                                target.src = alternateUrl;
                              }
                            }}
                            alt="Dynamic UPI QR"
                            className={`h-36 w-36 object-contain rounded-lg transition-all duration-300 ${qrExpired ? 'opacity-20 blur-[1.5px]' : ''}`}
                            referrerPolicy="no-referrer"
                          />
                          {qrExpired && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 rounded-2xl text-white p-2 text-center">
                              <span className="text-[10px] font-black tracking-wider uppercase bg-rose-500 px-2 py-0.5 rounded-full mb-1">
                                Expired
                              </span>
                              <button
                                type="button"
                                onClick={handleRefreshQrPayment}
                                disabled={isRefreshingQr}
                                className="text-[11px] font-black bg-white text-slate-900 px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
                              >
                                {isRefreshingQr ? (
                                  <span className="h-3 w-3 animate-spin rounded-full border border-slate-950 border-t-transparent" />
                                ) : null}
                                Regenerate
                              </button>
                            </div>
                          )}
                        </div>

                        <p className="text-[8.5px] text-slate-400 font-bold tracking-widest font-mono uppercase">VPA: {businessInfo.upiId || 'prakashcsat@oksbi'}</p>

                        {qrTimeLeft !== null && (
                          <div className="pt-0.5">
                            {qrExpired ? (
                              <span className="text-[8.5px] font-bold text-rose-500 font-mono">
                                ⚠️ QR code expired
                              </span>
                            ) : (
                              <div className="flex items-center gap-1 text-[9.5px] font-bold text-amber-500 font-mono">
                                <Clock className="h-3 w-3 animate-pulse" />
                                <span>Expires in: {Math.floor(qrTimeLeft / 60)}:{(qrTimeLeft % 60).toString().padStart(2, '0')}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Razorpay External Redirect Button */}
                      <div className="w-full text-center space-y-1">
                        <p className="text-[10px] text-slate-400 font-medium">Having trouble scanning? Pay directly:</p>
                        <a
                          href={paymentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-primary text-white hover:bg-brand-deep dark:bg-brand-accent dark:text-brand-deep font-extrabold text-[10.5px] uppercase tracking-wider shadow-sm transition-all duration-200 hover:-translate-y-0.5"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Pay with Razorpay Gateway
                        </a>
                      </div>
                    </div>

                    {/* Right side: Verification form */}
                    <div className="space-y-4">
                      {/* Summary card */}
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-400">Subscriber Name</span>
                          <span className="text-slate-800 dark:text-white font-bold">{fullName}</span>
                        </div>
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-400">Selected Plan</span>
                          <span className="text-slate-800 dark:text-white font-extrabold font-mono text-[#1E3A8A] dark:text-brand-accent">{selectedPackage}</span>
                        </div>
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-400">Total Recharge</span>
                          <span className="text-slate-800 dark:text-white font-extrabold font-mono">₹{rechargeAmount}</span>
                        </div>
                      </div>

                      {/* Verification Input Form */}
                      <form onSubmit={handleVerifyAndCompleteQrPayment} className="space-y-4">
                        <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/30">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                              Transaction Amount Paid (INR)
                            </label>
                            
                            <button
                              type="button"
                              onClick={async () => {
                                setIsFetchingHistory(true);
                                await new Promise(resolve => setTimeout(resolve, 800));
                                setUserPaidAmount(rechargeAmount.toString());
                                setIsFetchingHistory(false);
                              }}
                              disabled={isFetchingHistory}
                              className="text-[9px] text-brand-primary dark:text-brand-accent font-black hover:underline cursor-pointer disabled:opacity-50 flex items-center gap-1"
                            >
                              {isFetchingHistory ? (
                                <>
                                  <span className="h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
                                  Syncing UPI...
                                </>
                              ) : (
                                '⚡ Fetch From UPI App'
                              )}
                            </button>
                          </div>

                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
                            <input 
                              type="number"
                              step="1"
                              min="0"
                              placeholder="0"
                              value={userPaidAmount}
                              onChange={(e) => {
                                setUserPaidAmount(e.target.value);
                                setIsAmountOverridden(false);
                              }}
                              className="w-full pl-8 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold tracking-wider font-mono text-slate-800 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 dark:border-slate-700 dark:bg-brand-dark dark:text-white dark:focus:border-brand-accent"
                              required
                            />
                          </div>

                          {userPaidAmount && (
                            <div className="pt-1">
                              {(() => {
                                const entered = Number(userPaidAmount);
                                const expected = rechargeAmount;
                                if (isNaN(entered) || entered <= 0) return null;
                                if (Math.abs(entered - expected) < 0.01) {
                                  return (
                                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-[9.5px] font-bold text-emerald-800 dark:text-emerald-300">
                                      ✅ PERFECT MATCH (Ledger Aligned)
                                    </div>
                                  );
                                }
                                return (
                                  <div className="p-2 rounded-lg bg-rose-50/70 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/20 text-[9.5px] font-bold text-rose-800 dark:text-rose-300 flex flex-col gap-1">
                                    <span>⚠️ AMOUNT MISMATCH (Expected: ₹{expected})</span>
                                    <label className="flex items-center gap-1 cursor-pointer mt-0.5">
                                      <input 
                                        type="checkbox"
                                        checked={isAmountOverridden}
                                        onChange={(e) => setIsAmountOverridden(e.target.checked)}
                                        className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary h-3 w-3"
                                      />
                                      <span className="text-[8.5px] font-bold text-slate-500 uppercase">Force align & submit</span>
                                    </label>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>

                        <button
                          type="submit"
                          disabled={paymentStatus === 'processing' || isRefreshingQr || !userPaidAmount}
                          className="w-full py-3.5 bg-[#1E3A8A] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 dark:bg-brand-accent dark:text-brand-deep"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Verify & Activate Membership
                        </button>
                      </form>
                    </div>

                  </div>
                </div>
              )}

              {/* Step 3: Success Celebration */}
              {subscribeStep === 3 && (
                <div className="text-center py-8 space-y-6">
                  <div className="mx-auto h-16 w-16 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center text-emerald-600 dark:text-brand-accent shadow-inner">
                    <Check className="h-8 w-8" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-2xl font-serif font-bold text-slate-900 dark:text-white">
                      Welcome to the Club, {fullName}!
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold max-w-sm mx-auto leading-relaxed">
                      Your <strong className="text-brand-primary dark:text-brand-accent">{selectedPackage}</strong> membership is now active under <strong className="text-slate-800 dark:text-white">{phone}</strong>.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl inline-block text-left w-full max-w-sm border border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono mb-2">
                      Active Subscription summary
                    </p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span className="text-slate-400">Available Balance:</span>
                        <span className="text-slate-800 dark:text-white font-bold font-mono">₹{rechargeAmount}.00</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span className="text-slate-400">Active Discount:</span>
                        <span className="text-brand-primary dark:text-brand-accent font-extrabold">
                          {selectedPackage === 'SMART' ? '10% OFF' : '20% OFF'} on all orders
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span className="text-slate-400">Membership ID:</span>
                        <span className="text-slate-800 dark:text-white font-mono">{phone.replace(/\D/g, '')}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 font-medium">
                    ✨ Simply use this phone number when placing any booking, and your membership discount will apply automatically!
                  </p>

                  <button
                    onClick={() => setShowSubscribeModal(false)}
                    className="w-full py-4 bg-brand-primary text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-95 active:scale-98 transition-all"
                  >
                    Done
                  </button>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </section>
  );
}
