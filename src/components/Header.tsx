import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, Sun, Moon, Sparkles, CalendarRange, PhoneCall, Compass, ShieldCheck, Lock, Cloud, CloudOff, Database } from 'lucide-react';
import logoImg from '../assets/images/tumblespin_header_logo.png';
import { useBusinessInfo } from '../utils/useBusinessInfo';
import { unsuspendFirestoreSync } from '../lib/firebase';

interface HeaderProps {
  onOpenBooking: () => void;
  onOpenAdmin: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  promoConfig?: {
    isEnabled: boolean;
    discountText: string;
    appliedOnText: string;
    bgColor: string;
    textColor: string;
  };
  promoDismissed?: boolean;
  onDismissPromo?: () => void;
}

export default function Header({ 
  onOpenBooking, 
  onOpenAdmin, 
  darkMode, 
  toggleDarkMode,
  promoConfig,
  promoDismissed,
  onDismissPromo
}: HeaderProps) {
  const businessInfo = useBusinessInfo();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dbSuspended, setDbSuspended] = useState(() => {
    return typeof window !== 'undefined' && localStorage.getItem('tumblespin_firestore_suspended') === 'true';
  });

  useEffect(() => {
    const handleSuspendedChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setDbSuspended(customEvent.detail);
    };
    const handleStorage = () => {
      setDbSuspended(localStorage.getItem('tumblespin_firestore_suspended') === 'true');
    };
    window.addEventListener('tumblespin_firestore_suspended_change', handleSuspendedChange as EventListener);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('tumblespin_firestore_suspended_change', handleSuspendedChange as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const checkUnread = () => {
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
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((o: any) => o && o.orderId && !deletedIds.includes(o.orderId));
            const count = filtered.filter((o: any) => o.adminViewed === false).length;
            setUnreadCount(count);
          } else {
            setUnreadCount(0);
          }
        } catch (e) {
          setUnreadCount(0);
        }
      } else {
        setUnreadCount(0);
      }
    };

    checkUnread();
    window.addEventListener('storage', checkUnread);
    return () => {
      window.removeEventListener('storage', checkUnread);
    };
  }, []);

  const navLinks = [
    { name: 'Services', href: '#services' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'Before & After', href: '#before-after' },
    { name: 'Estimator', href: '#estimator' },
    { name: 'Track Order', href: '#order-tracking' },
    { name: 'FAQ', href: '#faq' },
  ];

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 glass-header shadow-sm ${
        promoConfig?.isEnabled && !promoDismissed ? 'pt-0 pb-2' : 'py-3'
      }`}
      id="main-header"
    >
      {promoConfig?.isEnabled && !promoDismissed && (
        <div 
          className={`w-full text-[11px] sm:text-xs font-bold py-2.5 px-4 flex items-center justify-between shadow-xs transition-all ${promoConfig.bgColor} ${promoConfig.textColor}`}
          id="promo-announcement-banner"
        >
          <div className="flex-1 text-center flex items-center justify-center gap-2">
            <span className="inline-flex items-center justify-center bg-white/25 dark:bg-black/25 text-[9px] px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-extrabold font-mono shrink-0">
              Offer
            </span>
            <span className="truncate">
              <strong>{promoConfig.discountText}</strong> {promoConfig.appliedOnText}
            </span>
          </div>
          <button 
            onClick={onDismissPromo}
            className="p-1 rounded-full hover:bg-white/20 dark:hover:bg-black/20 text-current transition-colors shrink-0 ml-2"
            title="Dismiss Announcement"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${
        promoConfig?.isEnabled && !promoDismissed ? 'mt-2' : ''
      }`}>
       
        <div className="flex items-center justify-between w-full gap-4 md:gap-6">
          
          {/* Left Part: Separate Big Logo (Top Left Corner) */}
          <div className="flex items-center shrink-0" id="header-logo-container">
            <a 
              href="#" 
              className="flex items-center transition-transform duration-300 hover:scale-[1.02] shrink-0" 
              id="brand-logo-link"
            >
              <img 
                src={logoImg} 
                alt="Tumble Spin Premium Laundry" 
                className="h-14 sm:h-18 md:h-22 lg:h-26 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </a>
          </div>

          {/* Right Part: Navigation options and active actions split cleanly */}
          <div className="flex items-center justify-end gap-4 lg:gap-6 xl:gap-8 flex-1">
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-3 lg:gap-4 xl:gap-6" id="desktop-nav">
              {navLinks.map((link, idx) => (
                <a
                  key={`desk-nav-${link.name}-${idx}`}
                  href={link.href}
                  className="relative text-xs font-semibold tracking-wider uppercase text-slate-600 transition-colors hover:text-brand-primary dark:text-slate-300 dark:hover:text-brand-accent group py-1.5 whitespace-nowrap"
                >
                  {link.name}
                  <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-brand-primary transition-all duration-300 group-hover:w-full dark:bg-brand-accent" />
                </a>
              ))}
            </nav>

            {/* Subtle vertical divider */}
            <div className="hidden md:block h-6 w-px bg-slate-200 dark:bg-slate-800" />

            {/* Desktop Actions CTAs */}
            <div className="hidden md:flex items-center gap-2.5 lg:gap-3 shrink-0" id="header-ctas">
              {/* Admin Access Lock */}
              <button
                onClick={onOpenAdmin}
                className="relative rounded-xl border border-brand-primary/25 p-2 text-brand-primary hover:bg-brand-primary/5 dark:border-brand-accent/25 dark:text-brand-accent dark:hover:bg-brand-accent/5 transition-all flex items-center justify-center cursor-pointer"
                title="Admin Panel"
                id="admin-access-btn"
              >
                <Lock className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[10px] font-bold h-4.5 w-4.5 rounded-full flex items-center justify-center border border-white dark:border-slate-900 animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Main Premium CTA */}
              <button
                onClick={onOpenBooking}
                className="relative overflow-hidden rounded-full bg-slate-900 px-5 lg:px-6 py-2.5 text-xs font-extrabold tracking-wider text-white uppercase shadow-sm transition-all duration-300 hover:bg-slate-800 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 dark:bg-brand-accent dark:text-brand-deep dark:hover:bg-white cursor-pointer whitespace-nowrap"
                id="header-schedule-pickup-btn"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <CalendarRange className="h-4 w-4 shrink-0" />
                  SCHEDULE PICKUP
                </span>
              </button>
            </div>

            {/* Mobile Controls (Visible only on Mobile, aligned to the right side of header) */}
            <div className="flex items-center gap-2 md:hidden shrink-0">
              {/* Mobile Admin Access Lock */}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAdmin();
                }}
                className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-brand-teal/30 transition-all flex items-center justify-center cursor-pointer"
                title="Admin Panel"
                id="mobile-admin-access-btn"
              >
                <Lock className="h-4.5 w-4.5 text-brand-primary dark:text-brand-accent" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-rose-600 text-white text-[9px] font-bold h-4 w-4 rounded-full flex items-center justify-center border border-white dark:border-slate-900">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="rounded-full p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white transition-all cursor-pointer"
                id="mobile-menu-toggle-btn"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5.5 w-5.5" />}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Mobile Menu Full-Screen Slide-in Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed inset-0 z-50 flex flex-col justify-between bg-gradient-to-b from-[#111827]/85 via-[#2A0845]/85 to-[#0B0914]/90 text-white p-6 md:hidden h-screen backdrop-blur-xl"
            id="mobile-nav-panel"
             >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <a href="#" className="flex items-center gap-2.5" onClick={() => setMobileMenuOpen(false)}>
                <img 
                  src={logoImg} 
                  alt="Tumble Spin Premium Laundry" 
                  className="h-16 sm:h-20 w-auto object-contain"
                  referrerPolicy="no-referrer"
              />
                <span className="text-xl sm:text-2xl font-serif font-black tracking-tight text-white">
                  
                </span>
              </a>
              
              {/* Close Button with Aqua Mint Accent */}
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-full p-2.5 bg-white/5 border border-white/10 text-[#5EEAD4] hover:bg-[#5EEAD4] hover:text-[#0B0914] hover:rotate-90 transition-all duration-300"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Nav Links with Staggered Visual Feel */}
            <div className="flex-1 my-auto flex flex-col justify-center space-y-6 py-8">
              {navLinks.map((link, idx) => (
                <motion.a
                  initial={{ opacity: 0, x: 25 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + idx * 0.05, duration: 0.4 }}
                  key={`mob-nav-${link.name}-${idx}`}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="group flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 hover:bg-[#9D4EDD]/10 hover:border-[#9D4EDD]/30 p-4 text-base font-bold text-white transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[#9D4EDD] to-[#7B2CBF] text-white shadow-md shadow-[#9D4EDD]/20">
                      <Compass className="h-5 w-5" />
                    </div>
                    <span className="tracking-wide group-hover:text-[#5EEAD4] transition-colors">{link.name}</span>
                  </div>
                  <div className="text-[#5EEAD4] transform group-hover:translate-x-1.5 transition-transform">
                    <Sparkles className="h-4.5 w-4.5" />
                  </div>
                </motion.a>
              ))}
            </div>

            {/* Bottom Actions Footer */}
            <div className="border-t border-white/10 pt-6 pb-4 space-y-4">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenBooking();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#9D4EDD] to-[#5EEAD4] hover:from-[#5EEAD4] hover:to-[#9D4EDD] py-4 text-center text-sm font-bold tracking-wider text-[#0B0914] uppercase shadow-lg shadow-[#5EEAD4]/10 transition-all duration-300 active:scale-95"
                id="mobile-schedule-pickup-btn"
              >
                <CalendarRange className="h-4.5 w-4.5" />
                SCHEDULE PICKUP
              </button>
              
              <a 
                href={`tel:+91${businessInfo.phone}`} 
                className="flex items-center justify-center gap-2.5 text-center text-xs font-semibold text-[#5EEAD4] hover:text-white transition-colors py-2"
              >
                <PhoneCall className="h-4 w-4" />
                Or Call Valet: +91 {businessInfo.phone}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
