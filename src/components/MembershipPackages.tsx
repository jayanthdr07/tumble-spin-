import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, CheckCircle, ArrowRight, User, Phone, Mail, 
  Search, ShieldCheck, Award, Zap, Check, AlertCircle, RefreshCw, X,
  ExternalLink, Clock, Lock, CreditCard, Send, CheckCircle2, ChevronRight
} from 'lucide-react';
import WOMAN_IMAGE_PATH from '../assets/images/smiling_woman_thumbs_up_1783847990839.jpg';
import { useBusinessInfo } from '../utils/useBusinessInfo';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, onSnapshot, getDoc } from 'firebase/firestore';
import { robustFetch } from '../utils/robustFetch';

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
  paymentMethod?: string;
  upiRefNo?: string;
  merchantTransactionId?: string;
}

// Helper: 10-digit Indian phone normalization
const normalize10Digits = (val: string): string => {
  const digits = (val || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

export default function MembershipPackages({ onOpenBooking }: MembershipPackagesProps) {
  const businessInfo = useBusinessInfo();
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<'SMART' | 'SILVER'>('SMART');
  
  // Search / Lookup States
  const [searchPhone, setSearchPhone] = useState('');
  const [lookupResult, setLookupResult] = useState<MembershipSubscription | null>(null);
  const [searched, setSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Form States
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subscribeStep, setSubscribeStep] = useState<1 | 2 | 3>(1); // 1: Info/Form, 2: Payment, 3: Success

  // Real Cashfree Gateway Payment States
  const [merchantTransactionId, setMerchantTransactionId] = useState('');
  const [payUrl, setPayUrl] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [upiIntent, setUpiIntent] = useState('');

  // Status Check States (Real Gateway Verification Only)
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'info' | 'error' | 'success'; message: string } | null>(null);

  const [qrExpired, setQrExpired] = useState(false);
  const [qrTimeLeft, setQrTimeLeft] = useState<number | null>(600); // 10 minutes
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  // List of memberships loaded from local storage and real-time Firestore
  const [memberships, setMemberships] = useState<MembershipSubscription[]>([]);

  useEffect(() => {
    // 1. Initial local load
    const loadMembershipsFromLocal = () => {
      const saved = localStorage.getItem('tumblespin_memberships');
      if (saved) {
        try {
          setMemberships(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
    };
    loadMembershipsFromLocal();
    window.addEventListener('storage', loadMembershipsFromLocal);

    // 2. Real-time Firestore sync
    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(collection(db, 'memberships'), (snapshot) => {
        const liveSubs: MembershipSubscription[] = [];
        snapshot.forEach((docSnap) => {
          liveSubs.push({ id: docSnap.id, ...docSnap.data() } as any);
        });
        if (liveSubs.length > 0) {
          setMemberships(liveSubs);
          localStorage.setItem('tumblespin_memberships', JSON.stringify(liveSubs));
        }
      }, (err) => {
        console.warn('Firestore memberships subscription listener notice:', err);
      });
    } catch (fsErr) {
      console.warn('Firestore memberships sync offline:', fsErr);
    }

    return () => {
      window.removeEventListener('storage', loadMembershipsFromLocal);
      unsubscribe();
    };
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPhone) return;
    
    setIsSearching(true);
    setSearched(true);
    const cleanPhone = normalize10Digits(searchPhone);

    // 1. Try local list
    const foundLocal = memberships.find(m => normalize10Digits(m.phone) === cleanPhone && m.status === 'active');
    if (foundLocal) {
      setLookupResult(foundLocal);
      setIsSearching(false);
      return;
    }

    // 2. Query Firestore / backend API live
    try {
      const snap = await getDoc(doc(db, 'memberships', cleanPhone));
      if (snap.exists() && snap.data()?.status === 'active') {
        const liveMem = snap.data() as MembershipSubscription;
        setLookupResult(liveMem);
        // Sync into local state
        setMemberships(prev => {
          const filtered = prev.filter(m => normalize10Digits(m.phone) !== cleanPhone);
          const updated = [...filtered, liveMem];
          localStorage.setItem('tumblespin_memberships', JSON.stringify(updated));
          return updated;
        });
        setIsSearching(false);
        return;
      }
    } catch (err) {
      console.warn('Direct Firestore lookup fallback:', err);
    }

    // 3. Backend lookup API fallback
    try {
      const resp = await robustFetch(`/api/memberships/lookup/${cleanPhone}`);
      const data = await resp.json();
      if (data.success && data.found && data.membership) {
        setLookupResult(data.membership);
        setIsSearching(false);
        return;
      }
    } catch (apiErr) {
      console.warn('API lookup fallback notice:', apiErr);
    }

    setLookupResult(null);
    setIsSearching(false);
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

  // Cashfree Membership Payment Verification Polling
  useEffect(() => {
    if (subscribeStep !== 2 || !merchantTransactionId || paymentStatus === 'success') return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await robustFetch(`/api/cashfree/status/${encodeURIComponent(merchantTransactionId)}`);
        const data = await response.json();

        if (data.success && (data.paymentStatus === 'paid' || data.verified === true)) {
          clearInterval(pollInterval);
          setPaymentStatus('success');

          const expectedAmount = selectedPackage === 'SMART' ? 2000 : 5000;
          const cleanPhone = normalize10Digits(phone);
          const newSub: MembershipSubscription = {
            phone: cleanPhone,
            fullName: fullName.trim(),
            email: email.trim(),
            packageType: selectedPackage,
            rechargeAmount: expectedAmount,
            balance: expectedAmount,
            createdAt: new Date().toISOString(),
            status: 'active',
            merchantTransactionId
          };

          try {
            await setDoc(doc(db, 'memberships', cleanPhone), newSub, { merge: true });
          } catch (fsErr) {
            console.warn('Direct Firestore membership write warning:', fsErr);
          }

          setMemberships(prev => {
            const filtered = prev.filter(m => normalize10Digits(m.phone) !== cleanPhone);
            const nextList = [...filtered, newSub];
            localStorage.setItem('tumblespin_memberships', JSON.stringify(nextList));
            window.dispatchEvent(new Event('storage'));
            return nextList;
          });

          setTimeout(() => {
            setSubscribeStep(3); // Move to Success Step
            setPaymentStatus('idle');
          }, 1500);
        }
      } catch (err) {
        console.error('[Cashfree Membership Polling Error]:', err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [subscribeStep, merchantTransactionId, paymentStatus, selectedPackage, phone, fullName, email]);

  const handleSubscribeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = fullName.trim();
    const cleanPhone = normalize10Digits(phone);
    const cleanEmail = email.trim();

    if (!cleanName) {
      setFormError('Please enter your full name.');
      return;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      setFormError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    const amount = selectedPackage === 'SMART' ? 2000 : 5000;

    try {
      const response = await robustFetch('/api/cashfree/initiate-membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageType: selectedPackage,
          fullName: cleanName,
          phone: cleanPhone,
          email: cleanEmail,
          amount
        })
      });

      const data = await response.json();
      if (!data.success) {
        setFormError(data.error || 'Failed to initiate payment. Please try again.');
        setIsSubmitting(false);
        return;
      }

      setMerchantTransactionId(data.merchantTransactionId);
      setPayUrl(data.payUrl || '');
      setQrCodeUrl(data.qrCodeUrl || '');
      setUpiIntent(data.upiIntent || '');

      setSubscribeStep(2); // Move to Payment Step
      setQrExpired(false);
      setQrTimeLeft(600);
      setPaymentStatus('idle');
      setStatusFeedback(null);
    } catch (err: any) {
      console.error('[Membership Cashfree Initiation Error]:', err);
      setFormError('Unable to connect to payment server. Please check your network and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Real Gateway Verification Check (No fake payments allowed)
  const handleCheckPaymentStatus = async () => {
    if (!merchantTransactionId) return;
    setIsCheckingPayment(true);
    setStatusFeedback(null);

    try {
      const response = await robustFetch(`/api/cashfree/status/${encodeURIComponent(merchantTransactionId)}`);
      const data = await response.json();

      if (data.success && (data.paymentStatus === 'paid' || data.verified === true)) {
        setPaymentStatus('success');
        setStatusFeedback({ type: 'success', message: '✨ Payment verified by Cashfree gateway! Activating subscription...' });

        const expectedAmount = selectedPackage === 'SMART' ? 2000 : 5000;
        const cleanPhone = normalize10Digits(phone);
        const newSub: MembershipSubscription = {
          phone: cleanPhone,
          fullName: fullName.trim() || 'Valued Member',
          email: email.trim() || 'client@tumblespin.com',
          packageType: selectedPackage,
          rechargeAmount: expectedAmount,
          balance: expectedAmount,
          createdAt: new Date().toISOString(),
          status: 'active',
          merchantTransactionId
        };

        try {
          await setDoc(doc(db, 'memberships', cleanPhone), newSub, { merge: true });
        } catch (fsErr) {
          console.warn('Direct Firestore membership write warning:', fsErr);
        }

        setMemberships(prev => {
          const filtered = prev.filter(m => normalize10Digits(m.phone) !== cleanPhone);
          const nextList = [...filtered, newSub];
          localStorage.setItem('tumblespin_memberships', JSON.stringify(nextList));
          window.dispatchEvent(new Event('storage'));
          return nextList;
        });

        setTimeout(() => {
          setIsCheckingPayment(false);
          setSubscribeStep(3); // Move to Step 3 Celebration Screen!
          setPaymentStatus('idle');
        }, 1200);
      } else {
        setIsCheckingPayment(false);
        setStatusFeedback({
          type: 'error',
          message: 'Payment has not been confirmed yet by Cashfree. If you have already paid in your UPI or card app, please wait a few seconds and tap "Check Status Now" again.'
        });
      }
    } catch (err) {
      console.error('[Cashfree Status Check Error]:', err);
      setIsCheckingPayment(false);
      setStatusFeedback({
        type: 'error',
        message: 'Could not connect to payment gateway to check status. Please check your network.'
      });
    }
  };

  const handleCancelSubscription = (phoneToCancel: string) => {
    const cleanPhone = normalize10Digits(phoneToCancel);
    const updated = memberships.map(m => {
      if (normalize10Digits(m.phone) === cleanPhone) {
        return { ...m, status: 'cancelled' as const };
      }
      return m;
    });
    setMemberships(updated);
    localStorage.setItem('tumblespin_memberships', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));

    try {
      setDoc(doc(db, 'memberships', cleanPhone), { status: 'cancelled' }, { merge: true });
    } catch (e) {}
    
    if (lookupResult && normalize10Digits(lookupResult.phone) === cleanPhone) {
      setLookupResult(prev => prev ? { ...prev, status: 'cancelled' as const } : null);
    }
  };

  const handleOpenSubscribe = (pkg: 'SMART' | 'SILVER') => {
    setSelectedPackage(pkg);
    setSubscribeStep(1);
    setFullName('');
    setPhone('');
    setEmail('');
    setFormError(null);
    setMerchantTransactionId('');
    setPayUrl('');
    setQrCodeUrl('');
    setUpiIntent('');
    setQrExpired(false);
    setQrTimeLeft(600);
    setPaymentStatus('idle');
    setShowSubscribeModal(true);
  };

  const rechargeAmount = selectedPackage === 'SMART' ? 2000 : 5000;

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
              <div className="relative rounded-3xl p-8 bg-[#1E3A8A] text-white shadow-xl flex flex-col justify-between overflow-hidden border border-blue-900/50 group transition-all duration-300 hover:shadow-2xl">
                <div className="space-y-6">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-mono font-bold tracking-widest uppercase px-3 py-1 bg-white/10 rounded-full border border-white/20">
                      Standard Tier
                    </span>
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-200">
                      Prepaid
                    </span>
                  </div>

                  <div>
                    <h3 className="text-3xl font-serif font-bold tracking-tight">SMART</h3>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-xs uppercase font-mono tracking-widest text-blue-200">Recharge with</span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-4xl font-bold font-serif">₹ 2000</span>
                    </div>
                  </div>

                  <div className="py-4 border-y border-white/15 space-y-1">
                    <span className="text-xs uppercase tracking-wider text-blue-200 font-mono">and get</span>
                    <div className="text-3xl font-extrabold text-white font-serif tracking-tight">
                      10% off
                    </div>
                    <span className="text-xs text-blue-200 font-medium">on all orders</span>
                  </div>
                </div>

                <div className="pt-8">
                  <button
                    onClick={() => handleOpenSubscribe('SMART')}
                    className="w-full py-3.5 px-6 rounded-xl bg-white text-[#1E3A8A] font-bold text-xs uppercase tracking-wider hover:bg-blue-50 active:scale-98 transition-all duration-200 shadow-md flex items-center justify-center gap-2 group-hover:gap-3 cursor-pointer"
                  >
                    <span>SUBSCRIBE NOW</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* SILVER Card */}
              <div className="relative rounded-3xl p-8 bg-slate-900 dark:bg-[#0B1528] text-white shadow-xl flex flex-col justify-between overflow-hidden border border-slate-700/50 group transition-all duration-300 hover:shadow-2xl">
                <div className="space-y-6">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-mono font-bold tracking-widest uppercase px-3 py-1 bg-brand-accent/20 text-brand-accent rounded-full border border-brand-accent/30">
                      Popular Tier
                    </span>
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                      Prepaid
                    </span>
                  </div>

                  <div>
                    <h3 className="text-3xl font-serif font-bold tracking-tight text-white">SILVER</h3>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-xs uppercase font-mono tracking-widest text-slate-400">Recharge with</span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-4xl font-bold font-serif text-brand-accent">₹ 5000</span>
                    </div>
                  </div>

                  <div className="py-4 border-y border-white/10 space-y-1">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-mono">and get</span>
                    <div className="text-3xl font-extrabold text-white font-serif tracking-tight">
                      20% off
                    </div>
                    <span className="text-xs text-slate-400 font-medium">on all orders</span>
                  </div>
                </div>

                <div className="pt-8">
                  <button
                    onClick={() => handleOpenSubscribe('SILVER')}
                    className="w-full py-3.5 px-6 rounded-xl bg-brand-accent text-brand-deep font-bold text-xs uppercase tracking-wider hover:bg-brand-accent/90 active:scale-98 transition-all duration-200 shadow-md flex items-center justify-center gap-2 group-hover:gap-3 cursor-pointer"
                  >
                    <span>SUBSCRIBE NOW</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

            </div>

            {/* Micro Feature Bullet points row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-brand-dark border border-slate-100 dark:border-brand-teal/10 shadow-xs">
                <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-brand-accent shrink-0">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="text-xs leading-snug">
                  <strong className="block font-bold text-slate-800 dark:text-white">No Joining Fee</strong>
                  <span className="text-slate-500 dark:text-slate-400">100% of your amount is usable</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-brand-dark border border-slate-100 dark:border-brand-teal/10 shadow-xs">
                <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-brand-primary dark:text-blue-400 shrink-0">
                  <Zap className="h-4 w-4" />
                </div>
                <div className="text-xs leading-snug">
                  <strong className="block font-bold text-slate-800 dark:text-white">Lifetime Validity</strong>
                  <span className="text-slate-500 dark:text-slate-400">Your wallet balance never expires</span>
                </div>
              </div>
            </div>

            {/* Lookup Section */}
            <div className="p-6 rounded-3xl bg-white dark:bg-brand-dark border border-slate-100 dark:border-brand-teal/10 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">
                <Search className="h-3.5 w-3.5" />
                Already a member? Check your subscription
              </div>

              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="tel"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  placeholder="Enter 10-digit registered phone"
                  className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary dark:focus:ring-brand-accent"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-98 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSearching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Check
                </button>
              </form>

              {searched && (
                <div className="animate-fadeIn">
                  {lookupResult ? (
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                            Active {lookupResult.packageType} Member: {lookupResult.fullName}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          Prepaid Balance: <strong>₹{lookupResult.balance}</strong> (Original: ₹{lookupResult.rechargeAmount}) • Guaranteed {lookupResult.packageType === 'SMART' ? '10%' : '20%'} discount on all future bookings.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Are you sure you want to cancel this membership? Remaining balance can be claimed at store.')) {
                              handleCancelSubscription(lookupResult.phone);
                            }
                          }}
                          className="px-3 py-1.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/50 rounded-lg border border-rose-200 dark:border-rose-900/50 transition-all cursor-pointer"
                        >
                          Cancel Plan
                        </button>
                        <button
                          type="button"
                          onClick={onOpenBooking}
                          className="px-3 py-1.5 text-[10px] font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all cursor-pointer"
                        >
                          Book With Discount
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                      <span>No active membership found for <strong>{searchPhone}</strong>. Subscribe today to unlock up to 20% off!</span>
                      <button
                        type="button"
                        onClick={() => handleOpenSubscribe('SMART')}
                        className="font-bold underline uppercase text-[10px] ml-2 shrink-0"
                      >
                        Subscribe Now
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Visual Brand Editorial Banner */}
          <div className="lg:col-span-5 h-full flex flex-col">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl flex-1 flex flex-col justify-end p-8 border border-slate-100 dark:border-brand-teal/15 min-h-[460px]">
              
              <img
                src={WOMAN_IMAGE_PATH}
                alt="Delighted laundry client"
                className="absolute inset-0 w-full h-full object-cover object-center filter brightness-90 contrast-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />

              <div className="relative z-10 space-y-4 text-white">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-bold tracking-wider uppercase border border-white/20 font-mono">
                  <Award className="h-3.5 w-3.5 text-brand-accent" />
                  VIP Privileges
                </div>

                <h3 className="text-2xl font-serif font-medium leading-tight">
                  Seamless garment care, personalized wardrobe tracking, and guaranteed savings.
                </h3>

                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                  All memberships are 100% usable on standard cleaning, couture care, sneaker restoration, and express valet delivery.
                </p>

                <div className="pt-2 flex items-center gap-4 text-xs font-mono text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-brand-accent" />
                    Zero Expiry
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-brand-accent" />
                    Priority Valet
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-brand-accent" />
                    Free Delivery
                  </span>
                </div>
              </div>

            </div>
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
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-brand-dark rounded-3xl p-6 sm:p-8 border border-slate-100 dark:border-brand-accent/20 shadow-2xl overflow-hidden z-10 max-h-[92vh] overflow-y-auto"
              id="membership-subscribe-modal"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowSubscribeModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
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
                      Recharge with <strong>₹{rechargeAmount}</strong> and get <strong>{selectedPackage === 'SMART' ? '10%' : '20%'} OFF</strong> on all orders.
                    </p>
                  </div>

                  {/* Quick Package Selector Toggle */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setSelectedPackage('SMART')}
                      className={`py-2.5 rounded-xl text-xs font-bold uppercase transition-all duration-300 flex flex-col items-center gap-0.5 cursor-pointer ${
                        selectedPackage === 'SMART'
                          ? 'bg-[#1E3A8A] text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <span>SMART (₹2,000)</span>
                      <span className="text-[10px] font-normal opacity-90">10% OFF all orders</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPackage('SILVER')}
                      className={`py-2.5 rounded-xl text-xs font-bold uppercase transition-all duration-300 flex flex-col items-center gap-0.5 cursor-pointer ${
                        selectedPackage === 'SILVER'
                          ? 'bg-slate-900 text-brand-accent shadow-sm dark:bg-brand-accent dark:text-brand-deep'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <span>SILVER (₹5,000)</span>
                      <span className="text-[10px] font-normal opacity-90">20% OFF all orders</span>
                    </button>
                  </div>

                  {/* Inline Form Error Banner */}
                  {formError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Form fields */}
                  <form onSubmit={handleSubscribeSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                        Full Name *
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Rahul Sharma"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                        Mobile Number *
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="10-digit Phone Number (e.g. 9876543210)"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        />
                      </div>
                      <p className="text-[10.5px] text-slate-400">Your membership will be linked to this phone number.</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                        Email Address *
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

                    <div className="p-3 bg-brand-primary/5 dark:bg-brand-accent/5 border border-brand-primary/15 dark:border-brand-accent/20 rounded-xl text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      <div className="flex justify-between font-bold">
                        <span>Payable Today:</span>
                        <span className="text-brand-primary dark:text-brand-accent">₹{rechargeAmount}.00</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        100% credited to your wallet balance. No hidden joining or convenience fees.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full mt-6 py-4 bg-brand-primary text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Generating Payment Gateway...</span>
                        </>
                      ) : (
                        <>
                          <span>Proceed to Payment (₹{rechargeAmount})</span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* Step 2: Payment Gate */}
              {subscribeStep === 2 && (
                <div className="space-y-6 relative min-h-[460px]">
                  {/* Securing Payment Gateway Loader Overlay */}
                  {paymentStatus === 'processing' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 z-30 bg-white/95 dark:bg-brand-dark/95 flex flex-col items-center justify-center p-6 text-center space-y-6 rounded-3xl"
                    >
                      <div className="relative">
                        <div className="h-16 w-16 rounded-full border-4 border-purple-600 border-t-transparent dark:border-purple-400 animate-spin" />
                        <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-300 animate-pulse absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-lg font-serif font-bold text-slate-800 dark:text-white animate-pulse">
                          Verifying Payment Authorization
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs font-mono">
                          Checking settlement ledger with gateway servers...
                        </p>
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
                          Payment Verified & Authorized!
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Your {selectedPackage} membership plan is now active.
                        </p>
                        <p className="text-[10px] font-bold font-mono text-slate-400">
                          Registered Phone: {phone}
                        </p>
                      </motion.div>
                    </motion.div>
                  )}

                  <div>
                    <h3 className="text-xl font-serif font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Lock className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                      Complete Membership Payment
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">
                      Recharge <strong>₹{rechargeAmount}</strong> to activate your <strong>{selectedPackage}</strong> plan.
                    </p>
                  </div>

                  {/* Responsive Grid Split */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    
                    {/* Left side: Dynamic QR Code Container */}
                    <div className="flex flex-col items-center space-y-4">
                      <div className="p-4 bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800/40 rounded-3xl shadow-lg flex flex-col items-center space-y-2 relative overflow-hidden w-full max-w-[240px] mx-auto">
                        <div className="relative p-2 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center">
                          <img 
                            src={qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                              upiIntent || payUrl || `upi://pay?pa=prakashcsat@oksbi&pn=Tumble%20Spin&am=${rechargeAmount}&cu=INR`
                            )}`}
                            onError={(e) => {
                              const target = e.currentTarget;
                              const fallbackIntent = upiIntent || payUrl || `upi://pay?pa=prakashcsat@oksbi&pn=Tumble%20Spin&am=${rechargeAmount}&cu=INR`;
                              const alternateUrl = `https://quickchart.io/qr?size=200&text=${encodeURIComponent(fallbackIntent)}`;
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
                            </div>
                          )}
                        </div>

                        <p className="text-[9.5px] text-teal-700 dark:text-teal-300 font-extrabold tracking-wider uppercase flex items-center gap-1">
                          <span>🟢</span> Dynamic UPI / Gateway QR
                        </p>

                        {qrTimeLeft !== null && (
                          <div className="pt-0.5">
                            {qrExpired ? (
                              <span className="text-[8.5px] font-bold text-rose-500 font-mono">
                                ⚠️ QR code expired
                              </span>
                            ) : (
                              <div className="flex items-center gap-1 text-[9.5px] font-bold text-teal-600 dark:text-teal-300 font-mono">
                                <Clock className="h-3 w-3 animate-pulse" />
                                <span>Expires in: {Math.floor(qrTimeLeft / 60)}:{(qrTimeLeft % 60).toString().padStart(2, '0')}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Payment Options Links */}
                      <div className="w-full text-center space-y-2.5">
                        {/* Cashfree Direct Hosted Checkout Link */}
                        {payUrl && (
                          <a
                            href={payUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-teal-600 text-white hover:bg-teal-700 font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer"
                          >
                            <ExternalLink className="h-4 w-4" />
                            <span>Pay ₹{rechargeAmount} on Cashfree Gateway</span>
                          </a>
                        )}

                        {/* Mobile Direct UPI Intent */}
                        <a
                          href={upiIntent || `upi://pay?pa=prakashcsat@oksbi&pn=Tumble%20Spin&am=${rechargeAmount}&cu=INR&tn=Membership_${selectedPackage}`}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-teal-600/30 bg-teal-50 dark:bg-teal-950/20 text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-950/40 font-bold text-xs uppercase tracking-wider shadow-xs transition-all cursor-pointer"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Open UPI App to Pay ₹{rechargeAmount}</span>
                        </a>
                      </div>
                    </div>

                    {/* Right side: Summary & Real Gateway Verification */}
                    <div className="space-y-4">
                      {/* Summary card */}
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-2">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-400">Subscriber</span>
                          <span className="text-slate-800 dark:text-white font-bold">{fullName}</span>
                        </div>
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-400">Registered Mobile</span>
                          <span className="text-slate-800 dark:text-white font-mono font-bold">{phone}</span>
                        </div>
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-400">Selected Plan</span>
                          <span className="text-teal-700 dark:text-teal-300 font-extrabold font-mono">{selectedPackage}</span>
                        </div>
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-400">Amount to Pay</span>
                          <span className="text-slate-800 dark:text-white font-extrabold font-mono text-sm">₹{rechargeAmount}.00</span>
                        </div>
                      </div>

                      {/* Cashfree Real Verification Status Box */}
                      <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-2.5 border border-teal-500/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-teal-400 font-mono">
                            <span className="h-2 w-2 rounded-full bg-teal-400 animate-ping" />
                            <span>Cashfree Gateway Active</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">Auto-polling</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Once payment is completed on Cashfree or your UPI app, our system will automatically verify and activate your subscription.
                        </p>
                      </div>

                      {statusFeedback && (
                        <div className={`p-3 rounded-xl text-xs font-medium ${
                          statusFeedback.type === 'success' 
                            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-500/20' 
                            : 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-500/20'
                        }`}>
                          {statusFeedback.message}
                        </div>
                      )}

                      {/* Manual Trigger to Verify Status with Cashfree Gateway */}
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                        <button
                          type="button"
                          onClick={handleCheckPaymentStatus}
                          disabled={isCheckingPayment}
                          className="w-full py-3 bg-teal-700 hover:bg-teal-800 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isCheckingPayment ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-4 w-4" />
                          )}
                          <span>I've Completed Payment – Check Status Now</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSubscribeStep(1)}
                          className="w-full py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 cursor-pointer"
                        >
                          Back / Change Details
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* Step 3: Success Celebration */}
              {subscribeStep === 3 && (
                <div className="text-center py-6 space-y-6">
                  <div className="mx-auto h-16 w-16 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center text-emerald-600 dark:text-brand-accent shadow-inner animate-bounce">
                    <Check className="h-8 w-8 stroke-[3]" />
                  </div>

                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider">
                      <Sparkles className="h-3.5 w-3.5" />
                      Subscription Active
                    </div>
                    <h3 className="text-2xl font-serif font-bold text-slate-900 dark:text-white">
                      Welcome to the Club, {fullName}!
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold max-w-sm mx-auto leading-relaxed">
                      Your <strong className="text-brand-primary dark:text-brand-accent">{selectedPackage}</strong> membership is now confirmed under mobile number <strong className="text-slate-800 dark:text-white">{phone}</strong>.
                    </p>
                  </div>

                  {/* Membership Card */}
                  <div className="p-5 bg-gradient-to-br from-slate-900 via-brand-deep to-slate-950 text-white rounded-3xl inline-block text-left w-full max-w-md border border-slate-800 shadow-xl relative overflow-hidden">
                    <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-brand-accent/10 rounded-full blur-xl pointer-events-none" />
                    
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-brand-accent" />
                        <span className="text-xs font-bold uppercase tracking-widest text-brand-accent font-mono">
                          Tumble Spin Club
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-white/10 text-white border border-white/20">
                        {selectedPackage} TIER
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between items-center py-1 border-b border-white/10">
                        <span className="text-slate-400 font-medium">Prepaid Balance:</span>
                        <span className="text-white font-extrabold font-mono text-base">₹{rechargeAmount}.00</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/10">
                        <span className="text-slate-400 font-medium">Guaranteed Discount:</span>
                        <span className="text-brand-accent font-extrabold">
                          {selectedPackage === 'SMART' ? '10% OFF' : '20% OFF'} on all orders
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-slate-400 font-medium">Registered Phone:</span>
                        <span className="text-white font-mono font-bold">{phone}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto">
                    ✨ Simply enter <strong>{phone}</strong> whenever you book a pickup, and your discount will be applied automatically!
                  </p>

                  <div className="space-y-2 pt-2">
                    <button
                      onClick={() => {
                        setShowSubscribeModal(false);
                        onOpenBooking();
                      }}
                      className="w-full py-4 bg-brand-primary text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-95 active:scale-98 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Book Pickup Now With Membership</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => setShowSubscribeModal(false)}
                      className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </section>
  );
}
