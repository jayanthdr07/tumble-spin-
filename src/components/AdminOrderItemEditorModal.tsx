import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Plus, Trash2, Edit3, ShoppingBag, Check, AlertCircle, 
  Minus, Sparkles, RefreshCw, Calculator, ArrowRight, ShieldCheck
} from 'lucide-react';
import { SUB_SERVICES, SubService } from './BookingModal';

export interface OrderItem {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  serviceType: string;
}

export interface EditableOrder {
  orderId: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  subServices: OrderItem[];
  totalPrice: number;
  status: string;
  dynamicPricing?: {
    mode: 'surcharge' | 'discount' | 'none';
    percentage: number;
    label: string;
  };
  timeline?: { step: number; title: string; desc: string; time: string; done: boolean; active: boolean }[];
  [key: string]: any;
}

interface AdminOrderItemEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: EditableOrder | null;
  adminRole: 'admin' | 'master' | null;
  onSave: (
    orderId: string, 
    updatedItems: OrderItem[], 
    updatedTotalPrice: number, 
    editNote?: string
  ) => Promise<void> | void;
}

const SERVICE_TYPE_PRESETS = [
  'Wash & Fold',
  'Wash & Steam Iron',
  'Dry Clean',
  'Premium Dry Clean',
  'Steam Iron',
  'Premium Garment Care',
  'Woolen Dry Clean',
  'Household Care',
  'Shoe Spa Treatment',
  'Bag Spa Treatment',
  'Kids Care',
  'Express 24h Service'
];

