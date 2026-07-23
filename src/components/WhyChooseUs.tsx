import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Heart, Sparkles, AlertCircle, RefreshCw, Trophy } from 'lucide-react';

export default function WhyChooseUs() {
  const highlights = [
    {
      id: 'hygiene',
      title: 'Hygienic Isolation',
      desc: 'We never mix your clothing with other customers. Every reservation is processed in a dedicated, isolated sanitization chamber.',
      icon: <ShieldCheck className="h-5.5 w-5.5 text-emerald-500" />,
      color: 'bg-emerald-500/5 border-emerald-500/10'
    },
    {
      id: 'fabric-safety',
      title: 'pH-Balanced Fabric Wash',
      desc: 'Our wet solvents are customized to the pH requirements of each textile, avoiding fabric thinning or structural tension.',
      icon: <Heart className="h-5.5 w-5.5 text-rose-500" />,
      color: 'bg-rose-500/5 border-rose-500/10'
    },
    {
      id: 'stain-lab',
      title: 'Precision Stain Science',
      desc: 'Stubborn spots are analyzed under high-intensity color-matching lab light and treated with specialized plant-derived spotting solutions.',
      icon: <Sparkles className="h-5.5 w-5.5 text-amber-500" />,
      color: 'bg-amber-500/5 border-amber-500/10'
    },
    {
      id: 'separate-treatment',
      title: 'Detergent Personalization',
      desc: 'Choose from our standard floral silk extracts, hypoallergenic sensitive skin washes, or fully certified organic unscented options.',
      icon: <AlertCircle className="h-5.5 w-5.5 text-brand-secondary" />,
      color: 'bg-brand-secondary/5 border-brand-secondary/10'
    }
  ];

  return (
    <section 
      className="relative py-12 sm:py-16 md:py-20 lg:py-24 bg-white dark:bg-brand-dark overflow-hidden"
      id="why-us"
    >
      {/* Decorative Bubble Flares */}
      <div className="absolute top-[20%] right-[-10%] w-96 h-96 rounded-full bg-brand-accent/5 blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Editorial Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Brand Pitch */}
          <motion.div 
            initial={{ opacity: 0, x: -15 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-5 space-y-6"
          >
            <span className="text-xs font-bold tracking-widest text-brand-primary uppercase dark:text-brand-accent font-mono block">
              COUTURE CARE BENCHMARK
            </span>
            <h2 className="section-title-clamp font-serif text-slate-900 dark:text-white font-medium">
              We care for your wardrobe like a private collector.
            </h2>
            <div className="w-16 h-1 bg-brand-primary dark:bg-brand-accent rounded-full" />
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              Most dry-cleaning houses wash garments in bulk, mixing your personal garments with dozens of strangers using reclaimed, chemical-heavy solvents.
            </p>
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              At <strong>Tumble Spin</strong>, we treat laundry as an art. From customized soft water filtration to individual machine cycles and precision hand finishing, your shirts, suits, and linens receive the highest echelon of garment care in Bangalore.
            </p>

            {/* Micro stats banner */}
            <div className="rounded-xl border border-brand-primary/10 bg-brand-light p-4 dark:bg-brand-teal/10 flex items-start gap-3.5">
              <Trophy className="h-6 w-6 text-brand-primary dark:text-brand-accent shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Five-Star Standard Certification
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-200 leading-normal mt-0.5">
                  Proud recipient of the International Fabricare Association Award for exceptional wet solvent processing and environmental stewardship.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Custom Editorial Bento Cards Grid */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
            {highlights.map((item, idx) => (
              <motion.div
                key={`why-${item.id}-${idx}`}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className={`rounded-xl border p-5 flex flex-col justify-between hover:shadow-xs transition-all duration-300 ${item.color} dark:bg-brand-teal/5`}
              >
                <div>
                  {/* Icon */}
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-xs dark:bg-slate-900">
                    {item.icon}
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-white mb-2">
                    {item.title}
                  </h3>

                  {/* Desc */}
                  <p className="text-xs text-slate-600 dark:text-slate-200 leading-relaxed font-normal">
                    {item.desc}
                  </p>
                </div>

                {/* Card footer brand tag */}
                <div className="mt-6 flex items-center gap-1.5 text-[9px] font-bold text-brand-primary/60 dark:text-brand-accent/60 tracking-wider uppercase font-mono">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '8s' }} />
                  AL LAB APPROVED
                </div>
              </motion.div>
            ))}
          </div>

        </div>

      </div>
    </section>
  );
}
