import React, { useEffect, useRef } from 'react';
import { Mail, Phone, MapPin, Clock, ArrowUp, Send, Heart, Instagram, Facebook } from 'lucide-react';
import { gsap } from 'gsap';
import logoImg from '../assets/images/tumblespin_header_logo.png';
import { useBusinessInfo } from '../utils/useBusinessInfo';

export default function Footer() {
  const businessInfo = useBusinessInfo();
  const currentYear = new Date().getFullYear();
  const footerRef = useRef<HTMLDivElement>(null);
  const wave1Ref = useRef<SVGPathElement>(null);
  const wave2Ref = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (!footerRef.current) return;

    const ctx = gsap.context(() => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!prefersReducedMotion) {
        if (wave1Ref.current) {
          gsap.to(wave1Ref.current, {
            x: -80,
            duration: 14,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
          });
        }
        if (wave2Ref.current) {
          gsap.to(wave2Ref.current, {
            x: 80,
            duration: 18,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
          });
        }
      }
    }, footerRef);

    return () => ctx.revert();
  }, []);

  const handleScrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer 
      ref={footerRef}
      className="relative bg-slate-900 text-slate-300 dark:bg-brand-dark pt-16 pb-12 border-t border-slate-800 dark:border-brand-teal/20 overflow-hidden" 
      id="main-footer"
    >
      {/* Subtle Low-Opacity Wave Animation Backdrop inside Footer */}
      <div className="absolute top-0 left-0 right-0 overflow-hidden h-12 w-full pointer-events-none opacity-20 select-none">
        <svg viewBox="0 0 1440 120" fill="none" className="absolute top-0 w-[120%] h-full min-w-[1200px]" preserveAspectRatio="none">
          <path
            ref={wave1Ref}
            d="M0,32L120,42.7C240,53,480,75,720,74.7C960,75,1200,53,1320,42.7L1440,32L1440,120L1320,120C1200,120,960,120,720,120C480,120,240,120,120,120L0,120Z"
            fill="currentColor"
            className="text-brand-primary dark:text-brand-accent"
          />
          <path
            ref={wave2Ref}
            d="M0,64L120,58.7C240,53,480,43,720,48C960,53,1200,75,1320,85.3L1440,96L1440,120L1320,120C1200,120,960,120,720,120C480,120,240,120,120,120L0,120Z"
            fill="currentColor"
            className="text-brand-secondary dark:text-brand-primary"
          />
        </svg>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Upper footer columns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-slate-800 dark:border-brand-teal/10">
          
          {/* Col 1: Brand intro */}
          <div className="space-y-4">
            <div className="flex items-center">
              <img 
                src={logoImg} 
                alt="Tumble Spin Premium Laundry" 
                className="h-10 sm:h-12 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-medium">
              Acclaimed door-to-door garment sanitization, restoring structural fibers, color fastness, and texture using non-toxic biodegradable solvent wet-cleansers in Bangalore.
            </p>

            <div className="flex items-center gap-4 pt-1">
              <a 
                href="https://www.instagram.com/tumblespinofficial?igsh=MTdjNnFzZ2xxdWhpcw==" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-slate-300 hover:text-rose-500 transition-colors flex items-center gap-1.5"
                title="Follow Tumble Spin on Instagram"
              >
                <Instagram className="h-5 w-5" />
                <span className="text-xs sm:text-sm uppercase font-mono font-bold tracking-wider">Instagram</span>
              </a>
              <a 
                href="https://www.facebook.com/share/19C7X7vouz/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-slate-300 hover:text-blue-500 transition-colors flex items-center gap-1.5"
                title="Follow Tumble Spin on Facebook"
              >
                <Facebook className="h-5 w-5" />
                <span className="text-xs sm:text-sm uppercase font-mono font-bold tracking-wider">Facebook</span>
              </a>
            </div>

            <p className="text-xs sm:text-sm text-slate-400 flex items-center gap-1.5 pt-1">
              Made with <Heart className="h-4 w-4 text-rose-500 fill-rose-500" /> in Bangalore, India
            </p>
          </div>

          {/* Col 2: Services links */}
          <div className="space-y-4">
            <h4 className="text-sm sm:text-base font-extrabold text-white tracking-wider uppercase font-mono">
              Care Programs
            </h4>
            <ul className="space-y-3 text-sm sm:text-base text-slate-300">
              <li><a href="#services" className="hover:text-brand-accent transition-colors font-medium">Individual Wash & Fold</a></li>
              <li><a href="#services" className="hover:text-brand-accent transition-colors font-medium">Eco-solvent Dry Cleaning</a></li>
              <li><a href="#services" className="hover:text-brand-accent transition-colors font-medium">Business Wash & Iron</a></li>
              <li><a href="#services" className="hover:text-brand-accent transition-colors font-medium">Artisan Hand Steam Press</a></li>
              <li><a href="#services" className="hover:text-brand-accent transition-colors font-medium">Couture Archival Care</a></li>
            </ul>
          </div>

          {/* Col 3: Contact details */}
          <div className="space-y-4" id="footer-contact-info">
            <h4 className="text-sm sm:text-base font-extrabold text-white tracking-wider uppercase font-mono">
              Valet Concierge
            </h4>
            <ul className="space-y-3.5 text-sm sm:text-base text-slate-300">
              <li className="flex items-center gap-2.5">
                <Phone className="h-5 w-5 text-brand-secondary shrink-0" />
                <a href={`tel:+91${businessInfo.phone}`} className="hover:text-white transition-colors font-medium">+91 {businessInfo.phone}</a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-5 w-5 text-brand-secondary shrink-0" />
                <a href="mailto:tumblespin26@gmail.com" className="hover:text-white transition-colors font-medium">tumblespin26@gmail.com</a>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="h-5 w-5 text-brand-secondary shrink-0 mt-1" />
                <div className="space-y-2">
                  <span className="font-medium">{businessInfo.address}</span>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Tumble Spin, #6, 80 feet road, Kengeri Ring Rd, Mariyappana Palya, Bengaluru, Karnataka 560056")}`}
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-500/10 border border-teal-500/25 hover:bg-teal-500/20 text-teal-400 hover:text-teal-300 transition-all text-xs font-mono font-bold uppercase tracking-wider w-fit"
                    title="Open in Google Maps"
                  >
                    <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    Open in Google Maps
                  </a>
                </div>
              </li>
              <li className="flex items-center gap-2.5">
                <Clock className="h-5 w-5 text-brand-secondary shrink-0" />
                <span className="font-medium">Daily: 9:00 AM - 9:00 PM</span>
              </li>
            </ul>
          </div>

          {/* Col 4: Newsletter */}
          <div className="space-y-4">
            <h4 className="text-sm sm:text-base font-extrabold text-white tracking-wider uppercase font-mono">
              Exclusive Journal
            </h4>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-medium">
              Subscribe to receive sartorial styling guides, linen care insights, and seasonal promotion codes.
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="flex h-11 rounded-full overflow-hidden bg-slate-800 dark:bg-slate-900 border border-slate-700 dark:border-brand-teal/20" id="newsletter-form">
              <input 
                type="email" 
                placeholder="aristotle@wardrobe.com" 
                className="w-full bg-transparent px-4 text-sm focus:outline-hidden text-white"
                required
              />
              <button 
                type="submit"
                className="bg-brand-primary hover:bg-brand-secondary text-white px-4 flex items-center justify-center transition-colors shrink-0"
                aria-label="Submit email to newsletter"
              >
                <Send className="h-4.5 w-4.5" />
              </button>
            </form>
          </div>

        </div>

        {/* Lower footer copyright & legal */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-slate-400">
          
          <div>
            © {currentYear} Tumble Spin Laundry Services Pvt. Ltd. All rights reserved.
          </div>

          <div className="flex gap-5">
            <a href="#" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Care Guarantee</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Sitemap</a>
          </div>

          {/* Back to top bubble */}
          <button
            onClick={handleScrollTop}
            className="rounded-full bg-slate-800 p-2.5 hover:bg-slate-700 text-slate-400 hover:text-white transition-all shadow-md flex items-center justify-center"
            id="back-to-top-btn"
            aria-label="Scroll back to top"
          >
            <ArrowUp className="h-4 w-4" />
          </button>

        </div>

      </div>
    </footer>
  );
}
