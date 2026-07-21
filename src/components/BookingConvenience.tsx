import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Phone, Compass, MapPin, Bell, RefreshCw, Heart, Calendar } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface BookingConvenienceProps {
  appImage: string;
}

export default function BookingConvenience({ appImage }: BookingConvenienceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      // Floating animation for mock phone
      gsap.to(mockupRef.current, {
        y: -12,
        duration: 5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });

      // Stagger list elements reveal
      gsap.from('.app-text-reveal', {
        x: 40,
        opacity: 0,
        duration: 1.2,
        stagger: 0.15,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top 75%',
          toggleActions: 'play none none none'
        }
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const features = [
    {
      title: 'GPS Valet Courier Tracking',
      desc: 'Track our luxury hybrid delivery vehicles in real-time. Receive an SMS notification 15 minutes before valet arrival.',
      icon: <Compass className="h-5.5 w-5.5 text-brand-primary dark:text-brand-accent" />
    },
    {
      title: 'Automated Cycle Milestones',
      desc: 'Receive digital updates as your garments complete each phase: Valet Collection, Fabric Inspection, Wet-solvent Processing, Hand Finishing, and Return Transit.',
      icon: <Bell className="h-5.5 w-5.5 text-brand-secondary" />
    },
    {
      title: 'One-Click Recurring Pickups',
      desc: 'Configure your weekly, bi-weekly, or custom interval automatic collection schedules. Maintain pristine garments without opening the app.',
      icon: <Calendar className="h-5.5 w-5.5 text-brand-primary dark:text-brand-accent" />
    }
  ];

  return (
    <section 
      ref={containerRef}
      className="relative py-24 bg-brand-light/30 dark:bg-brand-deep/5 overflow-hidden"
      id="app-convenience"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left: Mobile phone mockup */}
          <div className="lg:col-span-5 flex justify-center order-last lg:order-first">
            <div 
              ref={mockupRef}
              className="relative w-full max-w-[320px] rounded-[40px] p-3.5 bg-slate-900 shadow-2xl border-4 border-slate-800 dark:border-slate-950 aspect-[9/16] overflow-hidden"
              id="mockup-phone-frame"
            >
              {/* Camera Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-2xl z-30" />
              
              {/* Phone Inner Screen (Interactive Tumble Spin Mobile Dashboard) */}
              <div className="relative w-full h-full rounded-[30px] overflow-hidden bg-slate-950 text-white font-sans flex flex-col p-4 select-none">
                {/* Simulated Phone Status Bar */}
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium pb-2 pt-1.5 shrink-0 z-20">
                  <span>9:41</span>
                  <div className="flex items-center gap-1.5">
                    {/* Signal icon */}
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M2 22h20V2z"/>
                    </svg>
                    {/* Wifi icon */}
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 21l-12-12c4.4-4.4 11.6-4.4 16 0z"/>
                    </svg>
                    {/* Battery icon */}
                    <div className="w-5 h-2.5 border border-slate-500 rounded-sm p-0.5 flex items-center">
                      <div className="h-full w-full bg-slate-300 rounded-xs" />
                    </div>
                  </div>
                </div>

                {/* Dashboard Scrollable App Area */}
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pt-1 pb-4 text-left">
                  {/* App Header */}
                  <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                    <div>
                      <span className="text-[10px] text-teal-400 font-mono tracking-widest uppercase font-bold block">
                        Now Active
                      </span>
                      <h3 className="font-serif text-lg font-black tracking-tight text-white leading-none mt-0.5">
                        Tumble <span className="text-teal-400">Spin</span>
                      </h3>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 text-xs font-bold">
                      TS
                    </div>
                  </div>

                  {/* Welcome banner */}
                  <div className="bg-linear-to-r from-teal-950/40 to-slate-900/60 border border-teal-500/10 rounded-2xl p-3.5 space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold block">GREETINGS,</span>
                    <h4 className="text-sm font-bold text-white">Jayanth Gowda</h4>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Your premium garments are being pampered under master care.
                    </p>
                  </div>

                  {/* Dynamic Order Status Card */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 space-y-3 relative overflow-hidden">
                    {/* Background glow */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full filter blur-xl pointer-events-none" />

                    <div className="flex justify-between items-center relative z-10">
                      <div>
                        <span className="text-[9px] text-slate-400 font-mono uppercase block">Active Tracking</span>
                        <span className="text-xs font-black text-white font-mono">TS-2026-103</span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-[9px] font-extrabold uppercase animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                        In Transit
                      </span>
                    </div>

                    {/* Progress Dots */}
                    <div className="flex items-center gap-1.5 pt-1 relative z-10">
                      <div className="flex-1 h-1 bg-teal-400 rounded-full" />
                      <div className="flex-1 h-1 bg-teal-400 rounded-full" />
                      <div className="flex-1 h-1 bg-slate-700 rounded-full animate-pulse" />
                      <div className="flex-1 h-1 bg-slate-800 rounded-full" />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 relative z-10">
                      <div>
                        <span className="text-slate-500 block">Valet Assigned:</span>
                        <span className="font-semibold text-slate-200">Arjun Gowda</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block">Pickup Slot:</span>
                        <span className="font-semibold text-slate-200">Today, 5-7 PM</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick stats / feature grids */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-2.5 flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                        <svg className="h-4 w-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-500 uppercase block font-semibold">ECO SCORE</span>
                        <span className="text-xs font-black text-white">A+ certified</span>
                      </div>
                    </div>

                    <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-2.5 flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                        <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-500 uppercase block font-semibold">RESTORED</span>
                        <span className="text-xs font-black text-white">94 items</span>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Services Picker */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Care programs available</span>
                    <div className="space-y-1.5 text-xs">
                      <div className="bg-slate-900/50 hover:bg-slate-900 border border-slate-800/60 p-2.5 rounded-xl flex items-center justify-between transition-colors cursor-pointer group">
                        <div className="flex items-center gap-2.5">
                          <span className="h-2 w-2 rounded-full bg-teal-400" />
                          <span className="font-semibold text-slate-200">Saree & Couture Care</span>
                        </div>
                        <span className="text-[10px] text-slate-500 group-hover:text-teal-400 transition-colors">Select &rarr;</span>
                      </div>

                      <div className="bg-slate-900/50 hover:bg-slate-900 border border-slate-800/60 p-2.5 rounded-xl flex items-center justify-between transition-colors cursor-pointer group">
                        <div className="flex items-center gap-2.5">
                          <span className="h-2 w-2 rounded-full bg-blue-400" />
                          <span className="font-semibold text-slate-200">Organic Dry Cleaning</span>
                        </div>
                        <span className="text-[10px] text-slate-500 group-hover:text-blue-400 transition-colors">Select &rarr;</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Glass Glare */}
                <div className="absolute top-0 -left-1/2 w-[200%] h-full bg-linear-to-tr from-transparent via-white/5 to-transparent rotate-30 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Right: Feature listing and description */}
          <div className="lg:col-span-7 text-left space-y-6">
            <span className="app-text-reveal text-xs font-bold tracking-widest text-brand-primary uppercase dark:text-brand-accent font-mono block">
              EFFORTLESS SMART CONVENIENCE
            </span>
            <h2 className="app-text-reveal section-title-clamp font-serif text-slate-900 dark:text-white font-medium">
              A premium laundry valet on your digital dashboard.
            </h2>
            <div className="app-text-reveal w-16 h-1 bg-brand-primary dark:bg-brand-accent rounded-full" />
            <p className="app-text-reveal text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              We engineered our reservation engine around complete, fluid transparency. No generic notifications or vague time-slots. Know exactly when your valet arrives and when your garments are secured in our high-security facilities.
            </p>

            {/* List */}
            <div className="space-y-6 pt-4" id="app-highlights-list">
              {features.map((feat) => (
                <div key={feat.title} className="app-text-reveal flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    {feat.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-950 dark:text-white">
                      {feat.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-200 leading-relaxed mt-1">
                      {feat.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

          </div>

        </div>
      </div>
    </section>
  );
}
