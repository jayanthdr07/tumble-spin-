import { useState, useEffect } from 'react';

export interface BusinessInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
  razorpayUrl?: string;
  upiId?: string;
}

const DEFAULT_INFO: BusinessInfo = {
  name: "Tumble Spin",
  email: "tumblespin26@gmail.com",
  phone: "9606032491",
  address: "Tumble Spin, #6, 80 feet road, Kengeri Ring Rd, Mariyappana Palya, Bengaluru, Karnataka 560056, India",
  razorpayUrl: "https://razorpay.me/@tumblespin",
  upiId: "prakashcsat@oksbi"
};

export function getBusinessInfo(): BusinessInfo {
  try {
    const saved = localStorage.getItem('tumblespin_business_info');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Auto-correct from old default Gurgaon address to Bengaluru address
      if (parsed.address && (parsed.address.includes('Gurgaon') || parsed.address.includes('DLF Phase') || parsed.address.includes('Galleria Arcade'))) {
        localStorage.removeItem('tumblespin_business_info');
        return DEFAULT_INFO;
      }
      // Auto-correct old default phone number
      if (parsed.phone === '7696534935' || !parsed.phone) {
        parsed.phone = '9606032491';
        localStorage.setItem('tumblespin_business_info', JSON.stringify(parsed));
      }
      return { ...DEFAULT_INFO, ...parsed };
    }
  } catch (err) {}
  return DEFAULT_INFO;
}

export function setBusinessInfo(info: BusinessInfo) {
  localStorage.setItem('tumblespin_business_info', JSON.stringify(info));
  window.dispatchEvent(new Event('storage'));
}

export function useBusinessInfo() {
  const [info, setInfo] = useState<BusinessInfo>(getBusinessInfo());

  useEffect(() => {
    const handleStorage = () => {
      setInfo(getBusinessInfo());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return info;
}
