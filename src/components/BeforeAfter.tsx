import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, Eye, ShieldCheck, Heart, RefreshCw, Star } from 'lucide-react';
import shawlImg from '../assets/images/pashmina_wool_shawl_1783419282364.jpg';

interface GalleryItem {
  id: string;
  name: string;
  category: string;
  problem: string;
  solution: string;
  beforeImg: string;
  afterImg: string;
}

const BEFORE_AFTER_ITEMS: GalleryItem[] = [
  {
    id: '1',
    name: "Air Jordan 1 Retro Sneakers",
    category: "shoes",
    problem: "Caked dry mud, grass stains, and yellowed midsoles from outdoor wear.",
    solution: "Deep active oxygen scrub, delicate sole de-oxidation, and steam sanitizing.",
    beforeImg: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=40&w=400", // red/orange sneaker but we style it with a dark/muddy overlay
    afterImg: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400",
  },
  {
    id: '2',
    name: "Suede Chelsea Boots",
    category: "shoes",
    problem: "Water marks, salt ring scuffs, and flattened nap from winter drizzle.",
    solution: "Gentle fiber vacuum, suede block grooming, dye restoration, and fiber guard.",
    beforeImg: "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?auto=format&fit=crop&q=40&w=400",
    afterImg: "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?auto=format&fit=crop&q=80&w=400",
  },
  {
    id: '3',
    name: "Mulberry Leather Handbag",
    category: "bags",
    problem: "Persistent dark pen ink bleed on the front grain leather panels.",
    solution: "Alcohol-free ink disperser extraction, gentle buffing, and custom beeswax sealing.",
    beforeImg: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&q=40&w=400",
    afterImg: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&q=80&w=400",
  },
  {
    id: '4',
    name: "Designer Beige Trench Coat",
    category: "apparel",
    problem: "Deep dark roast coffee splash spanning across the left lapel and pocket.",
    solution: "Premium dry wash utilizing non-halogenated biological active solvent.",
    beforeImg: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=40&w=400",
    afterImg: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=400",
  },
  {
    id: '5',
    name: "Mysore Silks",
    category: "apparel",
    problem: "Dull, oil grease marks on pure gold brocade (Zari) embroidery.",
    solution: "Artisanal hand-spotting using fluid hydrocarbon screens and zero-iron air pressed.",
    beforeImg: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=40&w=400",
    afterImg: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=400",
  },
  {
    id: '6',
    name: "Cable Knit Cashmere Sweater",
    category: "woolen",
    problem: "Severe surface pilling, fuzzing, and greyish collar sweat oxidation.",
    solution: "Precise micro-shaving treatment, premium lanolin-infused wet hydration bath.",
    beforeImg: "https://images.unsplash.com/photo-1614975058789-41316d0e2e9c?auto=format&fit=crop&q=40&w=400",
    afterImg: "https://images.unsplash.com/photo-1614975058789-41316d0e2e9c?auto=format&fit=crop&q=80&w=400",
  },
  {
    id: '7',
    name: "Double Plush Quilt",
    category: "household",
    problem: "Yellowed perimeter lines, musty dust mite accumulation from storage.",
    solution: "Sub-zero sanitization, allergen neutralizer wash, and high-frequency fluffing.",
    beforeImg: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=40&w=400",
    afterImg: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80&w=400",
  },
  {
    id: '8',
    name: "Designer Suede Leather Jacket",
    category: "woolen",
    problem: "Heavily darkened cuffs and grease marks from everyday motorcycle commutes.",
    solution: "Ultra-mild mechanical suede brushing, custom surface nutrition, and protective coating.",
    beforeImg: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=40&w=400",
    afterImg: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=80&w=400",
  },
  {
    id: '10',
    name: "Canvas & Jute Tote Bag",
    category: "bags",
    problem: "Ground-in grey dust and water stains on bottom jute fibers.",
    solution: "Intelligent spot ultrasound extraction, biological surfactant wash, and shape mold dry.",
    beforeImg: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=40&w=400",
    afterImg: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=400",
  },
  {
    id: '11',
    name: "Premium Saffiano Leather Wallet",
    category: "bags",
    problem: "Dull texture, surface lint, and grease discoloration inside card slots.",
    solution: "Saffiano grain decontamination, structural lining re-stitch, and water-repellent wax finish.",
    beforeImg: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&q=40&w=400",
    afterImg: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&q=80&w=400",
  },
  {
    id: '12',
    name: "Fine Pashmina Wool Shawl",
    category: "woolen",
    problem: "Accidental Merlot wine spillage, leaving large stiff crimson spots.",
    solution: "Instant acid-neutral solvent absorption, fiber-safe hydration bath, and air-dry flat.",
    beforeImg: shawlImg,
    afterImg: shawlImg,
  }
];

