import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calculator, ShoppingBag, Plus, Minus, Trash2, Sparkles, 
  ChevronRight, ArrowRight, RefreshCw, Shirt, Footprints, 
  Layers, Home, Briefcase, Scissors
} from 'lucide-react';
import { getItemIcon } from '../utils/itemIcons';

export interface EstimatorItem {
  id: string;
  name: string;
  category: string;
  dryCleanPrice: number | null;
  steamIronPrice: number | null;
  unit?: string;
}

export const ESTIMATOR_ITEMS: EstimatorItem[] = [
  // Laundry / KG (First Option)
  { id: 'laundry-wash-fold', name: 'Wash & Fold', category: 'laundry', dryCleanPrice: 95, steamIronPrice: null, unit: 'kg' },
  { id: 'laundry-wash-iron', name: 'Wash & Steam Iron', category: 'laundry', dryCleanPrice: 129, steamIronPrice: null, unit: 'kg' },

  // Kids Wear
  { id: 'kids-shirt', name: 'Kids Shirt', category: 'kids', dryCleanPrice: 50, steamIronPrice: 20 },
  { id: 'kids-tshirt', name: 'Kids T-Shirt', category: 'kids', dryCleanPrice: 50, steamIronPrice: 20 },
  { id: 'kids-jeans', name: 'Kids Jeans', category: 'kids', dryCleanPrice: 60, steamIronPrice: 25 },
  { id: 'kids-kurta', name: 'Kids Kurta', category: 'kids', dryCleanPrice: 50, steamIronPrice: 20 },
  { id: 'kids-pyjama', name: 'Kids Pyjama', category: 'kids', dryCleanPrice: 40, steamIronPrice: 15 },
  { id: 'kids-dupatta', name: 'Kids Dupatta', category: 'kids', dryCleanPrice: 40, steamIronPrice: 15 },
  { id: 'kids-dhoti', name: 'Kids Dhoti', category: 'kids', dryCleanPrice: 50, steamIronPrice: 20 },
  { id: 'kids-lehenga', name: 'Kids Lehenga', category: 'kids', dryCleanPrice: 150, steamIronPrice: 60 },
  { id: 'kids-shoes', name: "Kids Shoes", category: 'kids', dryCleanPrice: 130, steamIronPrice: null },
  { id: 'kids-leather-shoes', name: "Kids Leather Shoes", category: 'kids', dryCleanPrice: 170, steamIronPrice: null },
  { id: 'kids-semi-leather-shoes', name: 'Kids Semi Leather Shoes', category: 'kids', dryCleanPrice: 160, steamIronPrice: null },
  { id: 'kids-speed-leather-shoes', name: 'Kids Speed Leather Shoes', category: 'kids', dryCleanPrice: 180, steamIronPrice: null },

  // Men's Wear
  { id: 'men-shirt', name: 'T-Shirt / Shirt', category: 'men', dryCleanPrice: 110, steamIronPrice: 40 },
  { id: 'men-trouser', name: 'Trouser / Jeans', category: 'men', dryCleanPrice: null, steamIronPrice: 40 },
  { id: 'men-coat', name: 'Coat', category: 'men', dryCleanPrice: 255, steamIronPrice: 105 },
  { id: 'men-suit-2pc', name: 'Men Suit 2 Pcs', category: 'men', dryCleanPrice: 365, steamIronPrice: 145 },
  { id: 'men-suit-3pc', name: 'Men Suit 3 Pcs', category: 'men', dryCleanPrice: 530, steamIronPrice: 210 },
  { id: 'men-kurta', name: 'Kurta', category: 'men', dryCleanPrice: 110, steamIronPrice: 40 },
  { id: 'men-pyjama', name: 'Pyjama', category: 'men', dryCleanPrice: 150, steamIronPrice: 40 },
  { id: 'men-achkan', name: 'Achkan', category: 'men', dryCleanPrice: 580, steamIronPrice: 230 },

  // Women's Wear
  { id: 'women-kurta', name: 'Kurta', category: 'women', dryCleanPrice: 110, steamIronPrice: 40 },
  { id: 'women-salwar', name: 'Salwar / Plazo', category: 'women', dryCleanPrice: 105, steamIronPrice: 40 },
  { id: 'women-dupatta', name: 'Dupatta', category: 'women', dryCleanPrice: 65, steamIronPrice: 20 },
  { id: 'women-saree', name: 'Saree', category: 'women', dryCleanPrice: 230, steamIronPrice: 95 },
  { id: 'women-blouse', name: 'Blouse', category: 'women', dryCleanPrice: 95, steamIronPrice: 40 },
  { id: 'women-dress', name: 'Dress', category: 'women', dryCleanPrice: 295, steamIronPrice: 75 },
  { id: 'women-top', name: 'Top', category: 'women', dryCleanPrice: 95, steamIronPrice: 40 },
  { id: 'women-lehenga', name: 'Lehenga', category: 'women', dryCleanPrice: 580, steamIronPrice: 230 },
  { id: 'women-skirt', name: 'Skirt', category: 'women', dryCleanPrice: 210, steamIronPrice: 85 },

  // Woolen
  { id: 'wool-jacket', name: 'Jacket', category: 'woolen', dryCleanPrice: 255, steamIronPrice: 105 },
  { id: 'wool-sweater-full', name: 'Full Sleeves Sweater', category: 'woolen', dryCleanPrice: 110, steamIronPrice: 75 },
  { id: 'wool-sweater-half', name: 'Half Sleeves Sweater', category: 'woolen', dryCleanPrice: 160, steamIronPrice: 65 },
  { id: 'wool-shawl', name: 'Wool Shawl', category: 'woolen', dryCleanPrice: 255, steamIronPrice: 105 },
  { id: 'wool-longcoat', name: 'Long Coat', category: 'woolen', dryCleanPrice: 385, steamIronPrice: 150 },
  { id: 'wool-pashmina', name: 'Pashmina Shawl', category: 'woolen', dryCleanPrice: 495, steamIronPrice: 200 },
  { id: 'wool-leather', name: 'Leather Jacket', category: 'woolen', dryCleanPrice: 580, steamIronPrice: 230 },

  // Household
  { id: 'house-blanket-1', name: 'Blanket Single (1/2 Ply)', category: 'household', dryCleanPrice: 360, steamIronPrice: null },
  { id: 'house-blanket-2', name: 'Blanket Double (2 Ply)', category: 'household', dryCleanPrice: 470, steamIronPrice: null },
  { id: 'house-quilt-s', name: 'Quilt Single', category: 'household', dryCleanPrice: 360, steamIronPrice: null },
  { id: 'house-quilt-d', name: 'Quilt Double', category: 'household', dryCleanPrice: 470, steamIronPrice: null },
  { id: 'house-duvet', name: 'Duvet', category: 'household', dryCleanPrice: 85, steamIronPrice: null },
  { id: 'house-curtain-nl', name: 'Curtain Door/Window (No Lining)', category: 'household', dryCleanPrice: 175, steamIronPrice: null },
  { id: 'house-curtain-l', name: 'Curtain Door/Window (With Lining)', category: 'household', dryCleanPrice: 305, steamIronPrice: null },
  { id: 'house-sheet-s', name: 'Bed Sheet Single', category: 'household', dryCleanPrice: 120, steamIronPrice: null },
  { id: 'house-sheet-d', name: 'Bed Sheet Double', category: 'household', dryCleanPrice: 175, steamIronPrice: null },
  { id: 'house-carpet', name: 'Carpet (Standard 4x5ft = 20 sq ft)', category: 'household', dryCleanPrice: 800, steamIronPrice: null },
  { id: 'house-blind', name: 'Window Blind', category: 'household', dryCleanPrice: 235, steamIronPrice: null },

  // Shoes
  { id: 'shoes-sports', name: 'Sports Shoes', category: 'shoes', dryCleanPrice: 340, steamIronPrice: null },
  { id: 'shoes-sneaker', name: 'Canvas / Sneaker (Non Leather)', category: 'shoes', dryCleanPrice: 340, steamIronPrice: null },
  { id: 'shoes-suede', name: 'Suede Leather Shoes', category: 'shoes', dryCleanPrice: 510, steamIronPrice: null },
  { id: 'shoes-boots', name: 'Boots', category: 'shoes', dryCleanPrice: 670, steamIronPrice: null },

  // Bags
  { id: 'bags-handbag', name: 'Handbag', category: 'bags', dryCleanPrice: 595, steamIronPrice: null },
  { id: 'bags-canvas', name: 'Canvas / Jute / Cloth Bag', category: 'bags', dryCleanPrice: 415, steamIronPrice: null },
  { id: 'bags-leather', name: 'Leather Handbag', category: 'bags', dryCleanPrice: 855, steamIronPrice: null },
  { id: 'bags-ink', name: "Ink's Come / Ink Stain Removal Care", category: 'bags', dryCleanPrice: 265, steamIronPrice: null },
  { id: 'bags-wallet', name: 'Wallet', category: 'bags', dryCleanPrice: 295, steamIronPrice: null },
];

