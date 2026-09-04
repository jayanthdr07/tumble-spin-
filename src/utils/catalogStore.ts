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
const CATALOG_DELETED_KEY = 'tumblespin_deleted_catalog_item_ids_v1';
const CATALOG_FIRESTORE_DOC = 'master_catalog';

// Memory cache for synchronous access
let cachedCatalogItems: MasterPricingItem[] | null = null;
let cachedDeletedIds: Set<string> | null = null;

// Get deleted item IDs from localStorage
export const getDeletedCatalogItemIds = (): string[] => {
  if (cachedDeletedIds) return Array.from(cachedDeletedIds);
  try {
    const saved = localStorage.getItem(CATALOG_DELETED_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        cachedDeletedIds = new Set(parsed);
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[CatalogStore] Error reading deleted item cache:', err);
  }
  cachedDeletedIds = new Set();
  return [];
};

// Save deleted item IDs to localStorage
export const saveDeletedCatalogItemIds = (ids: string[]) => {
  try {
    cachedDeletedIds = new Set(ids);
    localStorage.setItem(CATALOG_DELETED_KEY, JSON.stringify(ids));
  } catch (err) {
    console.warn('[CatalogStore] Error saving deleted item cache:', err);
  }
};

// Initialize memory cache from localStorage or base catalog
const initMemoryCache = (): MasterPricingItem[] => {
  if (cachedCatalogItems) return cachedCatalogItems;

  const deletedIds = new Set(getDeletedCatalogItemIds());

  try {
    const saved = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (saved) {
      const parsed: MasterPricingItem[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Filter out any items that are permanently deleted
        const activeParsed = parsed.filter(item => !deletedIds.has(item.id));
        const customMap = new Map<string, MasterPricingItem>();
        activeParsed.forEach(item => customMap.set(item.id, item));

        const merged: MasterPricingItem[] = [];
        // Add base items (or their edited versions), but NEVER if deleted
        MASTER_PRICING_CATALOG.forEach(baseItem => {
          if (deletedIds.has(baseItem.id)) {
            // Explicitly deleted - DO NOT include
            return;
          }
          if (customMap.has(baseItem.id)) {
            merged.push(customMap.get(baseItem.id)!);
            customMap.delete(baseItem.id);
          } else {
            merged.push(baseItem);
          }
        });
        // Add all brand-new custom items (that are not deleted)
        customMap.forEach(customItem => {
          if (!deletedIds.has(customItem.id)) {
            merged.push(customItem);
          }
        });

        cachedCatalogItems = merged;
        return merged;
      }
    }
  } catch (err) {
    console.warn('[CatalogStore] Error reading local storage cache:', err);
  }

  // Fallback to base catalog without deleted items
  cachedCatalogItems = MASTER_PRICING_CATALOG.filter(item => !deletedIds.has(item.id));
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
export const saveCatalogItems = async (
  items: MasterPricingItem[], 
  updatedBy = 'admin',
  updatedDeletedIds?: string[]
): Promise<boolean> => {
  try {
    const deletedIds = updatedDeletedIds ?? getDeletedCatalogItemIds();
    const deletedSet = new Set(deletedIds);
    const sanitizedItems = items.filter(item => !deletedSet.has(item.id));

    cachedCatalogItems = sanitizedItems;
    saveDeletedCatalogItemIds(deletedIds);
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(sanitizedItems));
    
    window.dispatchEvent(new CustomEvent('tumblespin_catalog_updated', { detail: sanitizedItems }));
    window.dispatchEvent(new CustomEvent('tumblespin_catalog_deleted_updated', { detail: deletedIds }));
    window.dispatchEvent(new Event('storage'));

    // Persist to Firestore settings collection
    await setDoc(doc(db, 'settings', CATALOG_FIRESTORE_DOC), {
      items: sanitizedItems,
      deletedItemIds: deletedIds,
      lastUpdated: new Date().toISOString(),
      updatedBy,
      totalCount: sanitizedItems.length
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
  
  // If this ID was previously deleted, remove from deleted set
  const currentDeleted = getDeletedCatalogItemIds().filter(dId => dId !== id);
  saveDeletedCatalogItemIds(currentDeleted);

  const newItem: MasterPricingItem = {
    ...itemData,
    id,
    isCustom: true,
    categoryLabel: itemData.categoryLabel || getCategoryLabel(itemData.category),
    createdAt: new Date().toISOString()
  };

  const updatedList = [newItem, ...currentItems.filter(i => i.id !== id)];
  await saveCatalogItems(updatedList, updatedBy, currentDeleted);
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

// Delete an item permanently
export const deleteCatalogItem = async (
  itemId: string,
  updatedBy = 'admin'
): Promise<boolean> => {
  const currentDeleted = getDeletedCatalogItemIds();
  const newDeleted = Array.from(new Set([...currentDeleted, itemId]));
  
  const currentItems = getStoredCatalogItems().filter(item => item.id !== itemId);
  
  // Clean up any custom price overrides in custom_prices
  try {
    const savedCustomPrices = localStorage.getItem('tumblespin_custom_prices');
    if (savedCustomPrices) {
      const parsedPrices = JSON.parse(savedCustomPrices);
      let changed = false;
      if (parsedPrices.booking && parsedPrices.booking[itemId] !== undefined) {
        delete parsedPrices.booking[itemId];
        changed = true;
      }
      if (parsedPrices.estimator && parsedPrices.estimator[itemId] !== undefined) {
        delete parsedPrices.estimator[itemId];
        changed = true;
      }
      if (changed) {
        localStorage.setItem('tumblespin_custom_prices', JSON.stringify(parsedPrices));
        window.dispatchEvent(new CustomEvent('tumblespin_custom_prices_updated', { detail: parsedPrices }));
      }
    }
  } catch (e) {}

  await saveCatalogItems(currentItems, updatedBy, newDeleted);
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
        let firestoreDeleted: string[] = [];
        if (Array.isArray(data?.deletedItemIds)) {
          firestoreDeleted = data.deletedItemIds;
          const mergedDeleted = Array.from(new Set([...getDeletedCatalogItemIds(), ...firestoreDeleted]));
          saveDeletedCatalogItemIds(mergedDeleted);
        }

        const activeDeletedSet = new Set([...getDeletedCatalogItemIds(), ...firestoreDeleted]);

        if (Array.isArray(data?.items)) {
          const validItems = data.items.filter((i: MasterPricingItem) => !activeDeletedSet.has(i.id));
          cachedCatalogItems = validItems;
          localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(validItems));
          setItems(validItems);
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
    window.addEventListener('tumblespin_catalog_deleted_updated', handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);

    return () => {
      unsub();
      window.removeEventListener('tumblespin_catalog_updated', handleLocalUpdate);
      window.removeEventListener('tumblespin_catalog_deleted_updated', handleLocalUpdate);
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
