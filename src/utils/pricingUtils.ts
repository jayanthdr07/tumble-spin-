import { useState, useEffect } from 'react';
import { MasterPricingItem } from '../data/masterPricingCatalog';

export interface DynamicPricingConfig {
  mode: 'surcharge' | 'discount' | 'none';
  percentage: number;
  label: string;
}

export interface CustomPricesConfig {
  services?: Record<string, number>;
  estimator?: Record<string, { dryClean?: number; steamIron?: number }>;
  booking?: Record<string, number>;
}

export const DEFAULT_SERVICE_BASE_PRICES: Record<string, number> = {
  'wash-fold': 95,
  'wash-iron': 129,
  'dry-cleaning': 199,
  'steam-iron': 49,
  'premium-care': 399,
  'shoe-spa': 299,
  'express': 499
};

/**
 * Calculates the final price after applying seasonal surge or promotional discount.
 */
export function adjustPriceWithDynamicPricing(
  basePrice: number,
  dynamicPricing?: DynamicPricingConfig | null
): number {
  if (!dynamicPricing || dynamicPricing.mode === 'none' || !dynamicPricing.percentage || dynamicPricing.percentage <= 0) {
    return basePrice;
  }
  if (dynamicPricing.mode === 'surcharge') {
    return Math.round(basePrice + (basePrice * dynamicPricing.percentage) / 100);
  } else if (dynamicPricing.mode === 'discount') {
    return Math.max(1, Math.round(basePrice - (basePrice * dynamicPricing.percentage) / 100));
  }
  return basePrice;
}

/**
 * Adjusts price strings with multiple currency amounts (e.g. "₹110 / ₹150+", "₹230", "+₹499 flat")
 */
export function adjustPriceStringWithDynamic(
  priceStr: string,
  dynamicPricing?: DynamicPricingConfig | null
): string {
  if (!dynamicPricing || dynamicPricing.mode === 'none' || !dynamicPricing.percentage || dynamicPricing.percentage <= 0) {
    return priceStr;
  }
  return priceStr.replace(/(₹)?(\d+)(\+)?/g, (match, rSign, numStr, plusSign) => {
    const val = parseInt(numStr, 10);
    if (isNaN(val)) return match;
    const adjusted = adjustPriceWithDynamicPricing(val, dynamicPricing);
    return `${rSign || '₹'}${adjusted}${plusSign || ''}`;
  });
}

/**
 * Retrieve current dynamic pricing settings from localStorage
 */
export function getStoredDynamicPricing(): DynamicPricingConfig {
  try {
    const saved = localStorage.getItem('tumblespin_dynamic_pricing');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.percentage === 'number') {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[PricingUtils] Failed to parse dynamic pricing:', e);
  }
  return {
    mode: 'none',
    percentage: 15,
    label: 'Festival Season Demand Surcharge'
  };
}

/**
 * Retrieve current custom price overrides from localStorage
 */
export function getStoredCustomPrices(): CustomPricesConfig {
  try {
    const saved = localStorage.getItem('tumblespin_custom_prices');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[PricingUtils] Failed to parse custom prices:', e);
  }
  return { services: {}, estimator: {}, booking: {} };
}

function isValidPriceNumber(val: unknown): boolean {
  if (val === undefined || val === null || (val as unknown) === '') return false;
  const num = Number(val);
  return !isNaN(num) && num > 0;
}

/**
 * Resolves the base price of a core service taking into account custom overrides,
 * booking overrides, estimator overrides, and master catalog modifications.
 */
export function getServiceBasePrice(
  serviceId: string,
  customPrices?: CustomPricesConfig,
  liveCatalogItems?: MasterPricingItem[]
): number {
  // 1. Direct services override
  const serviceOverride = customPrices?.services?.[serviceId];
  if (isValidPriceNumber(serviceOverride)) {
    return Number(serviceOverride);
  }

  // 2. Specific item cross-references
  if (serviceId === 'wash-fold') {
    const bPrice = customPrices?.booking?.['laundry-wash-fold'];
    if (isValidPriceNumber(bPrice)) {
      return Number(bPrice);
    }
    const ePrice = customPrices?.estimator?.['laundry-wash-fold']?.dryClean;
    if (isValidPriceNumber(ePrice)) {
      return Number(ePrice);
    }
    const catMatch = liveCatalogItems?.find(i => i.id === 'laundry-wash-fold');
    if (catMatch?.defaultPrice !== undefined) {
      return catMatch.defaultPrice;
    }
  }

  if (serviceId === 'wash-iron') {
    const bPrice = customPrices?.booking?.['laundry-wash-steam-iron'];
    if (isValidPriceNumber(bPrice)) {
      return Number(bPrice);
    }
    const ePrice = customPrices?.estimator?.['laundry-wash-iron']?.dryClean;
    if (isValidPriceNumber(ePrice)) {
      return Number(ePrice);
    }
    const catMatch = liveCatalogItems?.find(i => i.id === 'laundry-wash-steam-iron' || i.id === 'laundry-wash-iron');
    if (catMatch?.defaultPrice !== undefined) {
      return catMatch.defaultPrice;
    }
  }

  if (serviceId === 'shoe-spa') {
    const bPrice = customPrices?.booking?.['shoes-spa-care'];
    if (isValidPriceNumber(bPrice)) {
      return Number(bPrice);
    }
    const catMatch = liveCatalogItems?.find(i => i.id === 'shoes-spa-care');
    if (catMatch?.defaultPrice !== undefined) {
      return catMatch.defaultPrice;
    }
  }

  if (serviceId === 'express') {
    const sPrice = customPrices?.services?.['express'];
    if (isValidPriceNumber(sPrice)) {
      return Number(sPrice);
    }
    const catMatch = liveCatalogItems?.find(i => i.id === 'service-express-priority');
    if (catMatch?.defaultPrice !== undefined) {
      return catMatch.defaultPrice;
    }
  }

  return DEFAULT_SERVICE_BASE_PRICES[serviceId] ?? 95;
}

/**
 * React hook that provides live-synchronized dynamic pricing and custom prices.
 * Listens to window storage, Firestore push events, and custom update events.
 */
export function usePricingSync(initialDynamic?: DynamicPricingConfig) {
  const [dynamicPricing, setDynamicPricing] = useState<DynamicPricingConfig>(() => 
    initialDynamic || getStoredDynamicPricing()
  );
  const [customPrices, setCustomPrices] = useState<CustomPricesConfig>(() => 
    getStoredCustomPrices()
  );

  // Sync with prop if it changes
  useEffect(() => {
    if (initialDynamic) {
      setDynamicPricing(initialDynamic);
    }
  }, [initialDynamic]);

  useEffect(() => {
    const handleSync = (e?: any) => {
      if (e?.type === 'tumblespin_dynamic_pricing_updated' && e.detail) {
        setDynamicPricing(e.detail);
      } else {
        const storedDynamic = getStoredDynamicPricing();
        setDynamicPricing(storedDynamic);
      }

      if (e?.type === 'tumblespin_custom_prices_updated' && e.detail) {
        setCustomPrices(e.detail);
      } else {
        const storedCustom = getStoredCustomPrices();
        setCustomPrices(storedCustom);
      }
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('tumblespin_dynamic_pricing_updated', handleSync);
    window.addEventListener('tumblespin_custom_prices_updated', handleSync);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('tumblespin_dynamic_pricing_updated', handleSync);
      window.removeEventListener('tumblespin_custom_prices_updated', handleSync);
    };
  }, []);

  return { dynamicPricing, customPrices };
}
