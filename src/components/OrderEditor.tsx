import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Trash2, Edit3, ShoppingBag, Check, AlertCircle, 
  Minus, Sparkles, RefreshCw, Calculator, ShieldCheck, X,
  ArrowRight, Tag, Percent, ArrowUpDown
} from 'lucide-react';
import { SUB_SERVICES } from './BookingModal';

export interface OrderItem {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  serviceType: string;
}

export interface DynamicPricingConfig {
  mode: 'surcharge' | 'discount' | 'none';
  percentage: number;
  label: string;
}

export interface EditableOrder {
  orderId: string;
  fullName: string;
  email?: string;
  phone?: string;
  address?: string;
  subServices: OrderItem[];
  totalPrice: number;
  status: string;
  dynamicPricing?: DynamicPricingConfig;
  timeline?: { step: number; title: string; desc: string; time: string; done: boolean; active: boolean }[];
  [key: string]: any;
}

export interface OrderEditorProps {
  order: EditableOrder;
  dynamicPricingConfig?: DynamicPricingConfig;
  adminRole?: 'admin' | 'master' | null;
  onSave: (
    orderId: string,
    updatedItems: OrderItem[],
    recalculatedSubtotal: number,
    finalTotalPrice: number,
    editNote?: string
  ) => Promise<void> | void;
  onCancel?: () => void;
  isModalMode?: boolean;
}

// Service presets with typical baseline rate ratios for smart service switching
export const SERVICE_TYPE_PRESETS: { label: string; rateMultiplier: number; categoryHint: string }[] = [
  { label: 'Wash & Fold', rateMultiplier: 0.8, categoryHint: 'laundry' },
  { label: 'Wash & Steam Iron', rateMultiplier: 1.0, categoryHint: 'laundry' },
  { label: 'Steam Iron', rateMultiplier: 0.6, categoryHint: 'laundry' },
  { label: 'Dry Clean', rateMultiplier: 1.5, categoryHint: 'men' },
  { label: 'Premium Dry Clean', rateMultiplier: 1.8, categoryHint: 'men' },
  { label: 'Woolen Dry Clean', rateMultiplier: 1.6, categoryHint: 'woolens' },
  { label: 'Premium Garment Care', rateMultiplier: 2.0, categoryHint: 'women' },
  { label: 'Household Care', rateMultiplier: 1.4, categoryHint: 'household' },
  { label: 'Shoe Spa Treatment', rateMultiplier: 2.2, categoryHint: 'shoes' },
  { label: 'Bag Spa Treatment', rateMultiplier: 2.5, categoryHint: 'bags' },
  { label: 'Kids Care', rateMultiplier: 0.7, categoryHint: 'kids' },
  { label: 'Express 24h Service', rateMultiplier: 1.5, categoryHint: 'general' }
];

