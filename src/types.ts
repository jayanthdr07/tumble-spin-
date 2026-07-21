export interface Service {
  id: string;
  title: string;
  description: string;
  priceInfo: string;
  iconName: string;
  badge?: string;
  details: string[];
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  rating: number;
  content: string;
  avatar: string;
  location: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface PricingItem {
  id: string;
  category: string;
  items: {
    name: string;
    price: string;
    unit: string;
  }[];
}

export interface BookingDetails {
  services: string[];
  pickupDate: string;
  pickupTimeSlot: string;
  deliveryDate: string;
  deliveryTimeSlot: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  specialInstructions?: string;
  garmentCareOption: 'standard' | 'hypoallergenic' | 'organic-scentless';
}
