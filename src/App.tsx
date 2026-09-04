import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PhoneCall, Instagram, Facebook } from 'lucide-react';
import Header from './components/Header';
import Hero from './components/Hero';
import Services from './components/Services';
import HowItWorks from './components/HowItWorks';
import WhyChooseUs from './components/WhyChooseUs';
import ServiceQuality from './components/ServiceQuality';
import PricingPreview from './components/PricingPreview';
import { useBusinessInfo } from './utils/useBusinessInfo';
import ServiceEstimator from './components/ServiceEstimator';
import BeforeAfter from './components/BeforeAfter';
import BookingConvenience from './components/BookingConvenience';
import Testimonials from './components/Testimonials';
import OrderTracking from './components/OrderTracking';
import FAQ from './components/FAQ';
import ServiceAreasMap from './components/ServiceAreasMap';
import FinalCTA from './components/FinalCTA';
import Footer from './components/Footer';
import BookingModal from './components/BookingModal';
import AdminPanel from './components/AdminPanel';
import MembershipPackages from './components/MembershipPackages';
import { initializeFirebaseSync } from './lib/firebase';

// Exact generated image asset paths
import HERO_IMAGE_PATH from './assets/images/luxe_laundry_hero_1782710394352.jpg';
import QUALITY_IMAGE_PATH from './assets/images/garment_care_quality_1782710407845.jpg';
import APP_IMAGE_PATH from './assets/images/mobile_app_mockup_1782710421348.jpg';

