import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Check, Sparkles, Feather, Archive, Trees } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface ServiceQualityProps {
  qualityImage: string;
}

export default function ServiceQuality({ qualityImage }: ServiceQualityProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      // Animate left column (images)
      gsap.from(leftColRef.current, {
        x: -50,
        opacity: 0,
        duration: 1.2,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
          toggleActions: 'play none none none',
        }
      });

      // Animate right column content (staggered list)
      gsap.from('.quality-text-reveal', {
        y: 30,
        opacity: 0,
        duration: 1,
        stagger: 0.15,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: rightColRef.current,
          start: 'top 80%',
          toggleActions: 'play none none none',
        }
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const qualityPoints = [
    {
      title: 'Biodegradable Wet-Solvents',
      desc: 'We replaced traditional chemical solvents like Perchloroethylene (Perc)—a known carcinogen—with pure softened water and plant-derived, biodegradable surfactant cleansers.',
      icon: <Trees className="h-5 w-5 text-emerald-500" />
    },
    {
      title: 'Precision Micro-Mist Finishing',
      desc: 'Instead of raw mechanical crushing presses, our specialists use precise artisan irons with micro-misted water vapors to smooth fibers gently on contoured shapes.',
      icon: <Feather className="h-5 w-5 text-brand-secondary" />
    },
    {
      title: 'Couture Acid-Free Archival Packing',
      desc: 'Garments are delivered on custom-molded thick hangers, wrapped in breathable acid-free garment wrappers that prevent fiber discoloration and yellowing.',
      icon: <Archive className="h-5 w-5 text-brand-primary" />
    }
  ];

  return (
    <section 
      ref={sectionRef}
      className="relative py-24 bg-brand-light/30 dark:bg-brand-deep/5 overflow-hidden"
      id="service-quality"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Layered Visual Assets */}
          <div 
            ref={leftColRef}
            className="lg:col-span-5 relative"
            id="quality-visual-layered"
          >
            {/* Ambient Background Glow */}
            <div className="absolute -inset-6 bg-brand-accent/20 rounded-2xl blur-2xl opacity-50 dark:opacity-30" />

            {/* Main Image Card */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/20 dark:border-slate-800 aspect-3/4">
              <img 
                src={qualityImage} 
                alt="Expert garment steaming and couture care" 
                className="w-full h-full object-cover transition-transform duration-1000 hover:scale-102"
                referrerPolicy="no-referrer"
              />
              {/* Soft Aqua overlay mask */}
              <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/40 via-transparent to-brand-primary/10 mix-blend-multiply" />
            </div>

            {/* Layered Floating Card 1: Steam Stat */}
            <div className="absolute top-8 -right-8 hidden sm:flex items-center gap-3 rounded-xl glass-card p-4 border border-brand-primary/10 shadow-lg max-w-[200px] backdrop-blur-md">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent/20 text-brand-primary dark:text-brand-accent">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h5 className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                  Sartorial Steam
                </h5>
                <p className="text-[9px] text-slate-600 dark:text-slate-200 mt-0.5">
                  Hand-finished steam pressing on couture hangers.
                </p>
              </div>
            </div>

            {/* Layered Floating Card 2: Safe solvents */}
            <div className="absolute -bottom-6 -left-6 hidden sm:flex items-center gap-3 rounded-xl glass-card p-4 border border-brand-primary/10 shadow-lg max-w-[210px] backdrop-blur-md">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Check className="h-5 w-5 stroke-[2.5]" />
              </div>
              <div>
                <h5 className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                  100% Eco-Safe Solvents
                </h5>
                <p className="text-[9px] text-slate-600 dark:text-slate-200 mt-0.5">
                  Zero toxins, pet and skin-safe biodegradable fluids.
                </p>
              </div>
            </div>

          </div>

          {/* Right Column: Storytelling and Details */}
          <div 
            ref={rightColRef}
            className="lg:col-span-7 space-y-6 text-left"
          >
            <span className="quality-text-reveal text-xs font-bold tracking-widest text-brand-primary uppercase dark:text-brand-accent font-mono block">
              OUR LUXURY FORMULATION
            </span>
            <h2 className="quality-text-reveal section-title-clamp font-serif text-slate-900 dark:text-white font-medium">
              Fiber-safe cleansing that extends clothing lifespan.
            </h2>
            <div className="quality-text-reveal w-16 h-1 bg-brand-primary dark:bg-brand-accent rounded-full" />
            <p className="quality-text-reveal text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              Standard dry-cleaning harsh chemical cycles break down wool fibers and strip cotton garments of natural protective waxes, leading to shrinkage, structural thinning, and color fading.
            </p>
            <p className="quality-text-reveal text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              Our bespoke water-softening wet-wash systems gently dislodge soils while nourishing yarn fibers. We optimize water chemistry specifically to prevent fiber stress.
            </p>

            {/* Highlight list */}
            <div className="space-y-6 pt-4" id="quality-highlights-list">
              {qualityPoints.map((point) => (
                <div key={point.title} className="quality-text-reveal flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    {point.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-950 dark:text-white">
                      {point.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-200 leading-relaxed mt-1">
                      {point.desc}
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
