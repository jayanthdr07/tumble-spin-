import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Shirt, Sparkles, Wind, Flame, Zap, HeartPulse, 
  ArrowUpRight, Info, CheckCircle2, Footprints
} from 'lucide-react';

import washAndFoldImg from '../assets/images/wash_and_fold_new_priya.jpg';
import steamIroningImg from '../assets/images/steam_ironing_service_1783419251852.jpg';
import expressServiceImg from '../assets/images/express_van_new_branded.jpg';
import dryCleaningNewImg from '../assets/images/dry_cleaning_new_packaged.jpg';
import premiumShoeSpaImg from '../assets/images/premium_shoe_spa_new.jpg';

interface ServicesProps {
  onSelectService: (id: string) => void;
}

export default function Services({ onSelectService }: ServicesProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Load custom prices dynamically
  const [customPrices, setCustomPrices] = useState<any>(() => {
    const saved = localStorage.getItem('tumblespin_custom_prices');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('tumblespin_custom_prices');
      if (saved) {
        try {
          setCustomPrices(JSON.parse(saved));
        } catch (e) {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const getServicePriceString = (id: string, defaultPrice: string) => {
    const override = customPrices?.services?.[id];
    if (override !== undefined && override !== null) {
      if (id === 'express') {
        return `+₹${override} flat`;
      } else if (id === 'wash-fold' || id === 'wash-iron') {
        return `₹${override}/kg`;
      } else if (id === 'dry-cleaning' || id === 'premium-care' || id === 'steam-iron') {
        return `₹${override}/item`;
      } else if (id === 'shoe-spa') {
        return `₹${override}/pair`;
      }
      return `₹${override}`;
    }
    return defaultPrice;
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const servicesData = [
    {
      id: 'wash-fold',
      title: 'Wash & Fold',
      price: '₹95/kg',
      badge: 'POPULAR DAILY CARE',
      description: 'Ideal for daily wear, casual cottons, and linen. Separated meticulously by color and fabric weight, washed in pure softened water, tumbled dry at customized low heats, and crisp-folded by hand.',
      icon: <Shirt className="h-6 w-6" />,
      features: ['Individual laundry drums (no bulk mixing)', 'Premium biodegradable detergents', 'Scented or allergen-free options', 'Hand-packed in breathable linen liners'],
      image: washAndFoldImg
    },
    {
      id: 'wash-iron',
      title: 'Wash & Steam Iron',
      price: '₹129/kg',
      badge: 'BUSINESS CRISP',
      description: 'Perfect for business shirts, cotton trousers, and smart-casuals. Tailored laundering paired with our precision automated and manual hot steam ironing process for crease-free luxury finishing.',
      icon: <Wind className="h-6 w-6" />,
      features: ['Crisp collar & cuff detailing', 'Custom starch levels (none to high)', 'Delivered hanging or traveler-folded', 'Hand-finished checking process'],
      image: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'dry-cleaning',
      title: 'Dry Cleaning',
      price: '₹199/item',
      badge: 'COUTURE STANDARD',
      description: 'Our signature eco-friendly fluid system cares for wool, silk, sarees, sequins, and structured tailoring without toxic petrochemicals. Ensures delicate borders, linings, and fabrics retain pristine color and shape.',
      icon: <Sparkles className="h-6 w-6" />,
      features: ['Eco-solvent wet and dry wash', 'Restorative color conditioning', 'Fabric-safe stain neutralization', 'Premium custom contoured hangers'],
      image: dryCleaningNewImg
    },
    {
      id: 'steam-iron',
      title: 'Steam Ironing',
      price: '₹49/item',
      badge: 'TOUCH-UP DELUXE',
      description: 'For delicate garments that require zero-contact smoothing. Our artisans hand-steam garments on custom padded hangers to relax fibers, erase packing lines, and refresh fabrics.',
      icon: <Flame className="h-6 w-6" />,
      features: ['Zero-weight steam relaxation', 'Best for sarees, pleats, and silk gowns', 'Erases storage odors completely', 'Includes premium protective dust covers'],
      image: steamIroningImg
    },
    {
      id: 'express',
      title: 'Express Service',
      price: '+₹499 flat',
      badge: '24-HOUR GUARANTEE',
      description: 'In a rush? Our express priority line moves your reservation to the front. From pickup to return in under 24 hours, maintaining our strict standards of premium hygiene and inspection.',
      icon: <Zap className="h-6 w-6" />,
      features: [
        'Guaranteed 24-hour turnaround',
        'Real-time GPS delivery tracking',
        'Priority fabric inspection team',
        'Express SMS communication line',
        'Double Check inspection'
      ],
      image: expressServiceImg
    },
    {
      id: 'premium-care',
      title: 'Premium Garment Care',
      price: '₹399/item',
      badge: 'ARCHIVAL PRESERVATION',
      description: 'For high-end fashion, wedding sarees, sherwanis, leather, and vintage clothing. A complete custom restoration program from stain chemical analysis to fiber restructuring and preservation box packing.',
      icon: <HeartPulse className="h-6 w-6" />,
      features: ['pH-balanced stain treatment', 'Zari & embroidery restoration', 'Archival preservation tissue packing', 'Signed inspection certificate'],
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'shoe-spa',
      title: 'Premium Shoe Spa',
      price: '₹299/pair',
      badge: 'SNEAKER & SOLE RESTORATION',
      description: 'Pamper your sneakers, luxury loafers, or heels with our premium shoe spa. Deep fabric and leather scrubbing with customized cleansers, sole sterilization, odor eradication, and texture brushing.',
      icon: <Footprints className="h-6 w-6" />,
      features: ['Hand-brushed professional cleaning', 'Sole sterilization & disinfection', 'Premium leather conditioning', 'Deodorization & custom laced return'],
      image: premiumShoeSpaImg
    }
  ];

  return (
    <section 
      className="relative py-12 sm:py-16 md:py-20 lg:py-24 bg-linear-to-b from-white via-brand-light/30 to-white dark:from-brand-dark dark:via-brand-deep/10 dark:to-brand-dark overflow-hidden"
      id="services"
    >
      {/* Decorative Wave Mask Backdrop Element */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-brand-accent/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header Block */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-8 sm:mb-12 md:mb-16 space-y-3"
        >
          <span className="text-xs font-bold tracking-widest text-brand-primary uppercase dark:text-brand-accent font-mono block">
            INDULGENT TREATMENT MODULES
          </span>
          <h2 className="section-title-clamp font-serif text-slate-900 dark:text-white font-medium">
            Curated care programs for your entire wardrobe.
          </h2>
          <div className="w-16 h-1 bg-brand-primary dark:bg-brand-accent mx-auto rounded-full" />
          <p className="text-slate-600 dark:text-slate-200 max-w-xl mx-auto text-sm">
            We don’t just clean; we restore. Choose individual packages or bundle them together in your pickup wizard.
          </p>
        </motion.div>

        {isLoading ? (
          /* Premium Asymmetric Bento Grid Skeleton Loader */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8" id="services-skeleton">
            {Array.from({ length: 7 }).map((_, index) => {
              const gridColSpan = index === 0 || index === 1 || index === 5 || index === 6
                ? 'md:col-span-6' 
                : 'md:col-span-4';
              return (
                <div
                  key={`skel-serv-${index}`}
                  className={`${gridColSpan} rounded-2xl border border-slate-100/60 dark:border-brand-teal/5 bg-white/80 dark:bg-brand-deep/10 p-6 space-y-5 animate-pulse`}
                >
                  {/* Image Thumbnail Placeholder */}
                  <div className="h-48 w-full bg-slate-100/80 dark:bg-slate-800/80 rounded-xl" />

                  {/* Badge & Price Placeholder */}
                  <div className="flex justify-between items-center">
                    <div className="h-3 w-28 bg-slate-100/80 dark:bg-slate-800/80 rounded-md" />
                    <div className="h-8 w-16 bg-slate-100/80 dark:bg-slate-800/80 rounded-full" />
                  </div>

                  {/* Title & Icon Placeholder */}
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl shrink-0" />
                    <div className="h-5 w-40 bg-slate-100/80 dark:bg-slate-800/80 rounded-md" />
                  </div>

                  {/* Description Lines */}
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-slate-100/80 dark:bg-slate-800/80 rounded-md" />
                    <div className="h-3 w-5/6 bg-slate-100/80 dark:bg-slate-800/80 rounded-md" />
                  </div>

                  {/* Feature Bullets */}
                  <div className="space-y-2.5 pt-2">
                    <div className="flex items-center gap-2">
                      <div className="h-3.5 w-3.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-full shrink-0" />
                      <div className="h-3 w-3/4 bg-slate-100/80 dark:bg-slate-800/80 rounded-md" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3.5 w-3.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-full shrink-0" />
                      <div className="h-3 w-2/3 bg-slate-100/80 dark:bg-slate-800/80 rounded-md" />
                    </div>
                  </div>

                  {/* Footer Placeholder */}
                  <div className="pt-4 border-t border-slate-50 dark:border-brand-teal/5 flex items-center justify-between">
                    <div className="h-3 w-32 bg-slate-100/80 dark:bg-slate-800/80 rounded-md" />
                    <div className="h-4 w-16 bg-slate-100/80 dark:bg-slate-800/80 rounded-md" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Premium Asymmetric Bento Grid / Layout */
          <div 
            className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8"
            id="services-grid"
          >
            {servicesData.map((service, index) => {
              // Asymmetric layout with 7 elements:
              // First 2 elements: md:col-span-6 (Row 1)
              // Middle 3 elements: md:col-span-4 (Row 2)
              // Last 2 elements: md:col-span-6 (Row 3)
              const gridColSpan = index === 0 || index === 1 || index === 5 || index === 6
                ? 'md:col-span-6' 
                : 'md:col-span-4';

              return (
                <motion.div
                  key={`serv-${service.id}-${index}`}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className={`${gridColSpan} rounded-2xl glass-card p-6 flex flex-col justify-between border border-brand-primary/5 shadow-xs transition-all duration-300 hover:shadow-lg dark:hover:border-brand-accent/10 dark:hover:bg-brand-teal/10 relative overflow-hidden group`}
                  id={`service-card-${service.id}`}
                >
                  {/* Decorative Accent Background Glow */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-brand-accent/15 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  
                  {/* Upper Details */}
                  <div className="space-y-4">
                    {/* Service Image Thumbnail */}
                    <div className="relative h-48 w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
                      <img 
                        src={service.image} 
                        alt={service.title} 
                        className={`h-full w-full ${service.id === 'wash-fold' || service.id === 'shoe-spa' ? 'object-contain bg-slate-50 dark:bg-slate-950/60' : 'object-cover'} transition-transform duration-700 group-hover:scale-105`}
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-slate-950/20 via-transparent to-transparent opacity-40" />
                    </div>

                    {/* Service Badge & Price */}
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold tracking-widest text-brand-primary dark:text-brand-accent uppercase font-mono">
                        {service.badge}
                      </span>
                      <span className="text-sm sm:text-base font-mono font-black text-brand-primary dark:text-brand-accent bg-brand-primary/5 dark:bg-brand-accent/5 px-3 py-1.5 rounded-full border border-brand-primary/10 dark:border-brand-accent/10">
                        {getServicePriceString(service.id, service.price)}
                      </span>
                    </div>

                    {/* Icon & Title */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-all duration-300 dark:bg-brand-accent/10 dark:text-brand-accent dark:group-hover:bg-brand-accent dark:group-hover:text-brand-deep">
                        {service.icon}
                      </div>
                      <h3 className="text-lg font-serif font-semibold text-slate-950 dark:text-white group-hover:text-brand-primary dark:group-hover:text-brand-accent transition-colors">
                        {service.title}
                      </h3>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-600 dark:text-slate-200 leading-relaxed font-normal">
                      {service.description}
                    </p>

                    {/* Features Bullet List */}
                    <ul className="space-y-2 pt-2">
                      {service.features.map((feature, fidx) => (
                        <li key={`feat-${service.id}-${fidx}`} className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                          <CheckCircle2 className="h-3.5 w-3.5 text-brand-secondary shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Bottom Interactive Trigger Area */}
                  <div className="mt-8 pt-4 border-t border-slate-100 dark:border-brand-teal/10 flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono flex items-center gap-1">
                      <Info className="h-3.5 w-3.5 text-brand-primary/40 dark:text-brand-accent/40" />
                      Double Check inspection
                    </span>
                    
                    <button
                      onClick={() => onSelectService(service.id)}
                      className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-brand-primary dark:text-brand-accent group/btn hover:underline"
                    >
                      Select Care
                      <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                    </button>
                  </div>

                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