export const OrderEditor: React.FC<OrderEditorProps> = ({
  order,
  dynamicPricingConfig,
  adminRole,
  onSave,
  onCancel,
  isModalMode = false
}) => {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>('all');
  
  // Custom item builder state
  const [showCustomAdd, setShowCustomAdd] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('other');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [customQuantity, setCustomQuantity] = useState<string>('1');
  const [customServiceType, setCustomServiceType] = useState<string>('Dry Clean');

  // Manual total override state
  const [isManualTotal, setIsManualTotal] = useState<boolean>(false);
  const [manualTotalPrice, setManualTotalPrice] = useState<string>('');
  const [adminNote, setAdminNote] = useState<string>('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Effective dynamic pricing config: prioritize dynamicPricingConfig prop, then order's saved dynamicPricing
  const effectiveDynamicPricing = useMemo<DynamicPricingConfig>(() => {
    if (dynamicPricingConfig && dynamicPricingConfig.mode !== 'none' && dynamicPricingConfig.percentage > 0) {
      return dynamicPricingConfig;
    }
    if (order.dynamicPricing && order.dynamicPricing.mode !== 'none' && order.dynamicPricing.percentage > 0) {
      return order.dynamicPricing;
    }
    return dynamicPricingConfig || { mode: 'none', percentage: 0, label: 'Standard Rate' };
  }, [dynamicPricingConfig, order.dynamicPricing]);

  // Synchronize initial state when order changes
  useEffect(() => {
    if (order) {
      const initialItems: OrderItem[] = Array.isArray(order.subServices)
        ? order.subServices.map((item, idx) => ({
            id: item.id || `item-${Date.now()}-${idx}`,
            name: item.name || 'Garment Item',
            category: item.category || 'general',
            price: Number(item.price) >= 0 ? Number(item.price) : 0,
            quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
            serviceType: item.serviceType || 'Dry Clean'
          }))
        : [];
      setItems(initialItems);
      setIsManualTotal(false);
      setManualTotalPrice(String(order.totalPrice || 0));
      setAdminNote('');
      setErrorMessage('');
      setSuccessMessage('');
      setSelectedCatalogId('');
      setShowCustomAdd(false);
    }
  }, [order]);

  // Calculate Subtotal in real time
  const itemsSubtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + ((Number(it.price) || 0) * (Number(it.quantity) || 0)), 0);
  }, [items]);

  // Dynamic pricing calculations based on active configuration
  const hasDynamic = effectiveDynamicPricing.mode !== 'none' && effectiveDynamicPricing.percentage > 0;
  const dynamicAdjustmentAmount = useMemo(() => {
    if (!hasDynamic) return 0;
    return Math.round((itemsSubtotal * effectiveDynamicPricing.percentage) / 100);
  }, [hasDynamic, itemsSubtotal, effectiveDynamicPricing.percentage]);

  const calculatedNetTotal = useMemo(() => {
    if (!hasDynamic) return itemsSubtotal;
    if (effectiveDynamicPricing.mode === 'surcharge') {
      return itemsSubtotal + dynamicAdjustmentAmount;
    } else if (effectiveDynamicPricing.mode === 'discount') {
      return Math.max(0, itemsSubtotal - dynamicAdjustmentAmount);
    }
    return itemsSubtotal;
  }, [hasDynamic, itemsSubtotal, dynamicAdjustmentAmount, effectiveDynamicPricing.mode]);

  const effectiveTotalPrice = isManualTotal 
    ? Math.max(0, parseFloat(manualTotalPrice) || 0) 
    : calculatedNetTotal;

  // Handle item property updates
  const handleUpdateItem = (index: number, updates: Partial<OrderItem>) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  // Change Service Type with intelligent real-time catalog price adaptation
  const handleChangeServiceType = (index: number, newServiceType: string) => {
    setItems(prev => {
      const next = [...prev];
      const targetItem = next[index];
      const oldServiceType = targetItem.serviceType;
      
      // Look up if the catalog has an item with identical/similar name under the new service type
      const normalizedName = targetItem.name.toLowerCase().trim();
      const catalogMatch = SUB_SERVICES.find(s => 
        s.serviceType.toLowerCase() === newServiceType.toLowerCase() && 
        (s.name.toLowerCase().includes(normalizedName) || normalizedName.includes(s.name.toLowerCase()))
      );

      let adjustedPrice = targetItem.price;

      if (catalogMatch) {
        adjustedPrice = catalogMatch.price;
      } else {
        // Apply relative service rate preset multiplier ratio if changing across different care levels
        const oldPreset = SERVICE_TYPE_PRESETS.find(p => p.label.toLowerCase() === oldServiceType.toLowerCase());
        const newPreset = SERVICE_TYPE_PRESETS.find(p => p.label.toLowerCase() === newServiceType.toLowerCase());

        if (oldPreset && newPreset && oldPreset.rateMultiplier > 0) {
          const ratio = newPreset.rateMultiplier / oldPreset.rateMultiplier;
          adjustedPrice = Math.max(10, Math.round(targetItem.price * ratio));
        }
      }

      next[index] = {
        ...targetItem,
        serviceType: newServiceType,
        price: adjustedPrice
      };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Add an item from the standard catalog
  const handleAddFromCatalog = () => {
    if (!selectedCatalogId) return;
    const found = SUB_SERVICES.find(s => s.id === selectedCatalogId);
    if (!found) return;

    const newItem: OrderItem = {
      id: `${found.id}-${Date.now()}`,
      name: found.name,
      category: found.category,
      price: found.price,
      quantity: 1,
      serviceType: found.serviceType
    };

    setItems(prev => [...prev, newItem]);
    setSelectedCatalogId('');
  };

  // Add custom garment item
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      setErrorMessage('Please provide an item description.');
      return;
    }
    const parsedPrice = parseFloat(customPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setErrorMessage('Please enter a valid unit rate (₹).');
      return;
    }
    const parsedQty = parseFloat(customQuantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setErrorMessage('Please enter a valid quantity or weight.');
      return;
    }

    const newItem: OrderItem = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      category: customCategory,
      price: parsedPrice,
      quantity: parsedQty,
      serviceType: customServiceType
    };

    setItems(prev => [...prev, newItem]);
    setCustomName('');
    setCustomPrice('');
    setCustomQuantity('1');
    setErrorMessage('');
    setShowCustomAdd(false);
  };

  // Submit and save updated items & recalculations
  const handleSave = async () => {
    if (items.length === 0) {
      setErrorMessage('Booking must have at least one garment or service item.');
      return;
    }

    for (const item of items) {
      if (!item.name.trim()) {
        setErrorMessage('All items must have a garment name.');
        return;
      }
      if (isNaN(item.price) || item.price < 0) {
        setErrorMessage(`Invalid rate for "${item.name}".`);
        return;
      }
      if (isNaN(item.quantity) || item.quantity <= 0) {
        setErrorMessage(`Invalid quantity for "${item.name}".`);
        return;
      }
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await onSave(
        order.orderId,
        items,
        itemsSubtotal,
        effectiveTotalPrice,
        adminNote.trim() || undefined
      );

      setSuccessMessage('Order items and recalculated totals saved successfully!');
      setTimeout(() => {
        if (onCancel) onCancel();
      }, 700);
    } catch (err: any) {
      console.error('Failed saving order in OrderEditor:', err);
      setErrorMessage(err?.message || 'Failed to update order items. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered catalog options
  const catalogOptions = SUB_SERVICES.filter(sub => {
    if (catalogCategoryFilter === 'all') return true;
    return sub.category === catalogCategoryFilter;
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Info Banner */}
      <div className="p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-brand-deep/40 border border-slate-200 dark:border-brand-teal/10 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-black bg-brand-primary/10 text-brand-primary dark:bg-brand-accent/20 dark:text-brand-accent px-2.5 py-1 rounded-md">
            #{order.orderId}
          </span>
          <span className="text-xs font-bold text-slate-800 dark:text-white">
            {order.fullName}
          </span>
          {order.phone && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              • {order.phone}
            </span>
          )}
          <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            {adminRole === 'master' ? 'Master Admin' : 'Admin'}
          </span>
        </div>

        {/* Dynamic Pricing Live Status Pill */}
        <div className="flex items-center gap-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
          <Percent className="h-3 w-3 text-teal-600 dark:text-teal-400" />
          <span>
            {hasDynamic 
              ? `${effectiveDynamicPricing.label} (${effectiveDynamicPricing.mode === 'surcharge' ? '+' : '-'}${effectiveDynamicPricing.percentage}%)`
              : 'Standard Base Rates'
            }
          </span>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ITEMS LISTING TABLE */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 font-mono flex items-center gap-1.5">
            <ShoppingBag className="h-3.5 w-3.5 text-brand-primary dark:text-brand-accent" />
            Order Garments ({items.length})
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Raw Subtotal: <strong className="text-slate-900 dark:text-white font-bold">₹{itemsSubtotal.toFixed(2)}</strong>
          </span>
        </div>

        {items.length === 0 ? (
          <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-brand-teal/10 bg-slate-50/50 dark:bg-brand-deep/20 text-slate-400">
            <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs font-semibold">No garments itemized in this booking.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Use the catalog selector or custom item builder below to add garments.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {items.map((item, idx) => {
              const isLaundry = item.category === 'laundry' || item.id.includes('kg') || item.name.toLowerCase().includes('kg');
              const lineTotal = (Number(item.quantity) || 0) * (Number(item.price) || 0);

              return (
                <div
                  key={`order-item-${item.id}-${idx}`}
                  className="p-3 rounded-xl border border-slate-200 dark:border-brand-teal/10 bg-white dark:bg-brand-deep/30 hover:border-brand-primary/30 transition-all space-y-2 shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    
                    {/* Item Name Input & Service Type Selector */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-7">
                        <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5 font-mono">
                          Garment / Item Name
                        </label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateItem(idx, { name: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-brand-teal/20 bg-slate-50/50 dark:bg-brand-dark text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-brand-primary"
                          placeholder="Garment name"
                        />
                      </div>

                      <div className="sm:col-span-5">
                        <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5 font-mono flex items-center justify-between">
                          <span>Service Type</span>
                          <span className="text-[8px] text-teal-600 dark:text-teal-400 font-normal">Auto-prices</span>
                        </label>
                        <select
                          value={item.serviceType}
                          onChange={(e) => handleChangeServiceType(idx, e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-teal-500/30 dark:border-brand-teal/30 bg-teal-50/40 dark:bg-brand-dark text-xs font-semibold text-teal-900 dark:text-teal-200 focus:outline-hidden focus:ring-1 focus:ring-teal-500 cursor-pointer"
                        >
                          {SERVICE_TYPE_PRESETS.map((preset) => (
                            <option key={preset.label} value={preset.label}>
                              {preset.label}
                            </option>
                          ))}
                          {!SERVICE_TYPE_PRESETS.some(p => p.label === item.serviceType) && (
                            <option value={item.serviceType}>{item.serviceType}</option>
                          )}
                        </select>
                      </div>
                    </div>

                    {/* Quantity Stepper, Unit Rate, and Line Total */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-brand-teal/5">
                      
                      {/* Quantity / Weight Stepper & Input */}
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-bold uppercase text-slate-400 mb-0.5 font-mono">
                          {isLaundry ? 'Weight (KG)' : 'Qty'}
                        </span>
                        <div className="flex items-center border border-slate-200 dark:border-brand-teal/20 bg-slate-50 dark:bg-brand-dark rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              const step = isLaundry ? 0.5 : 1;
                              const next = Math.max(isLaundry ? 0.5 : 1, Math.round(((item.quantity || 1) - step) * 10) / 10);
                              handleUpdateItem(idx, { quantity: next });
                            }}
                            className="h-6 w-6 rounded flex items-center justify-center text-slate-500 hover:bg-white dark:hover:bg-brand-deep cursor-pointer"
                            title="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          
                          <input
                            type="number"
                            step={isLaundry ? '0.1' : '1'}
                            min={isLaundry ? '0.1' : '1'}
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              handleUpdateItem(idx, { quantity: isNaN(val) ? 0 : val });
                            }}
                            className="w-12 text-center text-xs font-bold font-mono bg-transparent border-none focus:outline-hidden text-slate-800 dark:text-white"
                          />

                          <button
                            type="button"
                            onClick={() => {
                              const step = isLaundry ? 0.5 : 1;
                              const next = Math.round(((item.quantity || 0) + step) * 10) / 10;
                              handleUpdateItem(idx, { quantity: next });
                            }}
                            className="h-6 w-6 rounded flex items-center justify-center text-slate-500 hover:bg-white dark:hover:bg-brand-deep cursor-pointer"
                            title="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* Unit Price Input */}
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-bold uppercase text-slate-400 mb-0.5 font-mono">
                          Rate (₹)
                        </span>
                        <div className="flex items-center px-2 py-1 rounded-lg border border-slate-200 dark:border-brand-teal/20 bg-slate-50/50 dark:bg-brand-dark">
                          <span className="text-[10px] text-slate-400 mr-1 font-mono">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={item.price}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              handleUpdateItem(idx, { price: isNaN(val) ? 0 : val });
                            }}
                            className="w-14 text-xs font-bold font-mono bg-transparent border-none focus:outline-hidden text-slate-800 dark:text-white"
                          />
                        </div>
                      </div>

                      {/* Line Total */}
                      <div className="flex flex-col items-end min-w-[65px]">
                        <span className="text-[9px] font-bold uppercase text-slate-400 mb-0.5 font-mono">
                          Line Total
                        </span>
                        <span className="text-xs font-black font-mono text-brand-primary dark:text-brand-accent">
                          ₹{lineTotal.toFixed(0)}
                        </span>
                      </div>

                      {/* Delete item button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer ml-0.5"
                        title="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADD ITEMS SECTION */}
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-brand-deep/20 border border-slate-200/70 dark:border-brand-teal/10 space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            Add Garments & Services to Order
          </h4>

          <button
            type="button"
            onClick={() => setShowCustomAdd(!showCustomAdd)}
            className="text-[11px] font-bold text-brand-primary dark:text-brand-accent hover:underline cursor-pointer flex items-center gap-1"
          >
            {showCustomAdd ? '← Select from Catalog' : '+ Add Custom Special Item'}
          </button>
        </div>

        {!showCustomAdd ? (
          /* Catalog Picker */
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-4">
              <select
                value={catalogCategoryFilter}
                onChange={(e) => setCatalogCategoryFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-brand-teal/20 bg-white dark:bg-brand-dark text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus:ring-1 focus:ring-brand-primary"
              >
                <option value="all">All Categories</option>
                <option value="laundry">Laundry / KG</option>
                <option value="men">Men's Wear</option>
                <option value="women">Women's Wear</option>
                <option value="kids">Kids Wear</option>
                <option value="woolens">Woolens & Coats</option>
                <option value="household">Household</option>
                <option value="shoes">Footwear & Spa</option>
                <option value="bags">Leather Bags</option>
              </select>
            </div>

            <div className="sm:col-span-6">
              <select
                value={selectedCatalogId}
                onChange={(e) => setSelectedCatalogId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-brand-teal/20 bg-white dark:bg-brand-dark text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus:ring-1 focus:ring-brand-primary"
              >
                <option value="">-- Choose garment / service to add --</option>
                {catalogOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name} — ₹{opt.price} ({opt.serviceType})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={handleAddFromCatalog}
                disabled={!selectedCatalogId}
                className="w-full h-full min-h-[34px] px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
          </div>
        ) : (
          /* Custom Item Form */
          <form onSubmit={handleAddCustomItem} className="space-y-2.5 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div className="sm:col-span-2">
                <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5 font-mono">
                  Garment Description
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Silk Dupatta with Zari"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-brand-teal/20 bg-white dark:bg-brand-dark text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-brand-primary"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5 font-mono">
                  Service Type
                </label>
                <select
                  value={customServiceType}
                  onChange={(e) => setCustomServiceType(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-brand-teal/20 bg-white dark:bg-brand-dark text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer focus:ring-1 focus:ring-brand-primary"
                >
                  {SERVICE_TYPE_PRESETS.map((p) => (
                    <option key={p.label} value={p.label}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5 font-mono">
                  Category
                </label>
                <select
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-brand-teal/20 bg-white dark:bg-brand-dark text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer focus:ring-1 focus:ring-brand-primary"
                >
                  <option value="men">Men</option>
                  <option value="women">Women</option>
                  <option value="kids">Kids</option>
                  <option value="woolens">Woolens</option>
                  <option value="household">Household</option>
                  <option value="shoes">Shoes</option>
                  <option value="bags">Bags</option>
                  <option value="laundry">Laundry / KG</option>
                  <option value="other">Special / Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5 font-mono">
                  Unit Rate (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="e.g. 150"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-brand-teal/20 bg-white dark:bg-brand-dark text-xs font-bold font-mono text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-brand-primary"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5 font-mono">
                  Quantity / Weight
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={customQuantity}
                  onChange={(e) => setCustomQuantity(e.target.value)}
                  placeholder="1"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-brand-teal/20 bg-white dark:bg-brand-dark text-xs font-bold font-mono text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-brand-primary"
                />
              </div>

              <div className="sm:col-span-2 flex items-end">
                <button
                  type="submit"
                  className="w-full py-1.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Custom Garment
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* REAL-TIME DYNAMIC FINANCIAL BREAKDOWN */}
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-brand-deep/30 border border-slate-200/80 dark:border-brand-teal/10 space-y-2.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1.5">
            <Calculator className="h-3.5 w-3.5 text-brand-primary dark:text-brand-accent" />
            Financial Recalculation & Subtotal
          </h4>

          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={isManualTotal}
              onChange={(e) => {
                setIsManualTotal(e.target.checked);
                if (e.target.checked) {
                  setManualTotalPrice(String(calculatedNetTotal));
                }
              }}
              className="rounded text-brand-primary focus:ring-brand-primary"
            />
            <span>Manual Price Override</span>
          </label>
        </div>

        <div className="space-y-1.5 text-xs font-mono">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Garments Subtotal:</span>
            <span className="font-bold text-slate-800 dark:text-white">₹{itemsSubtotal.toFixed(2)}</span>
          </div>

          {hasDynamic && (
            <div className="flex justify-between text-teal-600 dark:text-teal-400 font-semibold">
              <span className="flex items-center gap-1">
                <Percent className="h-3 w-3" />
                {effectiveDynamicPricing.label} ({effectiveDynamicPricing.percentage}% {effectiveDynamicPricing.mode}):
              </span>
              <span className="font-bold">
                {effectiveDynamicPricing.mode === 'surcharge' ? '+' : '-'}₹{dynamicAdjustmentAmount.toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-brand-teal/10 text-sm">
            <span className="font-bold text-slate-900 dark:text-white">
              {isManualTotal ? 'Overridden Net Bill:' : 'Recalculated Net Total:'}
            </span>

            {isManualTotal ? (
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  value={manualTotalPrice}
                  onChange={(e) => setManualTotalPrice(e.target.value)}
                  className="w-24 px-2 py-1 rounded-lg border border-brand-primary dark:border-brand-accent bg-white dark:bg-brand-dark text-base font-bold font-mono text-brand-primary dark:text-brand-accent text-right focus:outline-hidden"
                />
              </div>
            ) : (
              <span className="text-base font-black font-mono text-brand-primary dark:text-brand-accent">
                ₹{calculatedNetTotal.toFixed(2)}
              </span>
            )}
          </div>

          {order.totalPrice !== undefined && effectiveTotalPrice !== order.totalPrice && (
            <div className="flex justify-end text-[10px] text-slate-400 pt-0.5">
              <span>
                Previous Total: ₹{order.totalPrice} → Variance: {effectiveTotalPrice > order.totalPrice ? '+' : ''}₹{(effectiveTotalPrice - order.totalPrice).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Administrative Audit Note */}
        <div className="pt-1.5">
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1 font-mono">
            Administrative Audit Note (Appended to Customer & Order Timeline)
          </label>
          <input
            type="text"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="e.g. Changed 2 shirts from Wash & Fold to Dry Clean after inspection; weighed 5.4 kg"
            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-brand-teal/20 bg-white dark:bg-brand-dark text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-brand-primary"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex items-center justify-between gap-3 shrink-0">
        <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
          {items.length} items • Final ₹{effectiveTotalPrice.toFixed(2)}
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-brand-teal/20 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-brand-deep transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting || items.length === 0}
            className="px-5 py-2 rounded-xl text-xs font-black bg-brand-primary dark:bg-brand-accent text-white dark:text-brand-deep hover:brightness-105 transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Saving Changes...
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                Save & Update Order
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderEditor;
