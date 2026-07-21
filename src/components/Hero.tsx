import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { Sparkles, Calendar, ArrowRight } from 'lucide-react';

interface HeroProps {
  onOpenBooking: () => void;
  heroImage: string;
}

export default function Hero({ onOpenBooking, heroImage }: HeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const badgesRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const wave1Ref = useRef<SVGPathElement>(null);
  const wave2Ref = useRef<SVGPathElement>(null);

  useEffect(() => {
    // Only run if elements exist
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      // Set initial states
      gsap.set([titleRef.current, subtitleRef.current, actionsRef.current, badgesRef.current], {
        opacity: 0,
        y: 25,
      });
      gsap.set(imageContainerRef.current, {
        opacity: 0,
        scale: 1.05,
      });

      // Master Timeline
      const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 1.2 } });

      tl.to(imageContainerRef.current, { opacity: 1, scale: 1, duration: 1.6 })
        .to(titleRef.current, { opacity: 1, y: 0 }, '-=1.2')
        .to(subtitleRef.current, { opacity: 1, y: 0 }, '-=0.9')
        .to(actionsRef.current, { opacity: 1, y: 0 }, '-=0.9')
        .to(badgesRef.current, { opacity: 1, y: 0 }, '-=1.0');

      // Check prefers-reduced-motion
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!prefersReducedMotion) {
        // Floating bubble loop
        gsap.to('.bubble-float-1', {
          y: -15,
          x: 10,
          duration: 4,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut'
        });
        gsap.to('.bubble-float-2', {
          y: 12,
          x: -12,
          duration: 5,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: 0.5
        });
        gsap.to('.bubble-float-3', {
          y: -8,
          x: -8,
          duration: 4.5,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: 1
        });

        // Subtle low-opacity wave shift animation
        if (wave1Ref.current) {
          gsap.to(wave1Ref.current, {
            x: -80,
            duration: 12,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
          });
        }
        if (wave2Ref.current) {
          gsap.to(wave2Ref.current, {
            x: 80,
            duration: 16,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
          });
        }
      }
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section 
      ref={containerRef}
      className="relative min-h-screen flex items-center justify-center pt-24 pb-16 overflow-hidden bg-[#CEE8FA] dark:bg-brand-dark"
      id="hero"
    >
      {/* Full-Cover Background Image Container */}
      <div 
        ref={imageContainerRef}
        className="absolute inset-0 z-0 select-none overflow-hidden"
      >
        <img 
          src={heroImage} 
          alt="Tumble Spin Premium Laundry Experience" 
          className="w-full h-full object-cover object-center opacity-25 lg:opacity-100 blur-2xl lg:blur-none transition-all duration-700"
          referrerPolicy="no-referrer"
        />
        
        {/* Soft elegant gradient overlays to protect text on left edge, keeping the actual image 100% clear on the right */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/85 via-white/50 to-transparent dark:from-brand-dark/90 dark:via-brand-dark/65 dark:to-transparent hidden lg:block" />
        
        {/* Mobile ambient overlays for extra readability */}
        <div className="absolute inset-0 bg-white/40 dark:bg-brand-dark/60 lg:hidden" />
        
        {/* Ambient top/bottom gradients for header and footer contrast */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/30 to-transparent dark:from-brand-dark/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#CEE8FA]/40 to-transparent dark:from-brand-dark/50 to-transparent" />
      </div>

      {/* Floating physical glass bubbles representing premium wash bubbles */}
      <div className="bubble-float-1 absolute top-[20%] left-[5%] hidden lg:flex items-center gap-2 rounded-full glass-card px-4 py-2 border border-brand-primary/10 shadow-xs backdrop-blur-md z-10">
        <span className="flex h-2.5 w-2.5 rounded-full bg-brand-secondary animate-pulse" />
        <span className="text-[10px] font-bold tracking-widest text-slate-700 dark:text-slate-200 uppercase font-mono">ECO-SAFE FLUIDS</span>
      </div>

      <div className="bubble-float-2 absolute bottom-[15%] left-[35%] hidden lg:flex items-center gap-2 rounded-full glass-card px-4 py-2 border border-brand-primary/10 shadow-xs backdrop-blur-md z-10">
        <Sparkles className="h-4 w-4 text-brand-secondary" />
        <span className="text-[10px] font-bold tracking-widest text-slate-700 dark:text-slate-200 uppercase font-mono">100% FIBER RESILIENCE</span>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-20 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Left Column: Text content */}
          <div className="lg:col-span-8 xl:col-span-7 space-y-6 text-left relative z-20">
            <div className="relative overflow-hidden bg-white/90 dark:bg-brand-dark/95 p-6 sm:p-0 sm:bg-transparent sm:dark:bg-transparent sm:backdrop-blur-none rounded-3xl border-none shadow-xl sm:shadow-none min-h-[480px]">
              
              {/* Mobile background image inside the card, completely visible and non-blurred */}
              <div className="absolute inset-0 z-0 sm:hidden select-none pointer-events-none">
                <img 
                  src={heroImage} 
                  alt="Tumble Spin Premium Laundry Experience" 
                  className="w-full h-full object-cover object-center opacity-100 transition-all duration-700"
                  referrerPolicy="no-referrer"
                />
                {/* Clean elegant overlay to ensure 100% text legibility while keeping the underlying image completely sharp and visible */}
                <div className="absolute inset-0 bg-linear-to-b from-white/85 via-white/70 to-white/90 dark:from-brand-dark/90 dark:via-brand-dark/75 dark:to-brand-dark/95" />
              </div>

              {/* Ensure all child elements are relative z-10 so they render beautifully on top of the background image */}
              <div className="relative z-10 space-y-6">
                {/* Upper Badge */}
                <div className="flex items-center gap-4 text-slate-950 dark:text-brand-accent">
                  <span className="h-[1.5px] w-12 bg-slate-950 dark:bg-brand-accent"></span>
                  <span className="text-xs uppercase tracking-[0.35em] font-extrabold font-sans drop-shadow-xs">
                    Doorstep Laundry & Dry Clean - Bangalore
                  </span>
                </div>

                {/* Headline */}
                <h1 
                  ref={titleRef}
                  className="title-clamp font-serif text-slate-950 dark:text-white font-black tracking-tight drop-shadow-xs"
                >
                  Fresh care for<br />
                  busy <span className="italic font-normal text-brand-primary dark:text-brand-accent">days.</span>
                </h1>

                {/* Subtext */}
                <p 
                  ref={subtitleRef}
                  className="text-base sm:text-lg text-slate-900 dark:text-slate-100 max-w-xl font-bold leading-relaxed font-sans drop-shadow-xs"
                >
                  Book a pickup, leave the cleaning to us, and get your clothes back soft, crisp, and ready to wear. Built for professionals, students, and families who want quality care with less effort.
                </p>

                {/* CTAs */}
                <div 
                  ref={actionsRef}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2"
                >
                  <button
                    onClick={onOpenBooking}
                    className="flex items-center justify-center gap-2 rounded-full bg-linear-to-r from-brand-primary to-brand-secondary px-8 py-4 text-sm font-bold tracking-wider text-white uppercase shadow-lg shadow-brand-primary/25 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 dark:from-brand-accent dark:to-brand-secondary dark:text-brand-deep dark:hover:from-white dark:hover:to-white"
                    id="hero-book-pickup-btn"
                  >
                    <Calendar className="h-4.5 w-4.5" />
                    Book Doorstep Pickup
                  </button>
                  
                  <a
                    href="#services"
                    className="flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-8 py-4 text-sm font-bold tracking-wider text-slate-700 uppercase backdrop-blur-md transition-all duration-300 hover:bg-white hover:border-slate-300 hover:-translate-y-0.5 dark:border-brand-accent/30 dark:bg-brand-dark/60 dark:text-slate-200 dark:hover:bg-brand-dark"
                    id="hero-view-services-btn"
                  >
                    Explore Services
                    <ArrowRight className="h-4 w-4 text-brand-primary" />
                  </a>
                </div>

                {/* Lower Badges */}
                <div 
                  ref={badgesRef}
                  className="flex flex-wrap items-center gap-6 sm:gap-10 pt-6 border-t border-slate-200/60 dark:border-brand-teal/20"
                  id="hero-trust-indicators"
                >
                  <div className="flex flex-col">
                    <span className="font-serif text-3xl sm:text-4xl text-brand-primary dark:text-brand-accent font-semibold leading-none">24h</span>
                    <span className="text-[9px] uppercase tracking-widest text-slate-600 dark:text-slate-300 font-bold font-sans mt-1">Express Valet</span>
                  </div>
                  <div className="w-[1px] h-8 bg-slate-200 dark:bg-brand-teal/20 shrink-0"></div>
                  <div className="flex flex-col">
                    <span className="font-serif text-3xl sm:text-4xl text-brand-primary dark:text-brand-accent font-semibold leading-none">100%</span>
                    <span className="text-[9px] uppercase tracking-widest text-slate-600 dark:text-slate-300 font-bold font-sans mt-1">Eco Solvents</span>
                  </div>
                </div>
              </div>

            </div>
          </div>



        </div>
      </div>

      {/* Subtle Low-Opacity Wave Animation Backdrop */}
      <div className="absolute bottom-0 left-0 right-0 overflow-hidden h-16 w-full pointer-events-none z-10 select-none">
        <svg viewBox="0 0 1440 120" fill="none" className="absolute bottom-0 w-[120%] h-full min-w-[1200px]" preserveAspectRatio="none">
          <path
            ref={wave1Ref}
            d="M0,32L120,42.7C240,53,480,75,720,74.7C960,75,1200,53,1320,42.7L1440,32L1440,120L1320,120C1200,120,960,120,720,120C480,120,240,120,120,120L0,120Z"
            fill="currentColor"
            className="text-brand-primary/10 dark:text-brand-accent/5"
          />
          <path
            ref={wave2Ref}
            d="M0,64L120,58.7C240,53,480,43,720,48C960,53,1200,75,1320,85.3L1440,96L1440,120L1320,120C1200,120,960,120,720,120C480,120,240,120,120,120L0,120Z"
            fill="currentColor"
            className="text-brand-secondary/10 dark:text-brand-primary/5"
          />
        </svg>
      </div>

    </section>
  );
}