export default function App() {
  const businessInfo = useBusinessInfo();
  const whatsappUrl = `https://wa.me/91${businessInfo.phone}?text=${encodeURIComponent('Hi, I am interested in Tumble Spin laundry and dry cleaning services. Please assist me!')}`;

  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>(undefined);

  // Promotional Announcement Banner Configuration (controlled by Admin)
  const [promoConfig, setPromoConfig] = useState(() => {
    const saved = localStorage.getItem('tumblespin_promo');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.error(err);
      }
    }
    return {
      isEnabled: true,
      discountText: 'First order 20% off',
      appliedOnText: 'on all dry cleaning & steam press wash services',
      bgColor: 'bg-linear-to-r from-amber-500 to-orange-600',
      textColor: 'text-white'
    };
  });

  // Dynamic Pricing Configuration (controlled by Admin)
  const [dynamicPricing, setDynamicPricing] = useState(() => {
    const saved = localStorage.getItem('tumblespin_dynamic_pricing');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.error(err);
      }
    }
    return {
      mode: 'none', // 'surcharge' | 'discount' | 'none'
      percentage: 15,
      label: 'Festival Season Demand Surcharge'
    };
  });

  const [promoDismissed, setPromoDismissed] = useState(() => {
    return localStorage.getItem('tumblespin_promo_dismissed') === 'true';
  });

  const handleUpdatePromo = (newConfig: { isEnabled: boolean; discountText: string; appliedOnText: string; bgColor: string; textColor: string }) => {
    setPromoConfig(newConfig);
    localStorage.setItem('tumblespin_promo', JSON.stringify(newConfig));
    setPromoDismissed(false);
    localStorage.setItem('tumblespin_promo_dismissed', 'false');
  };

  const handleUpdateDynamicPricing = (newConfig: { mode: 'surcharge' | 'discount' | 'none'; percentage: number; label: string }) => {
    setDynamicPricing(newConfig);
    localStorage.setItem('tumblespin_dynamic_pricing', JSON.stringify(newConfig));
    // Trigger custom storage event so other components update dynamically if they listen to it
    window.dispatchEvent(new Event('storage'));
  };

  const handleDismissPromo = () => {
    setPromoDismissed(true);
    localStorage.setItem('tumblespin_promo_dismissed', 'true');
  };
  
  // Theme state: locked to nightlight (dark mode) as requested by user
  const [darkMode, setDarkMode] = useState(true);

  // Listen to background storage events (from Firestore real-time sync)
  useEffect(() => {
    const handleStorageChange = () => {
      const savedPromo = localStorage.getItem('tumblespin_promo');
      if (savedPromo) {
        try {
          setPromoConfig(JSON.parse(savedPromo));
        } catch (err) {}
      }

      const savedPricing = localStorage.getItem('tumblespin_dynamic_pricing');
      if (savedPricing) {
        try {
          setDynamicPricing(JSON.parse(savedPricing));
        } catch (err) {}
      }

      const dismissed = localStorage.getItem('tumblespin_promo_dismissed') === 'true';
      setPromoDismissed(dismissed);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Apply dark mode (Night Light) styling to document html tag permanently
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.style.backgroundColor = '#0B0914';
    document.documentElement.style.colorScheme = 'dark';
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('tumblespin_admin_theme', 'dark');
    initializeFirebaseSync(isAdminOpen);
  }, [isAdminOpen]);

  // Update document title and description for local SEO in Bangalore
  useEffect(() => {
    document.title = 'Tumble Spin | Premium Laundry & Dry Cleaning Services in Bangalore';
    
    // Find or create description meta tag
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute(
      'content',
      'Tumble Spin offers premium laundry, eco-friendly dry cleaning, and professional steam ironing services in Bangalore. Schedule your door-to-door pickup and delivery today.'
    );

    // Add local SEO keywords meta tag if missing
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute(
      'content',
      'laundry service Bangalore, dry cleaning Bangalore, steam iron Bangalore, premium garment care, door pickup laundry, eco wash Bangalore'
    );
  }, []);

  const toggleDarkMode = () => {
    // Locked to nightlight (dark mode) as requested - daylight option is disabled
  };

  const [initialBookingQuantities, setInitialBookingQuantities] = useState<Record<string, number> | undefined>();
  const [initialBookingStep, setInitialBookingStep] = useState<number | undefined>();

  const handleOpenBooking = (serviceId?: string, quantities?: Record<string, number>, step?: number) => {
    setSelectedServiceId(serviceId);
    setInitialBookingQuantities(quantities);
    setInitialBookingStep(step);
    setIsBookingOpen(true);
  };

  const handleCloseBooking = () => {
    setIsBookingOpen(false);
    setSelectedServiceId(undefined);
    setInitialBookingQuantities(undefined);
    setInitialBookingStep(undefined);
  };

  return (
    <div className="min-h-screen bg-[#0B0914] bg-linear-to-b from-brand-dark to-[#0B0914] text-slate-100 selection:bg-brand-accent/20 selection:text-brand-accent">
      
      {/* Header / Navbar section */}
      <Header 
        onOpenBooking={() => handleOpenBooking()} 
        onOpenAdmin={() => setIsAdminOpen(true)}
        darkMode={darkMode} 
        toggleDarkMode={toggleDarkMode} 
        promoConfig={promoConfig}
        promoDismissed={promoDismissed}
        onDismissPromo={handleDismissPromo}
      />

      {/* Main Sections flow */}
      <main className="relative">
        {/* 2. Hero Section */}
        <Hero 
          onOpenBooking={() => handleOpenBooking()} 
          heroImage={HERO_IMAGE_PATH} 
        />

        {/* Services Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
        >
          <Services onSelectService={(id) => handleOpenBooking(id)} />
        </motion.div>

        {/* 8. Pricing Tariffs / Packages */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
        >
          <PricingPreview 
            onOpenBooking={() => handleOpenBooking()} 
            dynamicPricing={dynamicPricing}
          />
        </motion.div>

        {/* Membership Packages Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
        >
          <MembershipPackages onOpenBooking={() => handleOpenBooking()} />
        </motion.div>

        {/* 5. How It Works Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
        >
          <HowItWorks />
        </motion.div>

        {/* 6. Why Choose Us (Bento Features) */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
        >
          <WhyChooseUs />
        </motion.div>

        {/* 7. Service Quality / Storytelling */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
        >
          <ServiceQuality qualityImage={QUALITY_IMAGE_PATH} />
        </motion.div>

        {/* 8b. Interactive Service Estimator */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
        >
          <ServiceEstimator onOpenBooking={handleOpenBooking} />
        </motion.div>

        {/* Before & After Restoration Gallery */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
        >
          <BeforeAfter />
        </motion.div>

        {/* 9. Mobile App Booking Convenience */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
        >
          <BookingConvenience appImage={APP_IMAGE_PATH} />
        </motion.div>

        {/* 10. Patron Testimonials */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
        >
          <Testimonials />
        </motion.div>

        {/* 10b. Real-time Order Tracker */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
        >
          <OrderTracking />
        </motion.div>

        {/* 10c. Interactive Bangalore Service Areas Map */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
        >
          <ServiceAreasMap />
        </motion.div>

        {/* 11. FAQ Accordions */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
        >
          <FAQ />
        </motion.div>

        {/* 12. Final High Conversion CTA */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
        >
          <FinalCTA onOpenBooking={() => handleOpenBooking()} />
        </motion.div>
      </main>

      {/* 13. Deep Footer */}
      <Footer />

      {/* Bespoke interactive Booking Wizard Modal */}
      <AnimatePresence>
        {isBookingOpen && (
          <BookingModal 
            isOpen={isBookingOpen} 
            onClose={handleCloseBooking} 
            initialServiceId={selectedServiceId}
            initialQuantities={initialBookingQuantities}
            initialStep={initialBookingStep}
            dynamicPricing={dynamicPricing}
          />
        )}
      </AnimatePresence>

      {/* Protected Admin Console Overlay */}
      <AdminPanel 
        isOpen={isAdminOpen} 
        onClose={() => setIsAdminOpen(false)} 
        promoConfig={promoConfig}
        onUpdatePromo={handleUpdatePromo}
        dynamicPricing={dynamicPricing}
        onUpdateDynamicPricing={handleUpdateDynamicPricing}
      />

      {/* Dual Floating Contacts Button Stack (Right-aligned) */}
      <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-3.5 items-end">
        {/* Instagram Floating Button */}
        <a
          href="https://www.instagram.com/tumblespinofficial?igsh=MTdjNnFzZ2xxdWhpcw=="
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#962fbf] text-white shadow-2xl hover:scale-110 active:scale-95 hover:shadow-[#d62976]/30 hover:shadow-lg transition-all duration-300 group"
          title="Follow us on Instagram"
          id="floating-instagram-btn"
        >
          <span className="absolute right-full mr-3 px-3 py-1.5 rounded-lg bg-slate-900/90 dark:bg-slate-900/95 text-white text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none shadow-md">
            Follow on Instagram 📸
          </span>
          <Instagram className="h-5.5 w-5.5" />
        </a>

        {/* Facebook Floating Button */}
        <a
          href="https://www.facebook.com/share/19C7X7vouz/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center h-12 w-12 rounded-full bg-[#1877F2] text-white shadow-2xl hover:scale-110 active:scale-95 hover:shadow-[#1877F2]/30 hover:shadow-lg transition-all duration-300 group"
          title="Follow us on Facebook"
          id="floating-facebook-btn"
        >
          <span className="absolute right-full mr-3 px-3 py-1.5 rounded-lg bg-slate-900/90 dark:bg-slate-900/95 text-white text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none shadow-md">
            Follow on Facebook 👥
          </span>
          <Facebook className="h-5.5 w-5.5" />
        </a>

        {/* Call Now Floating Button */}
        <a
          href={`tel:+91${businessInfo.phone}`}
          className="flex items-center justify-center h-13 w-13 rounded-full bg-brand-primary text-white shadow-2xl hover:scale-110 active:scale-95 hover:shadow-brand-primary/30 hover:shadow-lg transition-all duration-300 group dark:bg-brand-accent dark:text-brand-deep"
          title="Call us directly"
          id="floating-call-btn"
        >
          <span className="absolute right-full mr-3 px-3 py-1.5 rounded-lg bg-slate-900/90 dark:bg-slate-900/95 text-white text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none shadow-md">
            Call Tumble Spin 📞
          </span>
          <PhoneCall className="h-5.5 w-5.5 animate-bounce" />
        </a>

        {/* WhatsApp Floating Button */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center h-14 w-14 rounded-full bg-[#25D366] text-white shadow-2xl hover:scale-110 active:scale-95 hover:shadow-[#25D366]/30 hover:shadow-lg transition-all duration-300 group"
          title="Chat with us on WhatsApp"
          id="floating-whatsapp-btn"
        >
          <span className="absolute right-full mr-3 px-3 py-1.5 rounded-lg bg-slate-900/90 dark:bg-slate-900/95 text-white text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none shadow-md">
            Chat on WhatsApp 💬
          </span>
          <svg
            className="h-7 w-7 fill-current"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.501-5.734-1.453L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.968C16.628 3.971 14.156 2.95 11.53 2.95c-5.44 0-9.866 4.372-9.87 9.802 0 1.764.486 3.486 1.407 4.981L2.093 21.07l3.52-.916h.034zm13.107-7.234c-.279-.14-.1.652-.279.14-.139-.07-.822-.404-1.096-.54s-.465-.203-.663.093c-.198.297-.768.962-.94 1.16-.173.199-.347.223-.626.082-.279-.14-1.18-.435-2.247-1.388-.83-.74-1.39-1.653-1.553-1.933-.163-.28-.018-.431.122-.571.125-.126.28-.324.419-.487.139-.162.186-.279.279-.465.093-.186.046-.349-.023-.488-.07-.14-.663-1.602-.91-2.193-.24-.58-.503-.5-.688-.51l-.524-.01c-.186 0-.488.07-.744.349-.256.279-.977.954-.977 2.328s1.001 2.701 1.14 2.887c.14.186 1.97 3.01 4.773 4.218.667.288 1.188.46 1.594.59.67.213 1.28.183 1.762.11.537-.08 1.653-.675 1.885-1.326.232-.652.232-1.21.163-1.326-.07-.11-.256-.18-.535-.32z"/>
          </svg>
        </a>
      </div>
    </div>
  );
}
