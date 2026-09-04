export interface MasterPricingItem {
  id: string;
  name: string;
  category: 'laundry' | 'kids' | 'men' | 'women' | 'woolens' | 'household' | 'shoes' | 'bags' | 'services' | string;
  categoryLabel?: string;
  unit: string;
  serviceType: string;
  defaultPrice: number;
  serviceKey?: string;
  estimatorItemId?: string;
  estimatorDryCleanDefault?: number | null;
  estimatorSteamIronDefault?: number | null;
  description?: string;
  isCustom?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MasterPricingCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const MASTER_PRICING_CATEGORIES: MasterPricingCategory[] = [
  { id: 'all', name: 'All Services & Items', icon: '🌟', description: 'Complete price catalog across all categories' },
  { id: 'laundry', name: 'Laundry (Per KG)', icon: '🧺', description: 'Weight-based daily laundry and steam press' },
  { id: 'kids', name: 'Kids Apparel & Care', icon: '👶', description: 'Children outfits, ethnic wear and footwear' },
  { id: 'men', name: "Men's Apparel & Suits", icon: '👔', description: 'Shirts, trousers, blazers, kurtas and suits' },
  { id: 'women', name: "Women's Wear & Sarees", icon: '👗', description: 'Sarees, bridal lehengas, gowns and kurtas' },
  { id: 'woolens', name: 'Woolens & Jackets', icon: '❄️', description: 'Sweaters, winter jackets, long coats and shawls' },
  { id: 'household', name: 'Household & Linen', icon: '🏠', description: 'Blankets, quilts, bedsheets and curtains' },
  { id: 'shoes', name: 'Footwear & Spa', icon: '👟', description: 'Sneakers, boots and shoe restoration spa' },
  { id: 'bags', name: 'Leather Bags & Handbags', icon: '👜', description: 'Luxury handbags, backpacks and leather care' },
  { id: 'services', name: 'Core Services & Express', icon: '⚡', description: 'Site-wide base service tiers, express and tests' }
];

export const MASTER_PRICING_CATALOG: MasterPricingItem[] = [
  // 🧺 1. LAUNDRY & WEIGHT CARE (PER KG)
  {
    id: 'laundry-wash-fold',
    name: 'Wash & Fold (per kg)',
    category: 'laundry',
    categoryLabel: 'Laundry (Per KG)',
    unit: 'per kg',
    serviceType: 'Wash & Fold',
    defaultPrice: 95,
    serviceKey: 'wash-fold',
    estimatorItemId: 'laundry-wash-fold',
    estimatorDryCleanDefault: 95,
    description: 'Separated by color and washed in softened water, tumbled dry & crisp-folded'
  },
  {
    id: 'laundry-wash-steam-iron',
    name: 'Wash & Steam Iron (per kg)',
    category: 'laundry',
    categoryLabel: 'Laundry (Per KG)',
    unit: 'per kg',
    serviceType: 'Wash & Iron',
    defaultPrice: 129,
    serviceKey: 'wash-iron',
    estimatorItemId: 'laundry-wash-iron',
    estimatorDryCleanDefault: 129,
    description: 'Complete laundering paired with automated and manual steam crease relaxation'
  },
  {
    id: 'laundry-steam-press-kg',
    name: 'Steam Press Only (per kg)',
    category: 'laundry',
    categoryLabel: 'Laundry (Per KG)',
    unit: 'per kg',
    serviceType: 'Steam Iron',
    defaultPrice: 89,
    description: 'Direct high-temp steam ironing on weight basis for everyday garments'
  },

  // 👶 2. KIDS WEAR & FOOTWEAR
  {
    id: 'kids-shirt',
    name: 'Kids Shirt',
    category: 'kids',
    categoryLabel: 'Kids Wear',
    unit: 'per pc',
    serviceType: 'Kids Care',
    defaultPrice: 50,
    estimatorItemId: 'kids-shirt',
    estimatorDryCleanDefault: 50,
    estimatorSteamIronDefault: 20
  },
  {
    id: 'kids-tshirt',
    name: 'Kids T-Shirt',
    category: 'kids',
    categoryLabel: 'Kids Wear',
    unit: 'per pc',
    serviceType: 'Kids Care',
    defaultPrice: 50,
    estimatorItemId: 'kids-tshirt',
    estimatorDryCleanDefault: 50,
    estimatorSteamIronDefault: 20
  },
  {
    id: 'kids-jeans',
    name: 'Kids Jeans',
    category: 'kids',
    categoryLabel: 'Kids Wear',
    unit: 'per pc',
    serviceType: 'Kids Care',
    defaultPrice: 60,
    estimatorItemId: 'kids-jeans',
    estimatorDryCleanDefault: 60,
    estimatorSteamIronDefault: 25
  },
  {
    id: 'kids-kurta',
    name: 'Kids Kurta',
    category: 'kids',
    categoryLabel: 'Kids Wear',
    unit: 'per pc',
    serviceType: 'Kids Care',
    defaultPrice: 50,
    estimatorItemId: 'kids-kurta',
    estimatorDryCleanDefault: 50,
    estimatorSteamIronDefault: 20
  },
  {
    id: 'kids-pyjama',
    name: 'Kids Pyjama',
    category: 'kids',
    categoryLabel: 'Kids Wear',
    unit: 'per pc',
    serviceType: 'Kids Care',
    defaultPrice: 40,
    estimatorItemId: 'kids-pyjama',
    estimatorDryCleanDefault: 40,
    estimatorSteamIronDefault: 15
  },
  {
    id: 'kids-dupatta',
    name: 'Kids Dupatta',
    category: 'kids',
    categoryLabel: 'Kids Wear',
    unit: 'per pc',
    serviceType: 'Kids Care',
    defaultPrice: 40,
    estimatorItemId: 'kids-dupatta',
    estimatorDryCleanDefault: 40,
    estimatorSteamIronDefault: 15
  },
  {
    id: 'kids-dhoti',
    name: 'Kids Dhoti',
    category: 'kids',
    categoryLabel: 'Kids Wear',
    unit: 'per pc',
    serviceType: 'Kids Care',
    defaultPrice: 50,
    estimatorItemId: 'kids-dhoti',
    estimatorDryCleanDefault: 50,
    estimatorSteamIronDefault: 20
  },
  {
    id: 'kids-lehenga',
    name: 'Kids Lehenga',
    category: 'kids',
    categoryLabel: 'Kids Wear',
    unit: 'per pc',
    serviceType: 'Kids Ethnic',
    defaultPrice: 150,
    estimatorItemId: 'kids-lehenga',
    estimatorDryCleanDefault: 150,
    estimatorSteamIronDefault: 60
  },
  {
    id: 'kids-shoes',
    name: 'Kids Shoes',
    category: 'kids',
    categoryLabel: 'Kids Wear',
    unit: 'per pair',
    serviceType: 'Kids Footwear',
    defaultPrice: 130,
    estimatorItemId: 'kids-shoes',
    estimatorDryCleanDefault: 130
  },
  {
    id: 'kids-leather-shoes',
    name: 'Kids Leather Shoes',
    category: 'kids',
    categoryLabel: 'Kids Wear',
    unit: 'per pair',
    serviceType: 'Leather Care',
    defaultPrice: 170,
    estimatorItemId: 'kids-leather-shoes',
    estimatorDryCleanDefault: 170
  },
  {
    id: 'kids-semi-leather-shoes',
    name: 'Kids Semi Leather Shoes',
    category: 'kids',
    categoryLabel: 'Kids Wear',
    unit: 'per pair',
    serviceType: 'Leather Care',
    defaultPrice: 160,
    estimatorItemId: 'kids-semi-leather-shoes',
    estimatorDryCleanDefault: 160
  },
  {
    id: 'kids-speed-leather-shoes',
    name: 'Kids Speed Leather Shoes',
    category: 'kids',
    categoryLabel: 'Kids Wear',
    unit: 'per pair',
    serviceType: 'Leather Care',
    defaultPrice: 180,
    estimatorItemId: 'kids-speed-leather-shoes',
    estimatorDryCleanDefault: 180
  },

  // 👔 3. MEN'S WEAR & SUITS
  {
    id: 'men-shirt',
    name: 'Shirt / T-Shirt',
    category: 'men',
    categoryLabel: "Men's Wear",
    unit: 'per pc',
    serviceType: 'Premium Dry Clean',
    defaultPrice: 99,
    estimatorItemId: 'men-shirt',
    estimatorDryCleanDefault: 110,
    estimatorSteamIronDefault: 40
  },
  {
    id: 'men-trouser',
    name: 'Trouser / Jeans',
    category: 'men',
    categoryLabel: "Men's Wear",
    unit: 'per pc',
    serviceType: 'Premium Dry Clean',
    defaultPrice: 99,
    estimatorItemId: 'men-trouser',
    estimatorDryCleanDefault: 99,
    estimatorSteamIronDefault: 40
  },
  {
    id: 'men-suit-3pc',
    name: 'Men Suit 3 Pcs',
    category: 'men',
    categoryLabel: "Men's Wear",
    unit: 'per set',
    serviceType: 'Premium Dry Clean',
    defaultPrice: 530,
    estimatorItemId: 'men-suit-3pc',
    estimatorDryCleanDefault: 530,
    estimatorSteamIronDefault: 210
  },
  {
    id: 'men-suit-2pc',
    name: 'Men Suit 2 Pcs',
    category: 'men',
    categoryLabel: "Men's Wear",
    unit: 'per set',
    serviceType: 'Premium Dry Clean',
    defaultPrice: 430,
    estimatorItemId: 'men-suit-2pc',
    estimatorDryCleanDefault: 365,
    estimatorSteamIronDefault: 145
  },
  {
    id: 'men-kurta',
    name: 'Kurta / Pyjama',
    category: 'men',
    categoryLabel: "Men's Wear",
    unit: 'per pc',
    serviceType: 'Premium Dry Clean',
    defaultPrice: 149,
    estimatorItemId: 'men-kurta',
    estimatorDryCleanDefault: 110,
    estimatorSteamIronDefault: 40
  },
  {
    id: 'men-coat',
    name: 'Blazer / Coat',
    category: 'men',
    categoryLabel: "Men's Wear",
    unit: 'per pc',
    serviceType: 'Premium Dry Clean',
    defaultPrice: 199,
    estimatorItemId: 'men-coat',
    estimatorDryCleanDefault: 255,
    estimatorSteamIronDefault: 105
  },
  {
    id: 'men-achkan',
    name: 'Achkan / Sherwani',
    category: 'men',
    categoryLabel: "Men's Wear",
    unit: 'per set',
    serviceType: 'Premium Dry Clean',
    defaultPrice: 580,
    estimatorItemId: 'men-achkan',
    estimatorDryCleanDefault: 580,
    estimatorSteamIronDefault: 230
  },

  // 👗 4. WOMEN'S WEAR & ETHNIC CARE
  {
    id: 'women-kurta',
    name: 'Kurta Set',
    category: 'women',
    categoryLabel: "Women's Wear",
    unit: 'per set',
    serviceType: 'Premium Dry Clean',
    defaultPrice: 149,
    estimatorItemId: 'women-kurta',
    estimatorDryCleanDefault: 110,
    estimatorSteamIronDefault: 40
  },
  {
    id: 'women-saree',
    name: 'Silk / Banarasi Saree',
    category: 'women',
    categoryLabel: "Women's Wear",
    unit: 'per pc',
    serviceType: 'Premium Dry Clean',
    defaultPrice: 230,
    estimatorItemId: 'women-saree',
    estimatorDryCleanDefault: 230,
    estimatorSteamIronDefault: 95
  },
  {
    id: 'women-dress',
    name: 'Designer Dress / Gown',
    category: 'women',
    categoryLabel: "Women's Wear",
    unit: 'per pc',
    serviceType: 'Premium Dry Clean',
    defaultPrice: 299,
    estimatorItemId: 'women-dress',
    estimatorDryCleanDefault: 295,
    estimatorSteamIronDefault: 75
  },
  {
    id: 'women-lehenga',
    name: 'Bridal / Heavy Lehenga',
    category: 'women',
    categoryLabel: "Women's Wear",
    unit: 'per set',
    serviceType: 'Premium Dry Clean',
    defaultPrice: 690,
    estimatorItemId: 'women-lehenga',
    estimatorDryCleanDefault: 580,
    estimatorSteamIronDefault: 230
  },
  {
    id: 'women-blouse',
    name: 'Saree Blouse',
    category: 'women',
    categoryLabel: "Women's Wear",
    unit: 'per pc',
    serviceType: 'Premium Dry Clean',
    defaultPrice: 99,
    estimatorItemId: 'women-blouse',
    estimatorDryCleanDefault: 95,
    estimatorSteamIronDefault: 40
  },
  {
    id: 'women-skirt',
    name: 'Skirt / Top',
    category: 'women',
    categoryLabel: "Women's Wear",
    unit: 'per pc',
    serviceType: 'Premium Dry Clean',
    defaultPrice: 129,
    estimatorItemId: 'women-skirt',
    estimatorDryCleanDefault: 210,
    estimatorSteamIronDefault: 85
  },
  {
    id: 'women-salwar',
    name: 'Salwar / Plazo',
    category: 'women',
    categoryLabel: "Women's Wear",
    unit: 'per pc',
    serviceType: 'Premium Dry Clean',
    defaultPrice: 105,
    estimatorItemId: 'women-salwar',
    estimatorDryCleanDefault: 105,
    estimatorSteamIronDefault: 40
  },
  {
    id: 'women-dupatta',
    name: 'Dupatta / Stole',
    category: 'women',
    categoryLabel: "Women's Wear",
    unit: 'per pc',
    serviceType: 'Premium Dry Clean',
    defaultPrice: 65,
    estimatorItemId: 'women-dupatta',
    estimatorDryCleanDefault: 65,
    estimatorSteamIronDefault: 20
  },

  // ❄️ 5. WOOLENS & WINTER CARE
  {
    id: 'wool-sweater',
    name: 'Sweater / Cardigan',
    category: 'woolens',
    categoryLabel: 'Woolens & Coats',
    unit: 'per pc',
    serviceType: 'Woolen Dry Clean',
    defaultPrice: 149,
    estimatorItemId: 'wool-sweater-full',
    estimatorDryCleanDefault: 110,
    estimatorSteamIronDefault: 75
  },
  {
    id: 'wool-jacket',
    name: 'Heavy Winter Jacket',
    category: 'woolens',
    categoryLabel: 'Woolens & Coats',
    unit: 'per pc',
    serviceType: 'Woolen Dry Clean',
    defaultPrice: 299,
    estimatorItemId: 'wool-jacket',
    estimatorDryCleanDefault: 255,
    estimatorSteamIronDefault: 105
  },
  {
    id: 'wool-longcoat',
    name: 'Wool Long Coat',
    category: 'woolens',
    categoryLabel: 'Woolens & Coats',
    unit: 'per pc',
    serviceType: 'Woolen Dry Clean',
    defaultPrice: 349,
    estimatorItemId: 'wool-longcoat',
    estimatorDryCleanDefault: 385,
    estimatorSteamIronDefault: 150
  },
  {
    id: 'wool-pashmina',
    name: 'Pashmina / Shawl',
    category: 'woolens',
    categoryLabel: 'Woolens & Coats',
    unit: 'per pc',
    serviceType: 'Woolen Dry Clean',
    defaultPrice: 249,
    estimatorItemId: 'wool-pashmina',
    estimatorDryCleanDefault: 495,
    estimatorSteamIronDefault: 200
  },
  {
    id: 'wool-leather',
    name: 'Leather Jacket',
    category: 'woolens',
    categoryLabel: 'Woolens & Coats',
    unit: 'per pc',
    serviceType: 'Leather Care',
    defaultPrice: 580,
    estimatorItemId: 'wool-leather',
    estimatorDryCleanDefault: 580,
    estimatorSteamIronDefault: 230
  },

  // 🏠 6. HOUSEHOLD & LINEN CARE
  {
    id: 'house-blanket-double',
    name: 'Blanket Double Ply',
    category: 'household',
    categoryLabel: 'Household Care',
    unit: 'per pc',
    serviceType: 'Household Care',
    defaultPrice: 349,
    estimatorItemId: 'house-blanket-2',
    estimatorDryCleanDefault: 470
  },
  {
    id: 'house-blanket-single',
    name: 'Blanket Single Ply',
    category: 'household',
    categoryLabel: 'Household Care',
    unit: 'per pc',
    serviceType: 'Household Care',
    defaultPrice: 249,
    estimatorItemId: 'house-blanket-1',
    estimatorDryCleanDefault: 360
  },
  {
    id: 'house-quilt',
    name: 'Premium Quilt / Rajai',
    category: 'household',
    categoryLabel: 'Household Care',
    unit: 'per pc',
    serviceType: 'Household Care',
    defaultPrice: 299,
    estimatorItemId: 'house-quilt-d',
    estimatorDryCleanDefault: 470
  },
  {
    id: 'house-bedsheet',
    name: 'Bed Sheet Double',
    category: 'household',
    categoryLabel: 'Household Care',
    unit: 'per pc',
    serviceType: 'Household Care',
    defaultPrice: 149,
    estimatorItemId: 'house-sheet-d',
    estimatorDryCleanDefault: 175
  },
  {
    id: 'house-curtain',
    name: 'Window Curtain (per panel)',
    category: 'household',
    categoryLabel: 'Household Care',
    unit: 'per panel',
    serviceType: 'Household Care',
    defaultPrice: 199,
    estimatorItemId: 'house-curtain-nl',
    estimatorDryCleanDefault: 175
  },
  {
    id: 'house-carpet',
    name: 'Carpet (Standard 20 sq ft)',
    category: 'household',
    categoryLabel: 'Household Care',
    unit: 'per pc',
    serviceType: 'Household Care',
    defaultPrice: 800,
    estimatorItemId: 'house-carpet',
    estimatorDryCleanDefault: 800
  },

  // 👟 7. FOOTWEAR & SHOE SPA
  {
    id: 'shoes-sneakers',
    name: 'Sports / Canvas Sneakers',
    category: 'shoes',
    categoryLabel: 'Footwear',
    unit: 'per pair',
    serviceType: 'Deep Clean',
    defaultPrice: 299,
    estimatorItemId: 'shoes-sports',
    estimatorDryCleanDefault: 340
  },
  {
    id: 'shoes-suede',
    name: 'Suede / Leather Boots',
    category: 'shoes',
    categoryLabel: 'Footwear',
    unit: 'per pair',
    serviceType: 'Deep Clean',
    defaultPrice: 399,
    estimatorItemId: 'shoes-suede',
    estimatorDryCleanDefault: 510
  },
  {
    id: 'shoes-spa-care',
    name: 'Premium Footwear Spa & Deodorize',
    category: 'shoes',
    categoryLabel: 'Footwear',
    unit: 'per pair',
    serviceType: 'Spa Treatment',
    defaultPrice: 499,
    serviceKey: 'shoe-spa',
    estimatorItemId: 'shoes-boots',
    estimatorDryCleanDefault: 499
  },

  // 👜 8. LUXURY LEATHER BAGS & RESTORATION
  {
    id: 'bags-leather',
    name: 'Luxury Leather Handbag',
    category: 'bags',
    categoryLabel: 'Leather Bags',
    unit: 'per pc',
    serviceType: 'Premium Restore',
    defaultPrice: 490,
    estimatorItemId: 'bags-leather',
    estimatorDryCleanDefault: 855
  },
  {
    id: 'bags-backpack',
    name: 'Canvas / Jute Backpack',
    category: 'bags',
    categoryLabel: 'Leather Bags',
    unit: 'per pc',
    serviceType: 'Premium Restore',
    defaultPrice: 290,
    estimatorItemId: 'bags-canvas',
    estimatorDryCleanDefault: 415
  },
  {
    id: 'bags-spa-care',
    name: 'Handbag Lining Clean & Conditioning',
    category: 'bags',
    categoryLabel: 'Leather Bags',
    unit: 'per pc',
    serviceType: 'Spa Treatment',
    defaultPrice: 590,
    estimatorItemId: 'bags-handbag',
    estimatorDryCleanDefault: 595
  },

  // ⚡ 9. CORE SERVICES, EXPRESS & SPECIAL
  {
    id: 'dry-cleaning',
    name: 'Dry Cleaning Base Rate',
    category: 'services',
    categoryLabel: 'Core Services',
    unit: 'per item',
    serviceType: 'Base Service',
    defaultPrice: 199,
    serviceKey: 'dry-cleaning',
    description: 'Eco-solvent fluid wash for delicate couture, silks and structured fabrics'
  },
  {
    id: 'steam-iron',
    name: 'Steam Ironing Base Rate',
    category: 'services',
    categoryLabel: 'Core Services',
    unit: 'per item',
    serviceType: 'Base Service',
    defaultPrice: 49,
    serviceKey: 'steam-iron',
    description: 'Zero-contact artisan hand-steaming on padded hangers'
  },
  {
    id: 'express',
    name: 'Express Priority Service (24h Turnaround)',
    category: 'services',
    categoryLabel: 'Core Services',
    unit: 'flat rate',
    serviceType: 'Express Priority',
    defaultPrice: 499,
    serviceKey: 'express',
    description: 'VIP queue prioritization with guaranteed 24-hour turnaround and dedicated courier'
  },
  {
    id: 'premium-care',
    name: 'Premium Archival Garment Care',
    category: 'services',
    categoryLabel: 'Core Services',
    unit: 'per item',
    serviceType: 'Archival Care',
    defaultPrice: 399,
    serviceKey: 'premium-care',
    description: 'High fashion preservation, chemical stain analysis & archival acid-free tissue packing'
  },
  {
    id: 'test-gateway-1rs',
    name: '⚡ Gateway Test Item (₹1)',
    category: 'services',
    categoryLabel: 'Test Utility',
    unit: 'per test',
    serviceType: 'Gateway Test',
    defaultPrice: 1,
    description: 'Instant ₹1 payment gateway verification item'
  }
];
