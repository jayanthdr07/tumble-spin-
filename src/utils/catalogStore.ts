import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { 
  MASTER_PRICING_CATALOG, 
  MASTER_PRICING_CATEGORIES, 
  MasterPricingItem, 
  MasterPricingCategory 
} from '../data/masterPricingCatalog';

const CATALOG_STORAGE_KEY = 'tumblespin_custom_catalog_items_v3';
const CATALOG_FIRESTORE_DOC = 'master_catalog';

// Memory cache for synchronous access
let cachedCatalogItems: MasterPricingItem[] | null = null;

// Initialize memory cache from localStorage or base catalog
const initMemoryCache = (): MasterPricingItem[] => {
  if (cachedCatalogItems) return cachedCatalogItems;

  try {
    const saved = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (saved) {
      const parsed: MasterPricingItem[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge with base catalog to guarantee all core items exist while preserving custom/edited ones
        const customMap = new Map<string, MasterPricingItem>();
        parsed.forEach(item => customMap.set(item.id, item));

        const merged: MasterPricingItem[] = [];
        // Add base items (or their edited versions)
        MASTER_PRICING_CATALOG.forEach(baseItem => {
          if (customMap.has(baseItem.id)) {
            merged.push(customMap.get(baseItem.id)!);
            customMap.delete(baseItem.id);
          } else {
            merged.push(baseItem);
          }
        });
        // Add all brand-new custom items
        customMap.forEach(customItem => {
          merged.push(customItem);
        });

        cachedCatalogItems = merged;
        return merged;
      }
    }
  } catch (err) {
    console.warn('[CatalogStore] Error reading local storage cache:', err);
  }

  cachedCatalogItems = [...MASTER_PRICING_CATALOG];
  return cachedCatalogItems;
};

export const getStoredCatalogItems = (): MasterPricingItem[] => {
  return initMemoryCache();
};

export const getCategoryLabel = (categoryId: string): string => {
  const cat = MASTER_PRICING_CATEGORIES.find(c => c.id === categoryId);
  return cat ? cat.name : categoryId.charAt(0).toUpperCase() + categoryId.slice(1);
};

// Persist catalog both locally and in Firestore
export const saveCatalogItems = async (items: MasterPricingItem[], updatedBy = 'admin'): Promise<boolean> => {
  try {
    cachedCatalogItems = items;
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('tumblespin_catalog_updated', { detail: items }));

    // Persist to Firestore settings collection
    await setDoc(doc(db, 'settings', CATALOG_FIRESTORE_DOC), {
      items,
      lastUpdated: new Date().toISOString(),
      updatedBy,
      totalCount: items.length
    }, { merge: true });

    return true;
  } catch (err) {
    console.error('[CatalogStore] Error saving catalog to database:', err);
    return false;
  }
};

// Add a brand new item to a section
export const addCatalogItem = async (
  itemData: Omit<MasterPricingItem, 'id'> & { id?: string },
  updatedBy = 'admin'
): Promise<MasterPricingItem> => {
  const currentItems = [...getStoredCatalogItems()];
  const id = itemData.id || `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  const newItem: MasterPricingItem = {
    ...itemData,
    id,
    isCustom: true,
    categoryLabel: itemData.categoryLabel || getCategoryLabel(itemData.category),
    createdAt: new Date().toISOString()
  };

  const updatedList = [newItem, ...currentItems];
  await saveCatalogItems(updatedList, updatedBy);
  return newItem;
};

// Edit an existing item
export const updateCatalogItem = async (
  itemId: string, 
  updatedFields: Partial<MasterPricingItem>,
  updatedBy = 'admin'
): Promise<boolean> => {
  const currentItems = [...getStoredCatalogItems()];
  const index = currentItems.findIndex(item => item.id === itemId);

  if (index === -1) {
    // If not found, add it as a modified item
    const baseMatch = MASTER_PRICING_CATALOG.find(b => b.id === itemId);
    if (baseMatch) {
      const merged: MasterPricingItem = {
        ...baseMatch,
        ...updatedFields,
        updatedAt: new Date().toISOString()
      };
      currentItems.push(merged);
      await saveCatalogItems(currentItems, updatedBy);
      return true;
    }
    return false;
  }

  currentItems[index] = {
    ...currentItems[index],
    ...updatedFields,
    updatedAt: new Date().toISOString()
  };

  await saveCatalogItems(currentItems, updatedBy);
  return true;
};

// Delete an item
export const deleteCatalogItem = async (
  itemId: string,
  updatedBy = 'admin'
): Promise<boolean> => {
  const currentItems = getStoredCatalogItems().filter(item => item.id !== itemId);
  await saveCatalogItems(currentItems, updatedBy);
  return true;
};

// Hook for React components to use the live catalog
export const useMasterCatalog = () => {
  const [items, setItems] = useState<MasterPricingItem[]>(() => getStoredCatalogItems());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // 1. Initial local load
    setItems(getStoredCatalogItems());

    // 2. Real-time Firestore snapshot listener
    const unsub = onSnapshot(doc(db, 'settings', CATALOG_FIRESTORE_DOC), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data?.items) && data.items.length > 0) {
          cachedCatalogItems = data.items;
          localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(data.items));
          setItems(data.items);
        }
      }
      setIsLoading(false);
    }, (err) => {
      console.warn('[CatalogStore Hook] Firestore snapshot notice:', err);
      setIsLoading(false);
    });

    // 3. Local custom event listener for immediate cross-tab / cross-component sync
    const handleLocalUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setItems(e.detail);
      } else {
        setItems(getStoredCatalogItems());
      }
    };

    window.addEventListener('tumblespin_catalog_updated', handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);

    return () => {
      unsub();
      window.removeEventListener('tumblespin_catalog_updated', handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
    };
  }, []);

  return {
    items,
    categories: MASTER_PRICING_CATEGORIES,
    isLoading,
    addItem: addCatalogItem,
    updateItem: updateCatalogItem,
    deleteItem: deleteCatalogItem
  };
};
