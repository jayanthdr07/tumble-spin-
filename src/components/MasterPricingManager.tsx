import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Check, RefreshCw, Sparkles, AlertCircle, 
  Tag, Percent, Save, ArrowRight, ShieldCheck, 
  RotateCcw, Sliders, CheckCircle2, Zap, Info, Filter,
  ChevronDown, ChevronUp, Plus, Edit2, Trash2, X
} from 'lucide-react';
import { 
  MASTER_PRICING_CATALOG, 
  MASTER_PRICING_CATEGORIES, 
  MasterPricingItem 
} from '../data/masterPricingCatalog';
import { useMasterCatalog } from '../utils/catalogStore';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

interface DynamicPricingConfig {
  mode: 'surcharge' | 'discount' | 'none';
  percentage: number;
  label: string;
}

interface MasterPricingManagerProps {
  dynamicPricing: DynamicPricingConfig;
  onUpdateDynamicPricing: (config: DynamicPricingConfig) => void;
}

export default function MasterPricingManager({
  dynamicPricing,
  onUpdateDynamicPricing
}: MasterPricingManagerProps) {
  // Load current saved prices
  const [customPrices, setCustomPrices] = useState<any>(() => {
    const saved = localStorage.getItem('tumblespin_custom_prices');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return { services: {}, estimator: {}, booking: {} };
  });

  // Working draft state
  const [draftPrices, setDraftPrices] = useState<any>({ services: {}, estimator: {}, booking: {} });
  
  // Seasonal adjustment draft
  const [localPricingMode, setLocalPricingMode] = useState<'surcharge' | 'discount' | 'none'>(dynamicPricing.mode);
  const [localPricingPercentage, setLocalPricingPercentage] = useState<number>(dynamicPricing.percentage || 15);
  const [localPricingLabel, setLocalPricingLabel] = useState<string>(dynamicPricing.label || 'Festive Peak Surge');
  const [showSeasonalRules, setShowSeasonalRules] = useState<boolean>(dynamicPricing.mode !== 'none');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Master Catalog Cloud Store
  const { items: liveCatalogItems, addItem, updateItem, deleteItem } = useMasterCatalog();

  // Add / Edit Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [newItemData, setNewItemData] = useState<{
    name: string;
    category: string;
    defaultPrice: number;
    unit: string;
    serviceType: string;
    description: string;
  }>({
    name: '',
    category: 'men',
    defaultPrice: 99,
    unit: 'per pc',
    serviceType: 'Premium Dry Clean',
    description: ''
  });

  const [editingItem, setEditingItem] = useState<MasterPricingItem | null>(null);

  // Feedback states
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Sync state with incoming props or external updates
  useEffect(() => {
    const loadPrices = () => {
      const saved = localStorage.getItem('tumblespin_custom_prices');
      let parsed = { services: {}, estimator: {}, booking: {} };
      if (saved) {
        try {
          parsed = JSON.parse(saved);
        } catch (e) {}
      }
      setCustomPrices(parsed);
      setDraftPrices(JSON.parse(JSON.stringify(parsed)));
    };

    loadPrices();

    const handleStorage = (e?: any) => {
      if (e?.detail) {
        setCustomPrices(e.detail);
        setDraftPrices(JSON.parse(JSON.stringify(e.detail)));
        return;
      }
      loadPrices();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('tumblespin_custom_prices_updated', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('tumblespin_custom_prices_updated', handleStorage);
    };
  }, []);

  useEffect(() => {
    setLocalPricingMode(dynamicPricing.mode);
    setLocalPricingPercentage(dynamicPricing.percentage || 15);
    setLocalPricingLabel(dynamicPricing.label || 'Festive Peak Surge');
  }, [dynamicPricing]);

  // Helper to check if an item has active custom override
  const getItemCurrentValue = (item: MasterPricingItem) => {
    // 1. Direct booking override
    const bookingVal = draftPrices?.booking?.[item.id];
    if (bookingVal !== undefined && bookingVal !== null && bookingVal !== '') {
      return Number(bookingVal);
    }
    // 2. Service key override
    if (item.serviceKey) {
      const serviceVal = draftPrices?.services?.[item.serviceKey];
      if (serviceVal !== undefined && serviceVal !== null && serviceVal !== '') {
        return Number(serviceVal);
      }
    }
    // 3. Estimator dry clean override
    if (item.estimatorItemId) {
      const estVal = draftPrices?.estimator?.[item.estimatorItemId]?.dryClean;
      if (estVal !== undefined && estVal !== null && estVal !== '') {
        return Number(estVal);
      }
    }
    return null;
  };

  const getEstimatorSteamValue = (item: MasterPricingItem) => {
    if (!item.estimatorItemId) return null;
    const val = draftPrices?.estimator?.[item.estimatorItemId]?.steamIron;
    if (val !== undefined && val !== null && val !== '') {
      return Number(val);
    }
    return null;
  };

  // Helper to update price for an item
  const handleItemPriceChange = (item: MasterPricingItem, rawVal: string) => {
    const trimmed = rawVal.trim();
    const numVal = trimmed === '' || isNaN(Number(trimmed)) ? null : parseFloat(trimmed);

    setDraftPrices((prev: any) => {
      const newBooking = { ...prev.booking };
      const newServices = { ...prev.services };
      const newEstimator = { ...prev.estimator };

      if (numVal === null) {
        delete newBooking[item.id];
        if (item.serviceKey) delete newServices[item.serviceKey];
        if (item.estimatorItemId && newEstimator[item.estimatorItemId]) {
          delete newEstimator[item.estimatorItemId].dryClean;
          if (Object.keys(newEstimator[item.estimatorItemId]).length === 0) {
            delete newEstimator[item.estimatorItemId];
          }
        }
      } else {
        newBooking[item.id] = numVal;
        if (item.serviceKey) newServices[item.serviceKey] = numVal;
        if (item.estimatorItemId) {
          newEstimator[item.estimatorItemId] = {
            ...(newEstimator[item.estimatorItemId] || {}),
            dryClean: numVal
          };
        }
      }

      return {
        ...prev,
        booking: newBooking,
        services: newServices,
        estimator: newEstimator
      };
    });
  };

  // Helper to update steam iron price for dual-service items
  const handleSteamPriceChange = (item: MasterPricingItem, rawVal: string) => {
    if (!item.estimatorItemId) return;
    const trimmed = rawVal.trim();
    const numVal = trimmed === '' || isNaN(Number(trimmed)) ? null : parseFloat(trimmed);

    setDraftPrices((prev: any) => {
      const newEstimator = { ...prev.estimator };
      if (numVal === null) {
        if (newEstimator[item.estimatorItemId!]) {
          delete newEstimator[item.estimatorItemId!].steamIron;
          if (Object.keys(newEstimator[item.estimatorItemId!]).length === 0) {
            delete newEstimator[item.estimatorItemId!];
          }
        }
      } else {
        newEstimator[item.estimatorItemId!] = {
          ...(newEstimator[item.estimatorItemId!] || {}),
          steamIron: numVal
        };
      }
      return {
        ...prev,
        estimator: newEstimator
      };
    });
  };

  // Reset single item
  const handleResetSingleItem = (item: MasterPricingItem) => {
    handleItemPriceChange(item, '');
    if (item.estimatorItemId) {
      handleSteamPriceChange(item, '');
    }
  };

  // Filtered list of items from live catalog
  const filteredCatalog = useMemo(() => {
    return liveCatalogItems.filter(item => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSearch = searchQuery.trim() === '' || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.categoryLabel && item.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [liveCatalogItems, selectedCategory, searchQuery]);

  // Group filtered catalog by category
  const groupedCatalog = useMemo(() => {
    const groups: { [cat: string]: MasterPricingItem[] } = {};
    filteredCatalog.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredCatalog]);

  // Count active overrides
  const totalOverridesCount = useMemo(() => {
    let count = 0;
    liveCatalogItems.forEach(item => {
      if (getItemCurrentValue(item) !== null || getEstimatorSteamValue(item) !== null) {
        count++;
      }
    });
    return count;
  }, [liveCatalogItems, draftPrices]);

  // Handle Adding a Brand New Item to Catalog
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemData.name.trim()) {
      setErrorMsg('Item name is required.');
      return;
    }
    setIsSubmittingItem(true);
    try {
      await addItem({
        name: newItemData.name.trim(),
        category: newItemData.category,
        defaultPrice: Number(newItemData.defaultPrice) || 99,
        unit: newItemData.unit || 'per pc',
        serviceType: newItemData.serviceType || 'Premium Care',
        description: newItemData.description.trim()
      });
      setShowAddModal(false);
      setNewItemData({
        name: '',
        category: 'men',
        defaultPrice: 99,
        unit: 'per pc',
        serviceType: 'Premium Dry Clean',
        description: ''
      });
      setSuccessMsg('✨ New item added to catalog and synchronized live with Firestore!');
      setTimeout(() => setSuccessMsg(''), 4500);
    } catch (err) {
      console.error('Error adding item:', err);
      setErrorMsg('Failed to add item. Please try again.');
    } finally {
      setIsSubmittingItem(false);
    }
  };

  // Handle Updating Existing Item Details
  const handleUpdateItemDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.name.trim()) return;
    setIsSubmittingItem(true);
    try {
      await updateItem(editingItem.id, {
        name: editingItem.name.trim(),
        category: editingItem.category,
        defaultPrice: Number(editingItem.defaultPrice) || 0,
        unit: editingItem.unit || 'per pc',
        serviceType: editingItem.serviceType || 'Premium Care',
        description: editingItem.description?.trim() || ''
      });
      setEditingItem(null);
      setSuccessMsg('✨ Item details updated and synced across all pages!');
      setTimeout(() => setSuccessMsg(''), 4500);
    } catch (err) {
      console.error('Error updating item:', err);
      setErrorMsg('Failed to update item details.');
    } finally {
      setIsSubmittingItem(false);
    }
  };

  // Handle Deleting an Item
  const handleDeleteItem = async (item: MasterPricingItem) => {
    if (window.confirm(`Are you sure you want to remove "${item.name}" from the pricing catalog?`)) {
      try {
        await deleteItem(item.id);
        setSuccessMsg(`Item "${item.name}" was removed from the catalog.`);
        setTimeout(() => setSuccessMsg(''), 4000);
      } catch (err) {
        console.error('Error deleting item:', err);
        setErrorMsg('Failed to delete item from catalog.');
      }
    }
  };

  // Save and Publish Handler
  const handleSaveAndPublish = async () => {
    setIsSaving(true);
    setErrorMsg('');
    try {
      const sanitized = {
        services: { ...draftPrices.services },
        estimator: { ...draftPrices.estimator },
        booking: { ...draftPrices.booking }
      };

      // 1. LocalStorage
      localStorage.setItem('tumblespin_custom_prices', JSON.stringify(sanitized));
      setCustomPrices(sanitized);

      // 2. Dynamic pricing update
      const updatedDynamic: DynamicPricingConfig = {
        mode: localPricingMode,
        percentage: localPricingPercentage,
        label: localPricingLabel
      };
      onUpdateDynamicPricing(updatedDynamic);
      localStorage.setItem('tumblespin_dynamic_pricing', JSON.stringify(updatedDynamic));

      // 3. Direct Firestore push for durable multi-device persistence
      try {
        await setDoc(doc(db, 'settings', 'custom_prices'), { data: sanitized }, { merge: true });
        await setDoc(doc(db, 'settings', 'dynamic_pricing'), { data: updatedDynamic }, { merge: true });
      } catch (fsErr) {
        console.warn('Firestore direct write warning:', fsErr);
      }

      // 4. Dispatch events for real-time reactivity
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('tumblespin_custom_prices_updated', { detail: sanitized }));

      setSuccessMsg('✨ All prices saved permanently and published live across all devices!');
      setTimeout(() => setSuccessMsg(''), 4500);
    } catch (err: any) {
      console.error('Error saving prices:', err);
      setErrorMsg('Failed to publish prices. Please try again.');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset all to defaults
  const handleResetAllToDefaults = async () => {
    if (window.confirm('⚠️ Are you sure you want to reset ALL services and garment prices back to factory defaults?')) {
      const emptyPrices = { services: {}, estimator: {}, booking: {} };
      localStorage.setItem('tumblespin_custom_prices', JSON.stringify(emptyPrices));
      setCustomPrices(emptyPrices);
      setDraftPrices(emptyPrices);

      try {
        await setDoc(doc(db, 'settings', 'custom_prices'), { data: emptyPrices }, { merge: true });
      } catch (e) {}

      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('tumblespin_custom_prices_updated', { detail: emptyPrices }));

      setSuccessMsg('All custom pricing overrides cleared. Restored factory standard rates.');
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 🌟 MASTER CARD HEADER */}
      <div className="p-6 bg-white dark:bg-brand-dark rounded-2xl border border-slate-200 dark:border-brand-teal/15 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-brand-teal/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-brand-primary/10 dark:bg-brand-accent/10 text-brand-primary dark:text-brand-accent">
                <Tag className="h-5 w-5" />
              </span>
              <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider font-mono">
                💎 Master Pricing Control Center
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
              Centralized pricing engine. Update prices for any service, garment, or category. All modifications instantly update the Booking Modal, Service Estimator, and Public Service Cards across all visitor & staff devices.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Cloud Sync
            </span>
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-black bg-brand-light dark:bg-brand-deep/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-brand-teal/20 font-mono">
              {totalOverridesCount} Active Overrides
            </span>
          </div>
        </div>

        {/* Success / Error Messages */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-4 rounded-xl text-xs font-bold font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-between shadow-xs"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>{successMsg}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setSuccessMsg('')}
                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800"
              >
                ✕
              </button>
            </motion.div>
          )}

          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-4 rounded-xl text-xs font-bold font-mono bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setErrorMsg('')}
                className="text-rose-600 dark:text-rose-400 hover:text-rose-800"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 🔍 SEARCH & CATEGORY FILTER BAR */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search any service, garment, or item (e.g. Wash & Fold, Kids Jeans, Saree, Shoes)..."
                className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-brand-teal/20 bg-slate-50/50 dark:bg-brand-deep/30 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-brand-primary dark:focus:border-brand-accent focus:ring-1 focus:ring-brand-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep shadow-xs hover:opacity-95 active:scale-[0.98] shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Item to Catalog</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSeasonalRules(!showSeasonalRules)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border shrink-0 ${
                showSeasonalRules || localPricingMode !== 'none'
                  ? 'border-brand-primary/40 bg-brand-primary/10 text-brand-primary dark:border-brand-accent/40 dark:bg-brand-accent/10 dark:text-brand-accent'
                  : 'border-slate-200 dark:border-brand-teal/20 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-brand-deep/40'
              }`}
            >
              <Percent className="h-3.5 w-3.5" />
              <span>Seasonal Multipliers</span>
              {showSeasonalRules ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
            {MASTER_PRICING_CATEGORIES.map(cat => {
              const isSelected = selectedCategory === cat.id;
              const catItemCount = cat.id === 'all' 
                ? liveCatalogItems.length 
                : liveCatalogItems.filter(i => i.category === cat.id).length;

              return (
                <button
                  key={`cat-pill-${cat.id}`}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep shadow-xs'
                      : 'bg-slate-100/70 hover:bg-slate-200/70 dark:bg-brand-deep/30 dark:hover:bg-brand-deep/60 text-slate-600 dark:text-slate-300 border border-transparent'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected
                      ? 'bg-white/20 text-white dark:text-brand-deep'
                      : 'bg-slate-200 dark:bg-brand-deep/50 text-slate-500 dark:text-slate-400'
                  }`}>
                    {catItemCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 🌦️ OPTIONAL SEASONAL SURCHARGE / DISCOUNT BANNER */}
        <AnimatePresence>
          {showSeasonalRules && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-4 border-t border-slate-100 dark:border-brand-teal/10 space-y-4 overflow-hidden"
            >
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-brand-deep/20 border border-slate-200/70 dark:border-brand-teal/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-brand-primary dark:text-brand-accent" />
                    <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider font-mono">
                      Site-Wide Seasonal Rate Multiplier
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Applies on top of base or custom item rates
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { mode: 'none', label: 'Standard Rates', desc: 'No dynamic multiplier applied' },
                    { mode: 'surcharge', label: 'Peak Surge (+)', desc: 'Add percentage for festive seasons' },
                    { mode: 'discount', label: 'Off-Season Discount (-)', desc: 'Subtract percentage for quiet periods' }
                  ].map((opt) => {
                    const isSel = localPricingMode === opt.mode;
                    return (
                      <button
                        key={`pricing-rule-mode-${opt.mode}`}
                        type="button"
                        onClick={() => setLocalPricingMode(opt.mode as any)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSel
                            ? 'border-brand-primary dark:border-brand-accent bg-white dark:bg-brand-deep/60 ring-1 ring-brand-primary dark:ring-brand-accent'
                            : 'border-slate-200/60 dark:border-brand-teal/10 bg-white/50 dark:bg-brand-dark hover:bg-white dark:hover:bg-brand-deep/30'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-800 dark:text-white">{opt.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>

                {localPricingMode !== 'none' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/50 dark:border-brand-teal/5">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                        <span>Multiplier Rate</span>
                        <span className="text-brand-primary dark:text-brand-accent font-mono">{localPricingPercentage}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="5"
                          max="40"
                          step="5"
                          value={localPricingPercentage}
                          onChange={(e) => setLocalPricingPercentage(parseInt(e.target.value, 10))}
                          className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-primary dark:accent-brand-accent"
                        />
                        <span className="text-xs font-black font-mono text-slate-800 dark:text-white w-8 text-right">
                          {localPricingPercentage}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                        Public Notice Tag
                      </label>
                      <input
                        type="text"
                        value={localPricingLabel}
                        onChange={(e) => setLocalPricingLabel(e.target.value)}
                        placeholder="e.g. Festive Demand Surcharge, Monsoon Promo..."
                        className="w-full rounded-xl border border-slate-200 dark:border-brand-teal/20 bg-white dark:bg-brand-deep/50 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-hidden"
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* 📋 MASTER CATEGORY SECTIONS */}
      <div className="space-y-6">
        {Object.keys(groupedCatalog).map((catKey) => {
          const categoryMeta = MASTER_PRICING_CATEGORIES.find(c => c.id === catKey);
          const items = groupedCatalog[catKey];

          return (
            <div 
              key={`section-${catKey}`}
              className="p-5 sm:p-6 bg-white dark:bg-brand-dark rounded-2xl border border-slate-200 dark:border-brand-teal/15 shadow-xs space-y-4"
            >
              {/* Category Subheader */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-brand-teal/10">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{categoryMeta?.icon || '🏷️'}</span>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider font-mono">
                      {categoryMeta?.name || catKey}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {categoryMeta?.description || `${items.length} items`}
                    </p>
                  </div>
                </div>

                <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-full bg-slate-100 dark:bg-brand-deep/30 text-slate-600 dark:text-slate-300">
                  {items.length} {items.length === 1 ? 'Item' : 'Items'}
                </span>
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {items.map((item) => {
                  const currentCustomVal = getItemCurrentValue(item);
                  const currentSteamVal = getEstimatorSteamValue(item);
                  const isModified = currentCustomVal !== null || currentSteamVal !== null;

                  return (
                    <div
                      key={`pricing-card-${catKey}-${item.id}`}
                      className={`p-4 rounded-xl border transition-all space-y-3 flex flex-col justify-between ${
                        isModified
                          ? 'border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-xs ring-1 ring-emerald-500/20'
                          : 'border-slate-200/80 dark:border-brand-teal/10 bg-slate-50/40 dark:bg-brand-deep/10 hover:border-slate-300 dark:hover:border-brand-teal/20'
                      }`}
                    >
                      {/* Top Info */}
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="text-xs font-extrabold text-slate-800 dark:text-white leading-tight">
                            {item.name}
                          </h5>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isModified && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                Custom Rate
                              </span>
                            )}
                            {item.isCustom && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase font-mono bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                                Custom Item
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingItem({ ...item })}
                              className="p-1 rounded-lg text-slate-400 hover:text-brand-primary dark:hover:text-brand-accent hover:bg-slate-200/50 dark:hover:bg-brand-deep/50 transition-colors"
                              title="Edit item details (Name, Category, Default Price, Unit)"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                              title="Delete item from catalog"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-400 font-mono">
                          <span>Default: <strong className="text-slate-600 dark:text-slate-300">₹{item.defaultPrice}</strong></span>
                          <span>•</span>
                          <span>{item.unit}</span>
                          {item.serviceType && (
                            <>
                              <span>•</span>
                              <span className="text-brand-primary dark:text-brand-accent font-semibold">{item.serviceType}</span>
                            </>
                          )}
                        </div>

                        {item.description && (
                          <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Input Controls */}
                      <div className="pt-2 border-t border-slate-200/50 dark:border-brand-teal/5 space-y-2">
                        {/* Primary / Dry Clean Input */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            <span>
                              {item.estimatorSteamIronDefault !== undefined ? 'Dry Clean / Standard Rate' : 'Custom Price (₹)'}
                            </span>
                            {isModified && (
                              <button
                                type="button"
                                onClick={() => handleResetSingleItem(item)}
                                className="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-0.5 cursor-pointer"
                                title="Reset to standard default"
                              >
                                <RotateCcw className="h-2.5 w-2.5" />
                                <span>Reset</span>
                              </button>
                            )}
                          </div>

                          <div className="relative">
                            <span className="absolute left-3 top-2 text-xs font-mono font-bold text-slate-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder={String(item.defaultPrice)}
                              value={currentCustomVal ?? ''}
                              onChange={(e) => handleItemPriceChange(item, e.target.value)}
                              className={`w-full text-right pr-4 pl-7 py-1.5 text-xs font-black font-mono rounded-xl border focus:outline-hidden transition-all ${
                                isModified
                                  ? 'border-emerald-500/50 bg-white dark:bg-brand-deep/70 text-emerald-600 dark:text-emerald-400 font-extrabold focus:border-emerald-500'
                                  : 'border-slate-200 dark:border-brand-teal/15 bg-white dark:bg-brand-deep/40 text-slate-800 dark:text-white focus:border-brand-primary'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Optional Dual Steam Iron Input for items that support both in estimator */}
                        {item.estimatorSteamIronDefault !== undefined && (
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                              <span>Steam Iron Only Rate (Estimator)</span>
                              <span className="text-[9px] font-mono text-slate-400">
                                Default: ₹{item.estimatorSteamIronDefault}
                              </span>
                            </div>
                            <div className="relative">
                              <span className="absolute left-3 top-2 text-xs font-mono font-bold text-slate-400">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder={String(item.estimatorSteamIronDefault || 0)}
                                value={currentSteamVal ?? ''}
                                onChange={(e) => handleSteamPriceChange(item, e.target.value)}
                                className={`w-full text-right pr-4 pl-7 py-1.5 text-xs font-black font-mono rounded-xl border focus:outline-hidden transition-all ${
                                  currentSteamVal !== null
                                    ? 'border-emerald-500/50 bg-white dark:bg-brand-deep/70 text-emerald-600 dark:text-emerald-400 font-extrabold focus:border-emerald-500'
                                    : 'border-slate-200 dark:border-brand-teal/15 bg-white dark:bg-brand-deep/40 text-slate-800 dark:text-white focus:border-brand-primary'
                                }`}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filteredCatalog.length === 0 && (
          <div className="p-12 text-center bg-white dark:bg-brand-dark rounded-2xl border border-slate-200 dark:border-brand-teal/10 space-y-2">
            <Info className="h-8 w-8 mx-auto text-slate-400" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">No items match your search</h4>
            <p className="text-xs text-slate-400">Try clearing the search box or changing the category tab.</p>
          </div>
        )}
      </div>

      {/* 💾 STICKY BOTTOM ACTION DECK */}
      <div className="sticky bottom-4 z-20 p-4 bg-white/95 dark:bg-brand-dark/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-brand-teal/20 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-light dark:bg-brand-deep/50 text-brand-primary dark:text-brand-accent">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-black text-slate-800 dark:text-white font-mono uppercase">
              {totalOverridesCount === 0 ? 'All Items on Factory Standard Rates' : `${totalOverridesCount} Live Price Overrides Ready`}
            </div>
            <div className="text-[10px] text-slate-400">
              Changes persist in Firestore and sync to all devices immediately.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          {totalOverridesCount > 0 && (
            <button
              type="button"
              onClick={handleResetAllToDefaults}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all border border-rose-200/50 dark:border-rose-500/20"
            >
              Reset All
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setDraftPrices(JSON.parse(JSON.stringify(customPrices)));
              setSuccessMsg('Draft modifications discarded.');
              setTimeout(() => setSuccessMsg(''), 3000);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
          >
            Discard
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveAndPublish}
            className="px-6 py-2.5 rounded-full bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep text-xs font-black uppercase tracking-wider shadow-lg shadow-brand-primary/20 dark:shadow-brand-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Publishing...</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Save & Publish Live Prices</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ➕ ADD NEW ITEM MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-white dark:bg-brand-dark rounded-2xl border border-slate-200 dark:border-brand-teal/20 shadow-2xl overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 dark:border-brand-teal/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-brand-primary/10 dark:bg-brand-accent/10 text-brand-primary dark:text-brand-accent">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider font-mono">
                      Add New Item to Catalog
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Creates a new item and synchronizes it immediately to Firestore.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateItem} className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Item Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Designer Sherwani / Indo-Western"
                    value={newItemData.name}
                    onChange={(e) => setNewItemData({ ...newItemData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-brand-teal/20 bg-slate-50/50 dark:bg-brand-deep/30 text-slate-800 dark:text-white focus:outline-hidden focus:border-brand-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Category *</label>
                    <select
                      value={newItemData.category}
                      onChange={(e) => setNewItemData({ ...newItemData, category: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-brand-teal/20 bg-slate-50/50 dark:bg-brand-deep/30 text-slate-800 dark:text-white focus:outline-hidden focus:border-brand-primary"
                    >
                      {MASTER_PRICING_CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                        <option key={`opt-cat-${cat.id}`} value={cat.id}>
                          {cat.icon} {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Base Price (₹) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      placeholder="e.g. 299"
                      value={newItemData.defaultPrice}
                      onChange={(e) => setNewItemData({ ...newItemData, defaultPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-brand-teal/20 bg-slate-50/50 dark:bg-brand-deep/30 text-slate-800 dark:text-white focus:outline-hidden focus:border-brand-primary font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Unit / Pricing Metric</label>
                    <input
                      type="text"
                      placeholder="per pc, per pair, per kg"
                      value={newItemData.unit}
                      onChange={(e) => setNewItemData({ ...newItemData, unit: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-brand-teal/20 bg-slate-50/50 dark:bg-brand-deep/30 text-slate-800 dark:text-white focus:outline-hidden focus:border-brand-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Service Type</label>
                    <input
                      type="text"
                      placeholder="e.g. Premium Dry Clean"
                      value={newItemData.serviceType}
                      onChange={(e) => setNewItemData({ ...newItemData, serviceType: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-brand-teal/20 bg-slate-50/50 dark:bg-brand-deep/30 text-slate-800 dark:text-white focus:outline-hidden focus:border-brand-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Description (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Care specifics or fabric details..."
                    value={newItemData.description}
                    onChange={(e) => setNewItemData({ ...newItemData, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-brand-teal/20 bg-slate-50/50 dark:bg-brand-deep/30 text-slate-800 dark:text-white focus:outline-hidden focus:border-brand-primary"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-brand-teal/10">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingItem}
                    className="px-5 py-2 rounded-xl bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-xs hover:opacity-95"
                  >
                    {isSubmittingItem ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    <span>Save to Catalog</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ✏️ EDIT ITEM DETAILS MODAL */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-white dark:bg-brand-dark rounded-2xl border border-slate-200 dark:border-brand-teal/20 shadow-2xl overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 dark:border-brand-teal/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-brand-primary/10 dark:bg-brand-accent/10 text-brand-primary dark:text-brand-accent">
                    <Edit2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider font-mono">
                      Edit Item Details
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      ID: {editingItem.id}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateItemDetails} className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Item Name *</label>
                  <input
                    type="text"
                    required
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-brand-teal/20 bg-slate-50/50 dark:bg-brand-deep/30 text-slate-800 dark:text-white focus:outline-hidden focus:border-brand-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Category *</label>
                    <select
                      value={editingItem.category}
                      onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-brand-teal/20 bg-slate-50/50 dark:bg-brand-deep/30 text-slate-800 dark:text-white focus:outline-hidden focus:border-brand-primary"
                    >
                      {MASTER_PRICING_CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                        <option key={`edit-cat-${cat.id}`} value={cat.id}>
                          {cat.icon} {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Default Base Price (₹) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={editingItem.defaultPrice}
                      onChange={(e) => setEditingItem({ ...editingItem, defaultPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-brand-teal/20 bg-slate-50/50 dark:bg-brand-deep/30 text-slate-800 dark:text-white focus:outline-hidden focus:border-brand-primary font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Unit</label>
                    <input
                      type="text"
                      value={editingItem.unit}
                      onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-brand-teal/20 bg-slate-50/50 dark:bg-brand-deep/30 text-slate-800 dark:text-white focus:outline-hidden focus:border-brand-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Service Type</label>
                    <input
                      type="text"
                      value={editingItem.serviceType || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, serviceType: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-brand-teal/20 bg-slate-50/50 dark:bg-brand-deep/30 text-slate-800 dark:text-white focus:outline-hidden focus:border-brand-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Description</label>
                  <textarea
                    rows={2}
                    value={editingItem.description || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-brand-teal/20 bg-slate-50/50 dark:bg-brand-deep/30 text-slate-800 dark:text-white focus:outline-hidden focus:border-brand-primary"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-brand-teal/10">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingItem}
                    className="px-5 py-2 rounded-xl bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-xs hover:opacity-95"
                  >
                    {isSubmittingItem ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    <span>Update Item</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