export const AdminOrderItemEditorModal: React.FC<AdminOrderItemEditorModalProps> = ({
  isOpen,
  onClose,
  order,
  adminRole,
  onSave
}) => {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>('all');
  
  // Custom item state
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

  // Synchronize initial state when order opens
  useEffect(() => {
    if (order) {
      const initialItems: OrderItem[] = Array.isArray(order.subServices) 
        ? order.subServices.map((item, idx) => ({
            id: item.id || `item-${Date.now()}-${idx}`,
            name: item.name || 'Garment Item',
            category: item.category || 'general',
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 1,
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
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  // Compute live subtotal
  const itemsSubtotal = items.reduce((acc, it) => acc + (Number(it.price || 0) * Number(it.quantity || 0)), 0);

  // Dynamic pricing calculations (if stored on order)
  const hasDynamic = Boolean(
    order.dynamicPricing && 
    order.dynamicPricing.mode !== 'none' && 
    (order.dynamicPricing.percentage || 0) > 0
  );
  const dynamicPercentage = hasDynamic ? order.dynamicPricing!.percentage : 0;
  const dynamicMode = hasDynamic ? order.dynamicPricing!.mode : 'none';
  const dynamicLabel = hasDynamic ? (order.dynamicPricing!.label || (dynamicMode === 'surcharge' ? 'Dynamic Surcharge' : 'Discount')) : '';
  
  let calculatedNetTotal = itemsSubtotal;
  if (hasDynamic && dynamicMode === 'surcharge') {
    calculatedNetTotal = Math.round(itemsSubtotal + (itemsSubtotal * dynamicPercentage) / 100);
  } else if (hasDynamic && dynamicMode === 'discount') {
    calculatedNetTotal = Math.max(0, Math.round(itemsSubtotal - (itemsSubtotal * dynamicPercentage) / 100));
  }

  const effectiveTotalPrice = isManualTotal 
    ? Math.max(0, parseFloat(manualTotalPrice) || 0) 
    : calculatedNetTotal;

  // Item modification handlers
  const handleUpdateItem = (index: number, updates: Partial<OrderItem>) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

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

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      setErrorMessage('Please provide an item name.');
      return;
    }
    const parsedPrice = parseFloat(customPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setErrorMessage('Please provide a valid unit price.');
      return;
    }
    const parsedQty = parseFloat(customQuantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setErrorMessage('Please provide a valid quantity or weight.');
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

  const handleSubmit = async () => {
    if (items.length === 0) {
      setErrorMessage('The order must contain at least one item. Add an item or cancel.');
      return;
    }

    // Validate quantities and prices
    for (const item of items) {
      if (!item.name.trim()) {
        setErrorMessage('All items must have a valid garment name.');
        return;
      }
      if (isNaN(item.price) || item.price < 0) {
        setErrorMessage(`Invalid price for "${item.name}".`);
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
        effectiveTotalPrice,
        adminNote.trim() || undefined
      );

      setSuccessMessage('Order items and total updated successfully!');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Error saving order items:', err);
      setErrorMessage(err?.message || 'Failed to save changes. Please try again.');
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
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-3xl bg-white dark:bg-brand-dark rounded-2xl shadow-2xl border border-slate-200 dark:border-brand-teal/20 overflow-hidden my-auto z-10 flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-brand-deep/50 border-b border-slate-200/80 dark:border-brand-teal/10 flex items-start justify-between gap-4 shrink-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold bg-brand-primary/10 text-brand-primary dark:bg-brand-accent/20 dark:text-brand-accent px-2 py-0.5 rounded-md">
                  #{order.orderId}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  {adminRole === 'master' ? 'Master Admin Access' : 'Admin Access'}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  Client: <strong className="text-slate-800 dark:text-white">{order.fullName}</strong> ({order.phone})
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-serif font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-brand-primary dark:text-brand-accent" />
                Edit Ordered Garments & Booking Items
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Adjust quantities, weighed laundry kilograms, rates, add missing garments, or remove items.
              </p>
            </div>

            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-brand-deep transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Feedback messages */}
          {errorMessage && (
            <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Body content */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
            
            {/* Active Items Table / List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                  Garments in Order ({items.length})
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Subtotal: <strong className="text-slate-900 dark:text-white">₹{itemsSubtotal.toFixed(2)}</strong>
                </span>
              </div>

              {items.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-brand-teal/10 bg-slate-50/50 dark:bg-brand-deep/20 text-slate-400">
                  <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-semibold">No items currently itemized in this booking.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Use the catalog selector or custom item builder below to add garments.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[310px] overflow-y-auto pr-1">
                  {items.map((item, idx) => {
                    const isLaundry = item.category === 'laundry' || item.id.includes('kg') || item.name.toLowerCase().includes('kg');
                    const lineTotal = (Number(item.quantity) || 0) * (Number(item.price) || 0);

                    return (
                      <div
                        key={`edit-item-${item.id}-${idx}`}
                        className="p-3 rounded-xl border border-slate-200 dark:border-brand-teal/10 bg-white dark:bg-brand-deep/30 hover:border-brand-primary/30 transition-all space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          {/* Item Name & Service Type inputs */}
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5 font-mono">
                                Item / Garment Name
                              </label>
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleUpdateItem(idx, { name: e.target.value })}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-brand-teal/20 bg-slate-50/50 dark:bg-brand-dark text-xs font-semibold text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-brand-primary"
                                placeholder="Garment name"
                              />
                            </div>

                            <div>
                              <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5 font-mono">
                                Care / Service Type
                              </label>
                              <select
                                value={item.serviceType}
                                onChange={(e) => handleUpdateItem(idx, { serviceType: e.target.value })}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-brand-teal/20 bg-slate-50/50 dark:bg-brand-dark text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-brand-primary cursor-pointer"
                              >
                                {SERVICE_TYPE_PRESETS.map((preset) => (
                                  <option key={preset} value={preset}>
                                    {preset}
                                  </option>
                                ))}
                                {!SERVICE_TYPE_PRESETS.includes(item.serviceType) && (
                                  <option value={item.serviceType}>{item.serviceType}</option>
                                )}
                              </select>
                            </div>
                          </div>

                          {/* Stepper, Rate, Line Total & Delete */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-brand-teal/5">
                            
                            {/* Quantity Stepper */}
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

                            {/* Unit Price */}
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
                                Total
                              </span>
                              <span className="text-xs font-bold font-mono text-brand-primary dark:text-brand-accent">
                                ₹{lineTotal.toFixed(0)}
                              </span>
                            </div>

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer ml-1"
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
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-brand-deep/20 border border-slate-200/70 dark:border-brand-teal/10 space-y-3">
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
                <form onSubmit={handleAddCustomItem} className="space-y-3 pt-1">
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
                          <option key={p} value={p}>{p}</option>
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

            {/* ORDER FINANCIAL SUMMARY & RECALCULATION */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-brand-deep/30 border border-slate-200/80 dark:border-brand-teal/10 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1.5">
                  <Calculator className="h-3.5 w-3.5 text-brand-primary dark:text-brand-accent" />
                  Order Financials & Total
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
                  <div className="flex justify-between text-teal-600 dark:text-teal-400">
                    <span>
                      {dynamicLabel} ({dynamicPercentage}% {dynamicMode}):
                    </span>
                    <span className="font-bold">
                      {dynamicMode === 'surcharge' ? '+' : '-'}₹
                      {Math.round((itemsSubtotal * dynamicPercentage) / 100).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-brand-teal/10 text-sm">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {isManualTotal ? 'Overridden Net Bill:' : 'Calculated Net Bill:'}
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
                    <span className="text-base font-bold font-mono text-brand-primary dark:text-brand-accent">
                      ₹{calculatedNetTotal.toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Diff from original */}
                {order.totalPrice !== undefined && effectiveTotalPrice !== order.totalPrice && (
                  <div className="flex justify-end text-[10px] text-slate-400 pt-0.5">
                    <span>
                      Previous: ₹{order.totalPrice} → Difference: {effectiveTotalPrice > order.totalPrice ? '+' : ''}₹{(effectiveTotalPrice - order.totalPrice).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Admin Note / Reason */}
              <div className="pt-2">
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1 font-mono">
                  Administrative Reason / Note (Appended to Customer & Studio Timeline)
                </label>
                <input
                  type="text"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="e.g. Weighed at facility: 5.2 kg; added 1 silk shirt on phone confirmation"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-brand-teal/20 bg-white dark:bg-brand-dark text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-brand-primary"
                />
              </div>
            </div>

          </div>

          {/* Modal Footer */}
          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-brand-deep/50 border-t border-slate-200/80 dark:border-brand-teal/10 flex items-center justify-between gap-3 shrink-0">
            <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
              {items.length} items • ₹{effectiveTotalPrice.toFixed(2)}
            </div>

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-brand-teal/20 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-brand-deep transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSubmit}
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AdminOrderItemEditorModal;
