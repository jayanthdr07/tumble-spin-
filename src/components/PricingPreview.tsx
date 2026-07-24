import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle, ArrowRight, Info, HelpCircle, ShieldCheck, 
  Sparkles, Shirt, Scissors, Layers, Home, Footprints, Briefcase, ShoppingBag
} from 'lucide-react';
import { getItemIcon } from '../utils/itemIcons';

interface PricingPreviewProps {
  onOpenBooking: () => void;
  dynamicPricing?: {
    mode: 'surcharge' | 'discount' | 'none';
    percentage: number;
    label: string;
  };
}

interface PriceItem {
  name: string;
  dryClean: string;
  steamIron?: string;
  note?: string;
}

interface PriceCategory {
  id: string;
  name: string;
  delivery: string;
  columns: string[];
  icon: React.ReactNode;
  items: PriceItem[];
}

const PRICING_DATA: PriceCategory[] = [
  {
    id: 'laundry',
    name: "Laundry",
    delivery: "Delivery within 2 days",
    columns: ["Rate / kg"],
    icon: <ShoppingBag className="h-5 w-5" />,
    items: [
      { name: "Wash & Steam Iron (5 garments approx / kg)", dryClean: "₹129" },
      { name: "Wash & Fold (5 garments approx / kg)", dryClean: "₹95" }
    ]
  },
  {
    id: 'men',
    name: "Men",
    delivery: "Delivery within 3 days",
    columns: ["Dry Clean", "Steam Iron"],
    icon: <Shirt className="h-5 w-5" />,
    items: [
      { name: "T-Shirt / Shirt", dryClean: "₹110 / ₹110", steamIron: "₹40 / ₹40" },
      { name: "Trouser / Jeans", dryClean: "NA", steamIron: "₹40 / ₹50" },
      { name: "Coat", dryClean: "₹255", steamIron: "₹105" },
      { name: "Men Suit 2/3 pcs", dryClean: "₹365 / ₹530", steamIron: "₹145 / ₹210" },
      { name: "Kurta / Pyjama", dryClean: "₹110 / ₹150+", steamIron: "₹40 / ₹40+" },
      { name: "Achkan", dryClean: "₹580", steamIron: "₹230" }
    ]
  },
  {
    id: 'women',
    name: "Women",
    delivery: "Delivery within 3 days",
    columns: ["Dry Clean", "Steam Iron"],
    icon: <Scissors className="h-5 w-5" />,
    items: [
      { name: "Kurta", dryClean: "₹110", steamIron: "₹40" },
      { name: "Salwar / Plazo", dryClean: "₹105 / ₹105+", steamIron: "₹40 / ₹40+" },
      { name: "Dupatta", dryClean: "₹65+", steamIron: "₹20+" },
      { name: "Saree / Blouse", dryClean: "₹230 / ₹95+", steamIron: "₹95 / ₹40+" },
      { name: "Dress", dryClean: "₹295+", steamIron: "₹75+" },
      { name: "Top", dryClean: "₹95", steamIron: "₹40" },
      { name: "Lehenga", dryClean: "₹580+", steamIron: "₹230+" },
      { name: "Skirt", dryClean: "₹210", steamIron: "₹85+" }
    ]
  },
  {
    id: 'shoes',
    name: "Shoes",
    delivery: "Delivery within 4 days",
    columns: ["Dry Clean"],
    icon: <Footprints className="h-5 w-5" />,
    items: [
      { name: "Sports Shoes", dryClean: "₹340" },
      { name: "Canvas / Sneaker (Non Leather)", dryClean: "₹340" },
      { name: "Suede Leather", dryClean: "₹510" },
      { name: "Boots", dryClean: "₹670+" }
    ]
  },
  {
    id: 'woolen',
    name: "Woolens",
    delivery: "Delivery within 3 days",
    columns: ["Dry Clean", "Steam Iron"],
    icon: <Layers className="h-5 w-5" />,
    items: [
      { name: "Jacket / Full Sleeves Sweater", dryClean: "₹255 / ₹110", steamIron: "₹105 / ₹75" },
      { name: "Sweater / Half Sleeves", dryClean: "₹205 / ₹160", steamIron: "₹85 / ₹65" },
      { name: "Wool Shawl", dryClean: "₹255", steamIron: "₹105" },
      { name: "Long Coat", dryClean: "₹385", steamIron: "₹150" },
      { name: "Shawl / Pashmina", dryClean: "₹175 / ₹495", steamIron: "₹75 / ₹200" },
      { name: "Leather Jacket", dryClean: "₹580", steamIron: "₹230" }
    ]
  },
  {
    id: 'household',
    name: "Household",
    delivery: "Delivery within 3 days",
    columns: ["Dry Clean"],
    icon: <Home className="h-5 w-5" />,
    items: [
      { name: "Blanket Single / 1/2 Ply", dryClean: "₹360 / ₹445" },
      { name: "Blanket Double / 2 Ply", dryClean: "₹470 / ₹585" },
      { name: "Quilt Single / Double", dryClean: "₹360 / ₹470" },
      { name: "Duvet", dryClean: "₹85+" },
      { name: "Curtain Door / Window (No Lining)", dryClean: "₹175+" },
      { name: "Curtain Door / Window (With Lining)", dryClean: "₹305+" },
      { name: "Bed Sheet Single / Double", dryClean: "₹120 / ₹175" },
      { name: "Carpet (per sq ft)", dryClean: "₹40" },
      { name: "Blind", dryClean: "₹235+" }
    ]
  },
  {
    id: 'bags',
    name: "Bags",
    delivery: "Delivery within 4 days",
    columns: ["Dry Clean"],
    icon: <Briefcase className="h-5 w-5" />,
    items: [
      { name: "Handbag", dryClean: "₹595+" },
      { name: "Canvas / Jute / Cloth Bag", dryClean: "₹415+" },
      { name: "Handbag Leather", dryClean: "₹855+" },
      { name: "Ink's Come (Stain Care)", dryClean: "₹265+" },
      { name: "Wallet", dryClean: "₹295+" }
    ]
  }
];

