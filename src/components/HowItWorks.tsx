import React from 'react';
import { motion } from 'motion/react';
import { CalendarDays, Truck, Sparkles, CheckSquare, Compass } from 'lucide-react';
import deliveryImg from '../assets/images/valet_delivery_oakwood_new.png';
import ecoPackagingImg from '../assets/images/eco_packaging_bag_new.jpg';
import premiumValetImg from '../assets/images/premium_valet_collection_new.png';

export default function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Schedule Instantly',
      desc: 'Use our 1-minute digital valet wizard. Choose precise 3-hour pickup and delivery slots that align with your weekly agenda.',
      icon: <CalendarDays className="h-6 w-6" />,
      tag: 'REQUESTED',
      image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=400&q=80'
    },
    {
      num: '02',
      title: 'Premium Valet Collection',
      desc: 'Our uniformed valet arrives with custom multi-item hanger structures. Hand over garments; no bagging or separation needed.',
      icon: <Truck className="h-6 w-6" />,
      tag: 'VALET ACTIVE',
      image: premiumValetImg
    },
    {
      num: '03',
      title: 'Individual Artisan Care',
      desc: 'Garments undergo digital tag logging, stain inspection under light-labs, custom wet-solvent processing, and detailed steam-iron pressing.',
      icon: <Sparkles className="h-6 w-6" />,
      tag: 'IN-HUB EXPERT',
      image: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=400&q=80'
    },
    {
      num: '04',
      title: 'Eco-Packed Delivery',
      desc: 'Freshly laundered clothing is returned hanging in compostable protectors or flat-folded in bespoke organic linen boxes.',
      icon: <CheckSquare className="h-6 w-6" />,
      tag: 'RETURNED FLAWLESS',
      image: ecoPackagingImg
    },
  ];

  return (
    <section 
      className="relative py-12 sm:py-16 md:py-20 lg:py-24 bg-brand-light dark:bg-brand-deep/20 overflow-hidden"
      id="how-it-works"
    >
      {/* Decorative Wave/Flow line backgrounds representing flowing water */}
      <div className="absolute top-[35%] left-0 right-0 h-0.5 bg-brand-primary/10 dark:bg-brand-accent/5 hidden md:block" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Heading */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-8 sm:mb-12 md:mb-16 space-y-3"
        >
          <span className="text-xs font-bold tracking-widest text-brand-primary uppercase dark:text-brand-accent font-mono block">
            OUR ZERO-STRESS STANDARD
          </span>
          <h2 className="section-title-clamp font-serif text-slate-900 dark:text-white font-medium">
            Seamless care, from your wardrobe and back.
          </h2>
          <div className="w-12 h-0.5 bg-brand-primary dark:bg-brand-accent mx-auto rounded-full" />
          <p className="text-slate-600 dark:text-slate-200 max-w-md mx-auto text-sm">
            Four flawless phases of bespoke dry cleaning and laundry management tailored for busy professionals.
          </p>
        </motion.div>

        {/* Steps and Image Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch relative">
          
          {/* Steps Left Column */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6 relative">
            {steps.map((step, idx) => (
              <motion.div 
                key={`how-step-${step.num}-${idx}`}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="flex flex-col justify-between rounded-xl bg-white p-6 border border-brand-primary/5 shadow-xs transition-all duration-300 hover:shadow-md dark:bg-brand-dark dark:border-brand-teal/20 relative group"
              >
                {/* Step indicator tag */}
                <div className="absolute -top-3.5 right-6 bg-linear-to-r from-brand-primary to-brand-secondary text-[8px] font-bold tracking-widest text-white px-2.5 py-1 rounded-full uppercase font-mono shadow-sm">
                  {step.tag}
                </div>

                <div>
                  {/* Step Image Thumbnail */}
                  <div className="relative h-36 w-full mb-4 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
                    <img 
                      src={step.image} 
                      alt={step.title} 
                      className={`h-full w-full ${step.num === '04' ? 'object-contain bg-slate-50 dark:bg-slate-950/60' : 'object-cover'} transition-transform duration-700 group-hover:scale-105`}
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-slate-950/20 via-transparent to-transparent opacity-40" />
                  </div>

                  {/* Header row: Number and Icon */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-3xl font-extrabold font-mono text-brand-primary/20 dark:text-brand-accent/20 select-none">
                      {step.num}
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/5 text-brand-primary dark:bg-brand-accent/10 dark:text-brand-accent group-hover:scale-105 transition-transform">
                      {step.icon}
                    </div>
                  </div>

                  {/* Step Title */}
                  <h3 className="text-base font-serif font-semibold text-slate-950 dark:text-white mb-2">
                    {step.title}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-slate-600 dark:text-slate-200 leading-relaxed">
                    {step.desc}
                  </p>
                </div>

                {/* Step Bottom Accent Dot */}
                <div className="mt-6 flex items-center gap-1.5 text-[9px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase font-mono">
                  <Compass className="h-3.5 w-3.5 text-brand-secondary" />
                  Tumble Spin Valet
                </div>

              </motion.div>
            ))}
          </div>

          {/* Visual Showcase Right Column */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="lg:col-span-4 rounded-2xl overflow-hidden shadow-md border border-brand-primary/5 dark:border-brand-teal/20 bg-slate-950 text-white relative group min-h-[380px] flex flex-col justify-end"
          >
            {/* Absolute Background Image */}
            <img 
              src={deliveryImg} 
              alt="Tumble Spin Courier Valet Delivery in Bangalore" 
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
            
            {/* Overlay Badge */}
            <div className="absolute top-6 left-6 bg-brand-deep/90 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-brand-accent/20 z-10">
              <span className="text-[10px] font-bold text-brand-accent font-mono tracking-widest uppercase">
                BANGALORE METRO ACTIVE
              </span>
            </div>
            
            {/* Content Overlaid at Bottom */}
            <div className="relative z-10 p-6 sm:p-8 space-y-3">
              <h4 className="text-base sm:text-lg font-serif font-semibold text-white">
                Tumble Spin Courier Valet Delivery
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                Our professional valet fleet covers Bangalore daily, ensuring your premium garments are delivered sanitized, pristine, and perfectly contoured right to your doorstep.
              </p>
              <div className="pt-2 text-[10px] font-mono font-bold text-brand-accent uppercase tracking-widest flex items-center gap-1.5 border-t border-white/10">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-accent animate-ping" />
                Bengaluru Area Coverage
              </div>
            </div>
          </motion.div>

        </div>

      </div>
    </section>
  );
}