const CATEGORIES = [
  { id: 'all', name: 'Show All Restorations' },
  { id: 'shoes', name: 'Premium Footwear' },
  { id: 'bags', name: 'Luxury Leather Bags' },
  { id: 'apparel', name: 'Couture Apparel' },
  { id: 'household', name: 'Home Essentials' }
];

export default function BeforeAfter() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isRevealedMap, setIsRevealedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const filteredItems = BEFORE_AFTER_ITEMS.filter(
    item => activeTab === 'all' || item.category === activeTab
  );

  const toggleReveal = (id: string) => {
    setIsRevealedMap(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <section className="py-24 bg-slate-50/50 dark:bg-brand-deep/10 border-y border-slate-100 dark:border-brand-teal/5 overflow-hidden" id="before-after">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary/10 dark:bg-brand-accent/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-brand-primary uppercase dark:text-brand-accent font-mono">
            <Sparkles className="h-3.5 w-3.5" />
            Restoration Spotlights
          </div>
          <h2 className="text-4xl font-serif text-slate-900 dark:text-white font-medium tracking-tight">
            Witness the Tumble Spin Transformation.
          </h2>
          <p className="text-slate-500 dark:text-slate-300 max-w-md mx-auto text-sm leading-relaxed">
            See actual side-by-side results of our premium cleaning modules. Drag or hover to reveal pristine fabrics, deep clean suedes, and pristine wools.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`px-4.5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${
                activeTab === cat.id
                  ? 'bg-brand-primary text-white shadow-sm dark:bg-brand-accent dark:text-brand-deep'
                  : 'bg-white text-slate-600 border border-slate-100 hover:border-brand-primary/20 hover:bg-slate-50 dark:bg-brand-deep/30 dark:text-slate-300 dark:border-brand-teal/10'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {isLoading ? (
          /* Premium 3-column Before/After Skeleton Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" id="before-after-skeleton">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="bg-white/80 dark:bg-brand-deep/20 rounded-3xl overflow-hidden border border-slate-100/60 dark:border-brand-teal/10 p-0 shadow-2xs space-y-5 animate-pulse flex flex-col h-full"
              >
                {/* Image Placeholder */}
                <div className="h-64 bg-slate-100 dark:bg-slate-800/80 w-full" />
                
                {/* Restored Item details Placeholder */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-3.5">
                    {/* Title */}
                    <div className="h-4 w-3/4 bg-slate-100 dark:bg-slate-800/80 rounded-md" />
                    
                    {/* Issue Segment */}
                    <div className="space-y-1.5 pt-1">
                      <div className="h-3 w-5/6 bg-slate-100 dark:bg-slate-800/80 rounded-md" />
                      <div className="h-3 w-2/3 bg-slate-100 dark:bg-slate-800/80 rounded-md" />
                    </div>

                    {/* Restoration Segment */}
                    <div className="space-y-1.5 pt-3 border-t border-slate-50 dark:border-brand-teal/5">
                      <div className="h-3 w-11/12 bg-slate-100 dark:bg-slate-800/80 rounded-md" />
                      <div className="h-3.5 w-4/5 bg-slate-100 dark:bg-slate-800/80 rounded-md" />
                    </div>
                  </div>

                  {/* Footer segment */}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-50 dark:border-brand-teal/5">
                    <div className="h-3.5 w-24 bg-slate-100 dark:bg-slate-800/80 rounded-md" />
                    <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800/80 rounded-md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Before After Interactive Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode="popLayout">
              {filteredItems.map(item => {
                const isRevealed = isRevealedMap[item.id] || false;
                return (
                  <motion.div
                    layout
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.35 }}
                    className="bg-white dark:bg-brand-deep/20 rounded-3xl overflow-hidden border border-slate-100 dark:border-brand-teal/10 shadow-2xs hover:shadow-sm group flex flex-col h-full"
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    
                    {/* Image Compare Container */}
                    <div className="relative h-64 overflow-hidden bg-slate-900">
                      
                      {/* Before Image (Left or Background) */}
                      <div className="absolute inset-0 w-full h-full">
                        <img
                          src={item.beforeImg}
                          alt="Before Clean"
                          className="w-full h-full object-cover filter saturate-50 contrast-125 brightness-75 grayscale-25"
                          referrerPolicy="no-referrer"
                        />
                        {/* Dark muddy vignette overlay to make 'Before' look accurately stained */}
                        <div className="absolute inset-0 bg-amber-900/10 mix-blend-multiply opacity-80" />
                        
                        {/* Before tag */}
                        <span className="absolute left-4 top-4 bg-red-500/90 text-white text-[10px] font-bold uppercase tracking-widest font-mono px-2.5 py-1 rounded-full shadow-xs backdrop-blur-xs">
                          Before Care
                        </span>
                      </div>

                      {/* After Image Overlay with sliding reveal */}
                      <motion.div 
                        className="absolute inset-0 w-full h-full overflow-hidden"
                        animate={{ 
                          clipPath: isRevealed || hoveredId === item.id 
                            ? 'polygon(0 0, 100% 0, 100% 100%, 0% 100%)' 
                            : 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)' 
                        }}
                        transition={{ type: 'spring', damping: 20, stiffness: 80 }}
                      >
                        <img
                          src={item.afterImg}
                          alt="After Clean"
                          className="absolute inset-0 w-full h-full object-cover filter saturate-100 contrast-100 brightness-105"
                          referrerPolicy="no-referrer"
                          style={{ width: '100%', height: '100%' }}
                        />
                        
                        {/* After tag */}
                        <span className="absolute right-4 top-4 bg-emerald-500/90 text-white text-[10px] font-bold uppercase tracking-widest font-mono px-2.5 py-1 rounded-full shadow-xs backdrop-blur-xs">
                          After Clean
                        </span>
                      </motion.div>

                      {/* Sliding line divider indicator */}
                      <motion.div 
                        className="absolute top-0 bottom-0 w-1 bg-white/80 dark:bg-brand-accent/80 shadow-md flex items-center justify-center pointer-events-none"
                        animate={{ 
                          left: isRevealed || hoveredId === item.id ? '100%' : '50%' 
                        }}
                        transition={{ type: 'spring', damping: 20, stiffness: 80 }}
                      >
                        <div className="h-8 w-8 rounded-full bg-white dark:bg-brand-deep border-2 border-brand-primary dark:border-brand-accent shadow-sm flex items-center justify-center -ml-3.5">
                          <Eye className="h-4 w-4 text-brand-primary dark:text-brand-accent" />
                        </div>
                      </motion.div>

                      {/* Interactive Tap Area for Touch Screens */}
                      <button
                        onClick={() => toggleReveal(item.id)}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/70 text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full hover:bg-slate-900 shadow-sm backdrop-blur-xs md:hidden flex items-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3 animate-spin" style={{ animationDuration: '4s' }} />
                        Tap to Compare
                      </button>

                    </div>

                    {/* Restored Item details */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-brand-primary dark:group-hover:text-brand-accent transition-colors flex items-center gap-2">
                          {item.name}
                          <Star className="h-3.5 w-3.5 fill-brand-accent text-brand-accent" />
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                          <strong className="text-amber-600/95 dark:text-amber-500/95">Issue: </strong>
                          {item.problem}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed pt-1.5 border-t border-slate-50 dark:border-brand-teal/5">
                          <strong className="text-emerald-600/95 dark:text-emerald-400/95">Restoration: </strong>
                          {item.solution}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 dark:text-slate-500 pt-2">
                        <span className="flex items-center gap-1 font-semibold text-brand-primary dark:text-brand-accent">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Fabric Certified Safe
                        </span>
                        <span>Restored in 3 Days</span>
                      </div>
                    </div>

                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Trust disclaimer */}
        <div className="mt-16 text-center max-w-2xl mx-auto p-5 bg-white dark:bg-brand-deep/20 rounded-2xl border border-slate-100 dark:border-brand-teal/10">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            All transformations are handled strictly by our certified <strong className="text-slate-800 dark:text-white">Master Textile Restorers</strong>. We use organic carbon fluids that are completely safe for sensitive skin, zero dyes, and biodegradable solvent formulas.
          </p>
        </div>

      </div>
    </section>
  );
}