export default function PricingPreview({ onOpenBooking, dynamicPricing }: PricingPreviewProps) {
  const [activeCategory, setActiveCategory] = useState<string>('laundry');

  const selectedCategory = PRICING_DATA.find(c => c.id === activeCategory) || PRICING_DATA[0];

  const adjustPriceString = (priceStr: string) => {
    if (!dynamicPricing || dynamicPricing.mode === 'none' || !dynamicPricing.percentage) return priceStr;
    return priceStr.replace(/(₹)?(\d+)(\+)?/g, (match, rSign, numStr, plusSign) => {
      const val = parseInt(numStr, 10);
      if (isNaN(val)) return match;
      let adjusted = val;
      if (dynamicPricing.mode === 'surcharge') {
        adjusted = val + (val * dynamicPricing.percentage) / 100;
      } else if (dynamicPricing.mode === 'discount') {
        adjusted = val - (val * dynamicPricing.percentage) / 100;
      }
      return `${rSign || '₹'}${Math.round(adjusted)}${plusSign || ''}`;
    });
  };

  return (
    <section 
      className="py-24 bg-white dark:bg-brand-dark overflow-hidden relative" 
      id="pricing"
    >
      {/* Decorative subtle layout accent */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-72 h-72 bg-brand-primary/5 dark:bg-brand-accent/5 rounded-full filter blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-0 w-80 h-80 bg-brand-accent/5 dark:bg-brand-primary/5 rounded-full filter blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Title & Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary/10 dark:bg-brand-accent/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-brand-primary uppercase dark:text-brand-accent font-mono">
            <Sparkles className="h-3.5 w-3.5" />
            Transparent Pricing List
          </div>
          <h2 className="text-4xl font-serif text-slate-900 dark:text-white font-medium tracking-tight">
            Simple pricing for every fabric, every outfit, and every home essential.
          </h2>
          <p className="text-slate-500 dark:text-slate-300 max-w-md mx-auto text-sm">
            Pickup and delivery available. Express delivery available on select items.
          </p>
        </div>

        {/* Pricing Category Filters - Tabs */}
        <div className="flex flex-wrap justify-center gap-2.5 mb-12" id="pricing-category-filters">
          {PRICING_DATA.map((cat, idx) => (
            <button
              key={`price-cat-${cat.id}-${idx}`}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                activeCategory === cat.id
                  ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20 dark:bg-brand-teal dark:text-white'
                  : 'bg-white text-slate-700 hover:bg-brand-accent/10 dark:bg-brand-dark/40 dark:text-slate-200 dark:hover:bg-brand-teal/20 border border-brand-accent/40 dark:border-brand-accent/20'
              }`}
            >
              {cat.icon}
              {cat.name}
            </button>
          ))}
        </div>

        {/* Selected Category Content */}
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35 }}
              className="rounded-3xl bg-linear-to-b from-white to-brand-light/20 dark:from-brand-dark dark:to-brand-dark p-6 sm:p-10 border border-brand-accent/30 dark:border-brand-accent/20 shadow-xs relative"
            >
              {/* Category Info Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-5 border-b border-slate-200/50 dark:border-brand-teal/10">
                <div>
                  <h3 className="text-xl font-serif font-bold text-slate-800 dark:text-white flex items-center gap-2.5">
                    {selectedCategory.icon}
                    {selectedCategory.name} Price Menu
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">
                    {selectedCategory.delivery}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-2 bg-brand-yellow/80 dark:bg-brand-yellow text-brand-deep px-3.5 py-1.5 rounded-full border border-brand-yellow/50">
                    <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest font-mono">
                      Premium Care Included
                    </span>
                  </div>
                  {dynamicPricing && dynamicPricing.mode !== 'none' && dynamicPricing.percentage > 0 && (
                    <span className={`text-[10px] font-bold uppercase tracking-wider font-mono px-2.5 py-0.5 rounded-sm ${
                      dynamicPricing.mode === 'surcharge' 
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' 
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {dynamicPricing.mode === 'surcharge' ? '⚡' : '🎉'} {dynamicPricing.label} ({dynamicPricing.percentage}%) Applied
                    </span>
                  )}
                </div>
              </div>

              {/* Responsive Pricing Grid/Table */}
              <div className="space-y-1.5" id="pricing-items-list">
                {/* Columns Header (Only on Desktop) */}
                <div className="hidden sm:grid sm:grid-cols-12 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono pb-2 border-b border-slate-100 dark:border-brand-teal/5">
                  <div className="sm:col-span-6">Garment / Item</div>
                  {selectedCategory.columns.map((col, idx) => (
                    <div 
                      key={`price-col-${col}-${idx}`} 
                      className={`text-right ${
                        selectedCategory.columns.length === 1 ? 'sm:col-span-6' : 'sm:col-span-3'
                      }`}
                    >
                      {col}
                    </div>
                  ))}
                </div>

                {/* Items List */}
                <div className="divide-y divide-slate-100 dark:divide-brand-teal/5">
                  {selectedCategory.items.map((item, idx) => (
                    <div 
                      key={`price-item-${item.name}-${idx}`} 
                      className="grid grid-cols-1 sm:grid-cols-12 items-center py-4 sm:py-3.5 group transition-colors"
                    >
                      {/* Name */}
                      <div className="sm:col-span-6 text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-brand-primary dark:group-hover:text-brand-accent transition-colors flex items-center gap-2.5">
                        <span className="p-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-100/50 dark:border-slate-800 text-brand-primary dark:text-brand-accent flex items-center justify-center shrink-0 shadow-3xs">
                          {getItemIcon(item.name, "h-3.5 w-3.5")}
                        </span>
                        <span>{item.name}</span>
                      </div>

                      {/* Prices */}
                      {selectedCategory.columns.length === 1 ? (
                        /* Household / Shoes / Bags Single Dry Clean Column */
                        <div className="sm:col-span-6 text-right flex justify-between sm:justify-end items-center gap-2 mt-1 sm:mt-0">
                          <span className="sm:hidden text-xs text-slate-400 dark:text-slate-500">Dry Clean</span>
                          <span className="text-sm font-bold font-mono text-slate-800 dark:text-white">
                            {adjustPriceString(item.dryClean)}
                          </span>
                        </div>
                      ) : (
                        /* Dry Clean & Steam Iron Multi Columns */
                        <>
                          <div className="sm:col-span-3 text-right flex justify-between sm:justify-end items-center gap-2 mt-1 sm:mt-0">
                            <span className="sm:hidden text-xs text-slate-400 dark:text-slate-500">Dry Clean</span>
                            <span className="text-sm font-bold font-mono text-slate-800 dark:text-white">
                              {adjustPriceString(item.dryClean)}
                            </span>
                          </div>
                          <div className="sm:col-span-3 text-right flex justify-between sm:justify-end items-center gap-2 mt-1 sm:mt-0">
                            <span className="sm:hidden text-xs text-slate-400 dark:text-slate-500">Steam Iron</span>
                            <span className="text-sm font-bold font-mono text-slate-800 dark:text-white">
                              {item.steamIron ? adjustPriceString(item.steamIron) : 'NA'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Price notes */}
              <div className="mt-8 rounded-2xl bg-brand-yellow/30 p-5 dark:bg-brand-yellow/15 border border-brand-yellow/60 dark:border-brand-yellow/20 flex items-start gap-3">
                <Info className="h-5 w-5 text-brand-primary dark:text-brand-accent shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Pricing Disclosures & Notes
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    * Prices marked with a <strong className="text-brand-primary dark:text-brand-accent font-bold">+</strong> indicate a starting price. Rates may vary depending on premium fabrics (e.g. Pure Silk, Organza, Heavy Wool, Suede), design complexity, embellishments, size, or specific textile treatments requested. Standard terms and safe-guard protocols apply.
                  </p>
                </div>
              </div>

              {/* Quick booking trigger */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 border-t border-slate-200/50 dark:border-brand-teal/10">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Have special items or complex requirements? Talk directly to our masters.
                </p>
                <button
                  onClick={onOpenBooking}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-7 py-3 text-xs font-bold tracking-wider text-white uppercase shadow-md shadow-brand-primary/20 hover:bg-brand-secondary hover:-translate-y-0.5 transition-all dark:bg-brand-accent dark:text-brand-deep dark:hover:bg-white"
                >
                  Schedule Free Pickup
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </section>
  );
}
