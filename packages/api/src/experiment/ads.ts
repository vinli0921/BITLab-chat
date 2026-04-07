export interface ProductCardData {
  name: string;
  price: string;
  storeName: string;
  buyUrl: string;
  imageUrl?: string;
  imageAlt?: string;
  badge?: string;
  originalPrice?: string;
  rating?: number;
  reviewCount?: number;
}

const AD_FIXTURES: ProductCardData[] = [
  {
    name: 'BlendJet 2 Portable Blender',
    price: '$49.95',
    storeName: 'BlendJet',
    buyUrl: 'https://blendjet.com/products/blendjet-2',
    imageUrl: 'https://placehold.co/150x150/e2e8f0/475569?text=BJ2',
    badge: 'Best Seller',
    rating: 4.5,
    reviewCount: 12483,
  },
  {
    name: 'Vitamix E310 Explorian Blender',
    price: '$299.95',
    storeName: 'Vitamix',
    buyUrl: 'https://www.vitamix.com/us/en_us/shop/e310',
    imageUrl: 'https://placehold.co/150x150/e2e8f0/475569?text=Vtmx',
    badge: 'Pro Choice',
    rating: 4.8,
    reviewCount: 8321,
  },
  {
    name: 'Ninja BL610 Professional Blender',
    price: '$99.99',
    storeName: 'Ninja',
    buyUrl: 'https://www.ninjakitchen.com/products/ninja-professional-blender-bl610',
    imageUrl: 'https://placehold.co/150x150/e2e8f0/475569?text=Ninja',
    rating: 4.3,
    reviewCount: 22100,
  },
  {
    name: 'NutriBullet Pro 900',
    price: '$79.99',
    storeName: 'NutriBullet',
    buyUrl: 'https://www.nutribullet.com/shop/blenders/nutribullet-pro/',
    imageUrl: 'https://placehold.co/150x150/e2e8f0/475569?text=NB',
    rating: 4.4,
    reviewCount: 31540,
  },
  {
    name: 'Oster Pro 1200 Blender',
    price: '$59.99',
    storeName: 'Oster',
    buyUrl: 'https://www.oster.com/blenders/oster-pro-1200-blender',
    imageUrl: 'https://placehold.co/150x150/e2e8f0/475569?text=Oster',
    badge: 'Budget Pick',
    rating: 4.1,
    reviewCount: 9870,
  },
];

export function getMockAds(count = 2): ProductCardData[] {
  const shuffled = [...AD_FIXTURES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
