import React from 'react';
import { 
  Shirt, Pocket, Gem, Crown, Scissors, Wind, Snowflake, 
  Layers, Bed, Footprints, Briefcase, ShoppingBag
} from 'lucide-react';

export function getItemIcon(identifier: string, className = "h-4 w-4"): React.ReactNode {
  const norm = identifier.toLowerCase().trim();

  // 1. Footwear
  if (
    norm.includes('shoe') || 
    norm.includes('boot') || 
    norm.includes('sneaker') || 
    norm.includes('footwear') || 
    norm.includes('footprint')
  ) {
    return <Footprints className={className} />;
  }

  // 2. Bags & Leather Goods
  if (
    norm.includes('bag') || 
    norm.includes('backpack') || 
    norm.includes('wallet') || 
    norm.includes('briefcase')
  ) {
    return <Briefcase className={className} />;
  }

  // 3. Bedding & Blankets
  if (
    norm.includes('blanket') || 
    norm.includes('quilt') || 
    norm.includes('rajai') || 
    norm.includes('bedsheet') || 
    norm.includes('sheet') || 
    norm.includes('duvet') ||
    norm.includes('bed')
  ) {
    return <Bed className={className} />;
  }

  // 4. Heavy Winter Wear & Woolens
  if (
    norm.includes('sweater') || 
    norm.includes('cardigan') || 
    norm.includes('jacket') || 
    norm.includes('coat') || 
    norm.includes('blazer') ||
    norm.includes('wool') ||
    norm.includes('winter')
  ) {
    return <Snowflake className={className} />;
  }

  // 5. Traditional Premium Wear & Bridal (Crown)
  if (
    norm.includes('saree') || 
    norm.includes('lehenga') || 
    norm.includes('bridal') || 
    norm.includes('gown') || 
    norm.includes('achkan') ||
    norm.includes('dress')
  ) {
    return <Crown className={className} />;
  }

  // 6. Curtains, Shawls, Carpets, Blinds, Folds (Layers)
  if (
    norm.includes('curtain') || 
    norm.includes('carpet') || 
    norm.includes('blind') || 
    norm.includes('shawl') || 
    norm.includes('pashmina') ||
    norm.includes('layers')
  ) {
    return <Layers className={className} />;
  }

  // 7. General Laundry & Wash-Fold
  if (
    norm.includes('laundry') || 
    norm.includes('wash') || 
    norm.includes('fold') || 
    norm.includes('iron')
  ) {
    return <ShoppingBag className={className} />;
  }

  // 8. Trousers, Jeans, Pyjamas, Slips (Pocket)
  if (
    norm.includes('trouser') || 
    norm.includes('jeans') || 
    norm.includes('pyjama') || 
    norm.includes('salwar') || 
    norm.includes('plazo') ||
    norm.includes('skirt') ||
    norm.includes('pocket')
  ) {
    return <Pocket className={className} />;
  }

  // 9. Premium Wear (Gem)
  if (
    norm.includes('suit') || 
    norm.includes('tuxedo') || 
    norm.includes('gem')
  ) {
    return <Gem className={className} />;
  }

  // 10. Women's Wear or Tailored Wear (Scissors)
  if (
    norm.includes('women') || 
    norm.includes('kurta') || 
    norm.includes('blouse') || 
    norm.includes('top') ||
    norm.includes('scissors')
  ) {
    return <Scissors className={className} />;
  }

  // 11. Light Accessories / Scarves (Wind)
  if (
    norm.includes('dupatta') || 
    norm.includes('scarf') || 
    norm.includes('wind')
  ) {
    return <Wind className={className} />;
  }

  // 12. Default Men's / Shirts / General Shirts
  if (
    norm.includes('shirt') || 
    norm.includes('polo') ||
    norm.includes('men')
  ) {
    return <Shirt className={className} />;
  }

  // Fallback
  return <Shirt className={className} />;
}
