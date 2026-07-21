import React from 'react';
import { CalendarCheck, Sparkles, MapPin } from 'lucide-react';

interface FinalCTAProps {
  onOpenBooking: () => void;
}

export default function FinalCTA({ onOpenBooking }: FinalCTAProps) {
  return (
    <section 
      className="relative py-24 bg-slate-950 dark:bg-brand-dark overflow-hidden text-center" 
      id="final-cta"
    >
      {/* Intense glowing aqua background blobs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-brand-primary/30 blur-3xl pointer-events-none" />
      <div className="absolute -top-12 -left-12 w-80 h-80 rounded-full bg-brand-accent/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -right-12 w-80 h-80 rounded-full bg-brand-secondary/15 blur-3xl pointer-events-none" />

      {/* Floating bubbles */}
      <div className="absolute top-[20%] left-[10%] w-3 h-3 rounded-full bg-brand-accent opacity-30 animate-pulse" />
      <div className="absolute bottom-[30%] right-[15%] w-4 h-4 rounded-full bg-brand-secondary opacity-45 animate-pulse" />
      <div className="absolute top-[60%] right-[8%] w-2.5 h-2.5 rounded-full bg-brand-accent opacity-25 animate-pulse" />

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 relative z-10 space-y-6">
        
        {/* Upper badge */}
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-accent/10 px-4 py-1.5 border border-brand-accent/20">
          <Sparkles className="h-4 w-4 text-brand-accent" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-accent font-mono">
            SECURE YOUR RESERVATION
          </span>
        </div>

        {/* Headline */}
        <h2 className="text-3xl sm:text-5xl font-serif text-white font-medium tracking-tight max-w-2xl mx-auto leading-tight">
          From everyday outfits to special pieces, we keep it fresh.
        </h2>

        {/* Subtext */}
        <p className="text-sm sm:text-base text-slate-300 max-w-lg mx-auto leading-relaxed">
          Schedule your contactless valet pickup in under 60 seconds. Our textile experts are ready to inspect, sanitize, and polish your wardrobe.
        </p>

        {/* CTA Button */}
        <div className="pt-4 flex flex-col items-center gap-3">
          <button
            onClick={onOpenBooking}
            className="flex items-center gap-2 rounded-full bg-linear-to-r from-brand-secondary to-brand-accent px-10 py-4.5 text-xs sm:text-sm font-extrabold tracking-widest text-brand-deep uppercase shadow-xl hover:shadow-2xl hover:scale-103 transition-all"
            id="final-cta-schedule-btn"
          >
            <CalendarCheck className="h-5 w-5 stroke-[2.2]" />
            Schedule Your Pickup Today
          </button>
          
          <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 font-mono">
            <MapPin className="h-4 w-4 text-brand-secondary" />
            No prepayments required • Free courier cancellation
          </p>
        </div>

      </div>
    </section>
  );
}