const CATEGORIES = [
  { id: 'laundry', name: 'Laundry/KG', icon: <ShoppingBag className="h-4 w-4" /> },
  { id: 'kids', name: "Kids Wear", icon: <Scissors className="h-4 w-4" /> },
  { id: 'men', name: "Men's Wear", icon: <Shirt className="h-4 w-4" /> },
  { id: 'women', name: "Women's Wear", icon: <Scissors className="h-4 w-4" /> },
  { id: 'shoes', name: 'Shoes', icon: <Footprints className="h-4 w-4" /> },
  { id: 'woolen', name: 'Woolens', icon: <Layers className="h-4 w-4" /> },
  { id: 'household', name: 'Household', icon: <Home className="h-4 w-4" /> },
  { id: 'bags', name: 'Bags', icon: <Briefcase className="h-4 w-4" /> },
];

interface CartItem {
  id: string;
  name: string;
  serviceType: 'Dry Clean' | 'Steam Iron';
  price: number;
  quantity: number;
  unit?: string;
}

interface ServiceEstimatorProps {
  onOpenBooking: (initialServiceId?: string, initialQuantities?: Record<string, number>, initialStep?: number) => void;
}

export default function ServiceEstimator({ onOpenBooking }: ServiceEstimatorProps) {
  const [activeCategory, setActiveCategory] = useState<string>('laundry');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedServiceType, setSelectedServiceType] = useState<Record<string, 'Dry Clean' | 'Steam Iron'>>({});

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
    const handleStorageChange = (e?: any) => {
      if (e?.detail) {
        setCustomPrices(e.detail);
        return;
      }
      const saved = localStorage.getItem('tumblespin_custom_prices');
      if (saved) {
        try {
          setCustomPrices(JSON.parse(saved));
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tumblespin_custom_prices_updated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tumblespin_custom_prices_updated', handleStorageChange);
    };
  }, []);

  const filteredItems = ESTIMATOR_ITEMS.filter(item => item.category === activeCategory);

  const handleServiceTypeChange = (itemId: string, type: 'Dry Clean' | 'Steam Iron') => {
    setSelectedServiceType(prev => ({
      ...prev,
      [itemId]: type
    }));
  };

  const getEffectiveServiceType = (item: EstimatorItem): 'Dry Clean' | 'Steam Iron' => {
    if (selectedServiceType[item.id]) return selectedServiceType[item.id];
    if (item.dryCleanPrice !== null) return 'Dry Clean';
    return 'Steam Iron';
  };

  const getPriceForType = (item: EstimatorItem, type: 'Dry Clean' | 'Steam Iron'): number => {
    const key = type === 'Dry Clean' ? 'dryClean' : 'steamIron';
    const override = customPrices?.estimator?.[item.id]?.[key];
    if (override !== undefined && override !== null && override !== '') {
      return Number(override);
    }
    // Fallback to booking override if estimator dryClean is not directly set
    const bookingOverride = customPrices?.booking?.[item.id];
    if (bookingOverride !== undefined && bookingOverride !== null && bookingOverride !== '' && type === 'Dry Clean') {
      return Number(bookingOverride);
    }
    if (type === 'Dry Clean') return item.dryCleanPrice || 0;
    return item.steamIronPrice || 0;
  };

  const addToCart = (item: EstimatorItem) => {
    const type = getEffectiveServiceType(item);
    const price = getPriceForType(item, type);
    
    if (price === 0) return;

    const cartKey = `${item.id}-${type}`;

    setCart(prev => {
      const existing = prev.find(i => `${i.id}-${i.serviceType}` === cartKey);
      if (existing) {
        return prev.map(i => `${i.id}-${i.serviceType}` === cartKey 
          ? { ...i, quantity: i.quantity + 1 }
          : i
        );
      }
      return [...prev, {
        id: item.id,
        name: item.name,
        serviceType: type,
        price,
        quantity: 1,
        unit: item.unit
      }];
    });
  };

  const updateQuantity = (id: string, type: 'Dry Clean' | 'Steam Iron', change: number) => {
    const cartKey = `${id}-${type}`;
    setCart(prev => {
      return prev.map(i => {
        if (`${i.id}-${i.serviceType}` === cartKey) {
          const newQty = Math.round((i.quantity + change) * 10) / 10;
          return newQty > 0 ? { ...i, quantity: newQty } : null;
        }
        return i;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (id: string, type: 'Dry Clean' | 'Steam Iron') => {
    const cartKey = `${id}-${type}`;
    setCart(prev => prev.filter(i => `${i.id}-${i.serviceType}` !== cartKey));
  };

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section className="py-20 bg-slate-50/70 dark:bg-brand-deep/20" id="estimator">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary/10 dark:bg-brand-accent/10 px-3.5 py-1 text-[11px] font-semibold tracking-wider text-brand-primary uppercase dark:text-brand-accent font-mono">
            <Calculator className="h-3.5 w-3.5" />
            Interactive Cost Estimator
          </div>
          <h2 className="text-3xl sm:text-4xl font-serif text-slate-900 dark:text-white font-medium tracking-tight">
            Plan your laundry, instantly.
          </h2>
          <p className="text-slate-500 dark:text-slate-300 text-sm sm:text-base max-w-md mx-auto">
            Select items and see an instant price projection. Fresh premium garments have never been simpler to budget.
          </p>
        </div>

        {/* Outer Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left panel: Category Selector and Items */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Horizontal Category Pill Scroll */}
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
              {CATEGORIES.map((cat, catIdx) => (
                <button
                  key={`estimator-cat-${cat.id}-${catIdx}`}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-2 px-4.5 py-2.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                    activeCategory === cat.id
                      ? 'bg-brand-primary text-white shadow-sm dark:bg-brand-accent dark:text-brand-deep'
                      : 'bg-white text-slate-600 border border-slate-100 hover:border-brand-primary/20 hover:bg-slate-50 dark:bg-brand-deep/30 dark:text-slate-300 dark:border-brand-teal/10 dark:hover:bg-brand-deep/50'
                  }`}
                >
                  {cat.icon}
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredItems.map((item, idx) => {
                  const effectiveType = getEffectiveServiceType(item);
                  const isDryCleanAvailable = item.dryCleanPrice !== null;
                  const isSteamIronAvailable = item.steamIronPrice !== null;
                  const currentPrice = getPriceForType(item, effectiveType);

                  return (
                    <motion.div
                      layout
                      key={`estimator-item-${item.id}-${idx}`}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25 }}
                      className="bg-white dark:bg-brand-deep/30 rounded-2xl p-5 border border-slate-100 dark:border-brand-teal/15 shadow-2xs hover:shadow-sm hover:border-brand-primary/15 dark:hover:border-brand-accent/15 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100/50 dark:border-slate-800 text-brand-primary dark:text-brand-accent flex items-center justify-center shrink-0 shadow-3xs">
                              {getItemIcon(item.id || item.name, "h-4.5 w-4.5")}
                            </div>
                            <h4 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white truncate">
                              {item.name}
                            </h4>
                          </div>
                          <span className="text-sm sm:text-base font-black text-brand-primary dark:text-brand-accent font-mono bg-brand-primary/5 dark:bg-brand-accent/5 px-2.5 py-1 rounded-md shrink-0">
                            ₹{currentPrice}{item.unit ? `/${item.unit}` : ''}
                          </span>
                        </div>

                        {/* Service Selection buttons if both are available */}
                        {(isDryCleanAvailable && isSteamIronAvailable) && (
                          <div className="flex gap-1.5 mt-3">
                            <button
                              onClick={() => handleServiceTypeChange(item.id, 'Dry Clean')}
                              className={`px-3 py-1 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                                effectiveType === 'Dry Clean'
                                  ? 'bg-brand-primary/10 text-brand-primary dark:bg-brand-accent/15 dark:text-brand-accent'
                                  : 'bg-slate-50 text-slate-400 dark:bg-brand-dark/30 dark:text-slate-500'
                              }`}
                            >
                              Dry Clean
                            </button>
                            <button
                              onClick={() => handleServiceTypeChange(item.id, 'Steam Iron')}
                              className={`px-3 py-1 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                                effectiveType === 'Steam Iron'
                                  ? 'bg-brand-primary/10 text-brand-primary dark:bg-brand-accent/15 dark:text-brand-accent'
                                  : 'bg-slate-50 text-slate-400 dark:bg-brand-dark/30 dark:text-slate-500'
                              }`}
                            >
                              Steam Iron
                            </button>
                          </div>
                        )}

                        {/* Support text when only one option exists */}
                        {(!isDryCleanAvailable || !isSteamIronAvailable) && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
                            Available service: {isDryCleanAvailable ? 'Dry Clean' : 'Steam Iron'}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-50 dark:border-brand-teal/5 flex justify-between items-center">
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                          Est. Delivery: {activeCategory === 'shoes' || activeCategory === 'bags' ? '4 Days' : activeCategory === 'laundry' ? '2 Days' : '3 Days'}
                        </span>
                        <button
                          onClick={() => addToCart(item)}
                          className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-brand-primary dark:text-brand-accent hover:text-brand-deep dark:hover:text-white transition-colors bg-brand-primary/5 dark:bg-brand-accent/5 px-3 py-1.5 rounded-full hover:bg-brand-primary/10 dark:hover:bg-brand-accent/10"
                        >
                          <Plus className="h-3 w-3" />
                          Add to estimate
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            
            <p className="text-[10px] text-slate-400 dark:text-slate-500 italic max-w-lg">
              * Note: Items marked with a pricing range or "+" in the catalog may vary slightly depending on fine fabrics, intricate details, or specific care requirements.
            </p>
          </div>

          {/* Right panel: Est. Cart and summary */}
          <div className="lg:col-span-4 bg-white dark:bg-brand-deep/30 rounded-2xl p-6 border border-slate-100 dark:border-brand-teal/15 shadow-sm space-y-6 lg:sticky lg:top-24">
            
            <div className="flex justify-between items-center">
              <h3 className="text-sm sm:text-base font-bold tracking-wide uppercase text-slate-800 dark:text-white flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-brand-primary dark:text-brand-accent" />
                Estimate Basket ({totalItemsCount})
              </h3>
              {cart.length > 0 && (
                <button 
                  onClick={clearCart}
                  className="text-[10px] font-semibold text-red-500 hover:text-red-600 transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              <AnimatePresence initial={false} mode="popLayout">
                {cart.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-12 text-center"
                  >
                    <Calculator className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 stroke-[1.5]" />
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">No items in your estimate basket yet.</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Tap "+ Add to estimate" on any garment above.</p>
                  </motion.div>
                ) : (
                  cart.map((item, idx) => (
                    <motion.div
                      layout
                      key={`cart-item-${item.id}-${item.serviceType}-${idx}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex justify-between items-center p-3 bg-slate-50 dark:bg-brand-dark/20 rounded-xl border border-slate-100/50 dark:border-brand-teal/5"
                    >
                      <div className="flex items-center gap-2 max-w-[65%] min-w-0">
                        <div className="text-brand-primary dark:text-brand-accent flex items-center justify-center shrink-0">
                          {getItemIcon(item.id || item.name, "h-4 w-4")}
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white truncate">{item.name}</p>
                          <p className="text-[10px] sm:text-xs font-extrabold text-brand-teal dark:text-brand-accent uppercase tracking-wide">
                            {item.serviceType} (₹{item.price})
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center border border-slate-200/60 dark:border-brand-teal/20 rounded-md bg-white dark:bg-brand-deep/50">
                          <button
                            onClick={() => updateQuantity(item.id, item.serviceType, -1)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-brand-dark/40 text-slate-500"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-1 text-xs font-bold font-mono text-slate-800 dark:text-white w-5 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.serviceType, 1)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-brand-dark/40 text-slate-500"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeFromCart(item.id, item.serviceType)}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Total Cost Presentation */}
            <div className="border-t border-slate-100 dark:border-brand-teal/15 pt-4 space-y-3.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">Projected Subtotal</span>
                <span className="text-3xl sm:text-4xl font-black font-mono text-slate-900 dark:text-white">
                  ₹{subtotal}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                  <Sparkles className="h-3.5 w-3.5 text-brand-primary shrink-0 animate-pulse" />
                  <span>Complimentary doorside valet pickup & delivery is included in this estimate!</span>
                </div>
              </div>

              <button
                onClick={() => {
                  if (cart.length > 0) {
                    const quantitiesMap: Record<string, number> = {};
                    let primaryService = 'dry-cleaning';
                    
                    cart.forEach(item => {
                      // Normalize ID mapping
                      let key = item.id;
                      if (key === 'laundry-wash-iron') key = 'laundry-wash-steam-iron';
                      if (key === 'house-blanket-2' || key === 'house-blanket-1') key = 'house-blanket-double';
                      if (key === 'shoes-sneaker' || key === 'shoes-sports') key = 'shoes-sneakers';
                      if (key === 'shoes-suede' || key === 'shoes-boots') key = 'shoes-suede';
                      
                      quantitiesMap[key] = (quantitiesMap[key] || 0) + item.quantity;
                      
                      if (item.serviceType === 'Steam Iron') {
                        primaryService = 'steam-iron';
                      } else if (item.id.includes('laundry')) {
                        primaryService = item.id.includes('iron') ? 'wash-iron' : 'wash-fold';
                      }
                    });

                    onOpenBooking(primaryService, quantitiesMap, 2);
                  } else {
                    onOpenBooking(undefined, undefined, 1);
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-primary text-white py-3.5 text-xs font-bold uppercase tracking-wider shadow-md hover:bg-brand-deep hover:-translate-y-0.5 active:translate-y-0 transition-all dark:bg-brand-accent dark:text-brand-deep dark:hover:bg-white cursor-pointer"
              >
                Schedule Doorstep Pick-up
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
