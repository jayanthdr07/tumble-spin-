import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, HelpCircle, ShieldCheck, Tag } from 'lucide-react';
import { useBusinessInfo } from '../utils/useBusinessInfo';

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export default function FAQ() {
  const businessInfo = useBusinessInfo();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const categories = [
    { id: 'all', name: 'All' },
    { id: 'general', name: 'General' },
    { id: 'laundry', name: 'Laundry' },
    { id: 'drycleaning', name: 'Dry Cleaning' },
    { id: 'ironing', name: 'Steam Ironing' },
    { id: 'shoes', name: 'Shoes & Bags' },
    { id: 'turnaround', name: 'Turnaround' },
    { id: 'payments', name: 'Payments' },
    { id: 'care', name: 'Garment Care' },
    { id: 'storage', name: 'Storage' },
    { id: 'support', name: 'Support' }
  ];

  const faqs: FAQItem[] = [
    // General
    {
      id: 'faq-1',
      category: 'general',
      question: 'What services do you offer?',
      answer: 'We provide premium laundry, dry cleaning, steam ironing, shoe cleaning, curtain cleaning, blanket and comforter cleaning, and other garment care services.'
    },
    {
      id: 'faq-2',
      category: 'general',
      question: 'What are your business hours?',
      answer: 'Our operating hours are displayed at our store and on our website/Google Business profile. Please contact us for the latest timings.'
    },
    {
      id: 'faq-3',
      category: 'general',
      question: 'Do you offer pickup and delivery?',
      answer: 'Yes. Pickup and delivery are available in selected locations. Contact us to check service availability in your area.'
    },
    // Laundry & Dry Cleaning
    {
      id: 'faq-4',
      category: 'laundry',
      question: 'Are clothes washed separately?',
      answer: 'Garments are sorted based on fabric type, color, and washing requirements to provide the best possible care.'
    },
    {
      id: 'faq-5',
      category: 'laundry',
      question: 'What detergents do you use?',
      answer: 'We use high-quality professional laundry detergents and fabric care products suitable for commercial garment care.'
    },
    {
      id: 'faq-6',
      category: 'laundry',
      question: 'Can you remove all stains?',
      answer: 'While we use professional stain treatment methods, stain removal cannot be guaranteed as results depend on the stain type, fabric, age of the stain, and previous treatments.'
    },
    {
      id: 'faq-7',
      category: 'laundry',
      question: 'Do you check garments before washing?',
      answer: 'Yes. Garments are inspected before processing. Existing damage, missing buttons, loose stitching, or delicate fabrics may be noted when visible.'
    },
    {
      id: 'faq-8',
      category: 'laundry',
      question: 'Do you wash delicate garments?',
      answer: 'Yes. Delicate garments are handled according to the care label and suitable cleaning method whenever possible.'
    },
    {
      id: 'faq-9',
      category: 'laundry',
      question: 'Do you follow garment care labels?',
      answer: 'Yes. We follow manufacturer care instructions unless otherwise requested by the customer.'
    },
    // Dry Cleaning
    {
      id: 'faq-10',
      category: 'drycleaning',
      question: 'What garments should be dry cleaned?',
      answer: 'Items such as suits, blazers, sarees, lehengas, gowns, jackets, silk garments, wool garments, and garments labelled "Dry Clean Only" are generally recommended for dry cleaning.'
    },
    {
      id: 'faq-11',
      category: 'drycleaning',
      question: 'Will dry cleaning damage my clothes?',
      answer: 'Professional dry cleaning is designed to clean garments safely. However, some older garments, weak fabrics, or pre-existing damage may become apparent during cleaning.'
    },
    // Steam Ironing
    {
      id: 'faq-12',
      category: 'ironing',
      question: 'Do you use steam ironing?',
      answer: 'Yes. We use professional steam ironing equipment to provide a crisp and neat finish.'
    },
    {
      id: 'faq-13',
      category: 'ironing',
      question: 'Can you remove wrinkles completely?',
      answer: 'Most wrinkles can be removed. However, permanent creases, fabric damage, or wear may affect the final appearance.'
    },
    // Shoes & Bags
    {
      id: 'faq-14',
      category: 'shoes',
      question: 'Do you clean all types of shoes?',
      answer: 'We clean most sports shoes, sneakers, and selected casual footwear. Service depends on the shoe material and condition.'
    },
    {
      id: 'faq-15',
      category: 'shoes',
      question: 'Can you restore damaged shoes?',
      answer: 'Our service focuses on cleaning and improving appearance. Structural repairs and complete restoration are not part of standard cleaning services.'
    },
    {
      id: 'faq-16',
      category: 'shoes',
      question: 'Do you clean luxury handbags?',
      answer: 'Yes. Selected handbags can be professionally cleaned after inspection. The appropriate treatment depends on the material and condition.'
    },
    // Turnaround Time
    {
      id: 'faq-17',
      category: 'turnaround',
      question: 'How long does cleaning take?',
      answer: 'Turnaround time depends on the service requested and garment type. Our team will provide an estimated completion time when your order is accepted.'
    },
    {
      id: 'faq-18',
      category: 'turnaround',
      question: 'Can I request urgent service?',
      answer: 'Urgent service may be available for selected items, subject to workload and garment requirements.'
    },
    // Payments
    {
      id: 'faq-19',
      category: 'payments',
      question: 'What payment methods do you accept?',
      answer: 'We accept major digital payment methods and cash. Available payment options may vary by location.'
    },
    {
      id: 'faq-20',
      category: 'payments',
      question: 'When do I need to make payment?',
      answer: 'Payment is generally collected when garments are submitted or before delivery, depending on the service.'
    },
    // Garment Care
    {
      id: 'faq-21',
      category: 'care',
      question: 'What if my clothes shrink or colour fades?',
      answer: 'Some fabrics naturally shrink or fade due to age, dye quality, or manufacturer processing. We follow recommended care procedures but cannot guarantee against inherent fabric characteristics.'
    },
    {
      id: 'faq-22',
      category: 'care',
      question: 'Can you clean heavily damaged or old garments?',
      answer: 'We will assess the garment before accepting it. Some items may not be suitable for processing due to their condition.'
    },
    {
      id: 'faq-23',
      category: 'care',
      question: 'Will all odours be removed?',
      answer: 'Most odours can be significantly reduced or removed, but complete removal cannot always be guaranteed.'
    },
    // Collection & Storage
    {
      id: 'faq-24',
      category: 'storage',
      question: 'How will I know my order is ready?',
      answer: 'We will notify you once your order is ready for collection or delivery.'
    },
    {
      id: 'faq-25',
      category: 'storage',
      question: 'How long will you keep my clothes after they are ready?',
      answer: 'We recommend collecting garments promptly after notification. Items left uncollected for an extended period may be subject to our storage policy.'
    },
    // Customer Support
    {
      id: 'faq-26',
      category: 'support',
      question: 'What should I do if I have a concern about my order?',
      answer: 'Please contact us as soon as possible after collecting your garments. We will review the concern and work towards a fair resolution.'
    },
    {
      id: 'faq-27',
      category: 'support',
      question: 'Do you guarantee every cleaning result?',
      answer: 'We are committed to providing high-quality garment care using professional processes and equipment. However, cleaning results may vary depending on the fabric, garment condition, stains, and manufacturer construction.'
    },
    {
      id: 'faq-28',
      category: 'support',
      question: 'Why should I choose Tumble Spin Laundry?',
      answer: 'At Tumble Spin Laundry, we focus on quality cleaning, careful garment handling, professional finishing, and excellent customer service to help keep your garments looking their best.'
    }
  ];

  const filteredFaqs = activeCategory === 'all' 
    ? faqs 
    : faqs.filter(faq => faq.category === activeCategory);

  const toggleFaq = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <section 
      className="py-24 bg-brand-light dark:bg-brand-deep/20 overflow-hidden" 
      id="faq"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-4">
          <span className="text-xs font-bold tracking-widest text-brand-primary uppercase dark:text-brand-accent font-mono block animate-pulse">
            TUMBLE SPIN LAUNDRY FAQ
          </span>
          <h2 className="section-title-clamp font-serif text-slate-900 dark:text-white font-medium">
            Frequently Asked Questions
          </h2>
          <div className="w-12 h-0.5 bg-brand-primary dark:bg-brand-accent mx-auto rounded-full" />
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto text-sm">
            Everything you need to know about our premium laundry, dry cleaning, and specialized fabric care.
          </p>
        </div>

        {/* Category Tabs Switcher */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-10 pb-2 border-b border-slate-100 dark:border-slate-800 max-w-4xl mx-auto overflow-x-auto scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                setOpenId(null); // Close active accordion when changing category
              }}
              className={`px-3 py-1.5 rounded-full text-[10.5px] sm:text-xs font-bold tracking-wide transition-all duration-300 ${
                activeCategory === cat.id
                  ? 'bg-brand-primary text-white shadow-xs dark:bg-brand-accent dark:text-brand-deep'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/60 dark:bg-brand-dark dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800/50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Accordion List */}
        <div className="space-y-3.5 max-w-4xl mx-auto" id="faq-accordion-list">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-3.5"
            >
              {filteredFaqs.map((faq) => {
                const isOpen = openId === faq.id;
                const catName = categories.find(c => c.id === faq.category)?.name || '';
                return (
                  <div
                    key={faq.id}
                    className="rounded-2xl border border-slate-100 bg-white shadow-xs dark:bg-brand-dark dark:border-brand-teal/10 overflow-hidden transition-all duration-300 hover:border-slate-200 dark:hover:border-brand-accent/20"
                  >
                    {/* Header Toggle button */}
                    <button
                      type="button"
                      onClick={() => toggleFaq(faq.id)}
                      className="w-full flex items-center justify-between text-left p-5 text-sm font-semibold text-slate-900 hover:bg-slate-50/50 dark:text-white dark:hover:bg-brand-teal/5 transition-colors gap-4"
                      id={`faq-btn-${faq.id}`}
                      aria-expanded={isOpen}
                    >
                      <span className="flex items-start gap-3">
                        <HelpCircle className="h-5 w-5 text-brand-primary dark:text-brand-accent shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <span className="text-xs font-mono font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1.5">
                            <Tag className="h-3 w-3" />
                            {catName}
                          </span>
                          <p className="text-[13.5px] sm:text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                            {faq.question}
                          </p>
                        </div>
                      </span>
                      <ChevronDown className={`h-4.5 w-4.5 text-slate-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Answer Content Panel */}
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                        >
                          <div className="p-5 pt-0 border-t border-slate-50 dark:border-slate-800/50 text-[12.5px] sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium pl-13">
                            {faq.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Support Note */}
        <div className="mt-12 rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-4.5 flex items-start gap-3.5 max-w-3xl mx-auto">
          <ShieldCheck className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              Fabric SafeGuard & Help Commitment
            </h4>
            <p className="text-[11.5px] text-slate-600 dark:text-slate-300 leading-relaxed mt-1">
              Still have a specific query regarding our processes or specialized care? Our Master Textile Restorers are standing by. Get in touch directly at <a href={`mailto:${businessInfo.email}`} className="font-bold underline hover:text-brand-primary dark:hover:text-brand-accent">{businessInfo.email}</a> or call <a href={`tel:+91${businessInfo.phone}`} className="font-bold underline hover:text-brand-primary dark:hover:text-brand-accent">+91 {businessInfo.phone}</a>.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
