import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Star, Quote, Heart, CheckCircle, ThumbsUp, Plus, Filter, Send, MessageSquare, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

gsap.registerPlugin(ScrollTrigger);

interface Review {
  id: string;
  name: string;
  role: string;
  location: string;
  content: string;
  rating: number;
  category: 'dry-cleaning' | 'wash-fold' | 'wash-iron' | 'saree-couture';
  avatar: string;
  date: string;
  isVerified: boolean;
  likes: number;
  hasLiked?: boolean;
  teamReply?: string;
}

export default function Testimonials() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Default pre-populated reviews
  const initialReviews: Review[] = [
    {
      id: 'test-1',
      name: 'Priya Narang',
      role: 'Fashion Designer, Label Prana',
      location: 'Indiranagar, Bangalore',
      content: 'Tumble Spin is the only service I trust with my silk sarees and designer archives. Their custom wet-solvent processing maintains absolute silk sheen and embroidery strength. Exceptional detail and professional delivery.',
      rating: 5,
      category: 'saree-couture',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&h=256&fit=crop',
      date: '2 days ago',
      isVerified: true,
      likes: 18,
      teamReply: 'Thank you Priya! It is always an honor to preserve and restore Label Pranas beautiful creations.'
    },
    {
      id: 'test-2',
      name: 'Rohan Murthy',
      role: 'Partner, Catalyst Ventures',
      location: 'Koramangala, Bangalore',
      content: 'I have standard weekly pickup. My business shirts return on heavy contoured hangers with collar stays intact, perfectly starched to order. Their automated SMS updates and GPS valet tracking is extremely convenient.',
      rating: 5,
      category: 'wash-iron',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=256&h=256&fit=crop',
      date: '1 week ago',
      isVerified: true,
      likes: 12,
      teamReply: 'We appreciate the feedback, Rohan. Glad our business crisp finishing helps you start your Mondays perfectly!'
    },
    {
      id: 'test-3',
      name: 'Deepika Rao',
      role: 'Art Advisory Director',
      location: 'Sadashivanagar, Bangalore',
      content: 'They successfully treated a red wine stain on a vintage Belgian lace saree that other dry cleaners refused to handle. Their precision light-lab spotting stain analysis is pure science. True artisan care.',
      rating: 5,
      category: 'dry-cleaning',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=256&h=256&fit=crop',
      date: '3 days ago',
      isVerified: true,
      likes: 24,
      teamReply: 'Our stain scientists love a good challenge, Deepika! Thank you for trusting us with your family heirloom.'
    },
    {
      id: 'test-4',
      name: 'Ananya Sharma',
      role: 'VP Product, FinTech Labs',
      location: 'HSR Layout, Bangalore',
      content: 'The Wash & Fold is pristine. They separate everything perfectly and it smells amazing - not chemical, but fresh like morning dew. Having my laundry picked up and returned to my door is a massive timesaver.',
      rating: 5,
      category: 'wash-fold',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=256&h=256&fit=crop',
      date: '2 weeks ago',
      isVerified: true,
      likes: 9,
      teamReply: 'Thank you Ananya! We make sure daily wear gets the same boutique level of attention as our couture line.'
    }
  ];

  // State
  const [reviews, setReviews] = useState<Review[]>(() => {
    const saved = localStorage.getItem('tumblespin_reviews');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return initialReviews;
      }
    }
    return initialReviews;
  });

  const [activeTab, setActiveTab] = useState<'all' | 'dry-cleaning' | 'wash-fold' | 'wash-iron' | 'saree-couture'>('all');
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    location: '',
    content: '',
    rating: 5,
    category: 'dry-cleaning' as Review['category']
  });

  // Save to local storage when reviews change
  useEffect(() => {
    localStorage.setItem('tumblespin_reviews', JSON.stringify(reviews));
  }, [reviews]);

  // GSAP animation
  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!prefersReducedMotion) {
        gsap.from('.testimonial-header-reveal', {
          y: 30,
          opacity: 0,
          duration: 1,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 80%',
            toggleActions: 'play none none none'
          }
        });
      }
    }, containerRef);

    return () => ctx.revert();
  }, []); // Run once on mount for headers

  // Handlers
  const handleLike = (id: string) => {
    setReviews(prev => prev.map(rev => {
      if (rev.id === id) {
        return {
          ...rev,
          likes: rev.hasLiked ? rev.likes - 1 : rev.likes + 1,
          hasLiked: !rev.hasLiked
        };
      }
      return rev;
    }));
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRatingChange = (stars: number) => {
    setFormData(prev => ({ ...prev, rating: stars }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.content || !formData.location) return;

    const newReview: Review = {
      id: 'user-' + Date.now(),
      name: formData.name,
      role: formData.role || 'Verified Patron',
      location: formData.location + ', Bangalore',
      content: formData.content,
      rating: formData.rating,
      category: formData.category,
      avatar: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 900000)}?q=80&w=256&h=256&fit=crop`,
      date: 'Just now',
      isVerified: true,
      likes: 0,
      teamReply: 'Thank you for your feedback! Our team takes great pride in perfecting every garment cycle.'
    };

    setReviews(prev => [newReview, ...prev]);
    setFormData({
      name: '',
      role: '',
      location: '',
      content: '',
      rating: 5,
      category: 'dry-cleaning'
    });
    setShowWriteReview(false);
    setSuccessMsg(true);
    setTimeout(() => setSuccessMsg(false), 5000);
  };

  const uniqueReviews = Array.from(
    new Map<string, Review>(reviews.map(item => [item.id, item])).values()
  );

  const filteredReviews = uniqueReviews.filter(rev => {
    if (activeTab === 'all') return true;
    return rev.category === activeTab;
  });

  // Calculate aggregates
  const totalRatingsCount = uniqueReviews.length || 1;
  const averageRating = (uniqueReviews.reduce((sum, r) => sum + r.rating, 0) / totalRatingsCount).toFixed(1);
  const ratingCounts = [0, 0, 0, 0, 0]; // 1-5 star counts
  uniqueReviews.forEach(r => {
    if (r.rating >= 1 && r.rating <= 5) {
      ratingCounts[r.rating - 1]++;
    }
  });

  return (
    <section 
      ref={containerRef}
      className="py-24 bg-white dark:bg-brand-dark overflow-hidden border-t border-slate-100 dark:border-brand-teal/10"
      id="testimonials"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
          <span className="testimonial-header-reveal text-xs font-bold tracking-widest text-brand-primary uppercase dark:text-brand-accent font-mono block">
            ELITE PATRON REVIEWS
          </span>
          <h2 className="testimonial-header-reveal section-title-clamp font-serif text-slate-900 dark:text-white font-medium">
            Acclaimed by Bangalore's curators and connoisseurs.
          </h2>
          <div className="testimonial-header-reveal w-12 h-0.5 bg-brand-primary dark:bg-brand-accent mx-auto rounded-full" />
          <p className="testimonial-header-reveal text-slate-600 dark:text-slate-300 max-w-md mx-auto text-sm leading-relaxed">
            Discover why premium clothing collectors, designers, and busy business leaders select Tumble Spin for their weekly doorstep laundry valet.
          </p>
        </div>

        {/* Brand Ratings Overview Dashboard */}
        <div className="testimonial-header-reveal grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch mb-16 bg-brand-light/40 border border-brand-primary/5 dark:bg-brand-deep/30 dark:border-brand-accent/5 p-6 sm:p-8 rounded-2xl">
          
          {/* Aggregate Rating Block */}
          <div className="md:col-span-4 flex flex-col justify-center items-center text-center p-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-brand-teal/20">
            <span className="text-6xl font-bold text-slate-900 dark:text-white font-mono leading-none">
              {averageRating}
            </span>
            <div className="flex gap-1.5 my-3.5 text-amber-400">
              {[...Array(5)].map((_, i) => {
                const isFull = i < Math.floor(Number(averageRating));
                return (
                  <Star 
                    key={i} 
                    className={`h-5 w-5 ${isFull ? 'fill-amber-400 stroke-none' : 'text-slate-300 fill-slate-200 dark:text-slate-700 dark:fill-slate-800'}`} 
                  />
                );
              })}
            </div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {totalRatingsCount} Verified Ratings
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Based on genuine, direct local client feedback in Bangalore.
            </p>
          </div>

          {/* Star Rating Breakdown Bars */}
          <div className="md:col-span-5 flex flex-col justify-center gap-3 py-2 px-2 sm:px-6">
            {[5, 4, 3, 2, 1].map(stars => {
              const count = ratingCounts[stars - 1] || 0;
              const percentage = totalRatingsCount > 0 ? (count / totalRatingsCount) * 100 : 0;
              return (
                <div key={stars} className="flex items-center gap-3.5 text-xs">
                  <span className="w-12 font-bold text-slate-700 dark:text-slate-300 flex items-center justify-end gap-1 shrink-0 font-mono">
                    {stars} <Star className="h-3 w-3 fill-amber-400 stroke-none inline" />
                  </span>
                  <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-400 rounded-full" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-10 text-slate-500 dark:text-slate-400 text-right shrink-0 font-mono">
                    {Math.round(percentage)}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Core Aspect Ratings */}
          <div className="md:col-span-3 flex flex-col justify-center gap-4 p-4 border-t md:border-t-0 md:border-l border-slate-200 dark:border-brand-teal/20">
            <h4 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest font-mono mb-1">
              Aspect Excellence
            </h4>
            
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Stain Science Treatment</span>
                  <span className="font-bold text-brand-primary dark:text-brand-accent font-mono">4.9/5.0</span>
                </div>
                <div className="h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-primary dark:bg-brand-accent" style={{ width: '98%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Fabric Restoration Care</span>
                  <span className="font-bold text-brand-primary dark:text-brand-accent font-mono">5.0/5.0</span>
                </div>
                <div className="h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-primary dark:bg-brand-accent" style={{ width: '100%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Valet Punctuality</span>
                  <span className="font-bold text-brand-primary dark:text-brand-accent font-mono">4.8/5.0</span>
                </div>
                <div className="h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-primary dark:bg-brand-accent" style={{ width: '96%' }} />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Category Controls & Write Review Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          {/* Filters */}
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 custom-scrollbar scrollbar-none">
            <span className="text-slate-400 text-xs shrink-0 flex items-center gap-1 font-semibold uppercase tracking-wider mr-1">
              <Filter className="h-3.5 w-3.5 text-brand-primary dark:text-brand-accent" />
              Filter:
            </span>
            <button
              onClick={() => setActiveTab('all')}
              className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all shrink-0 ${
                activeTab === 'all'
                  ? 'bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300'
              }`}
            >
              All ({reviews.length})
            </button>
            <button
              onClick={() => setActiveTab('dry-cleaning')}
              className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all shrink-0 ${
                activeTab === 'dry-cleaning'
                  ? 'bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Dry Cleaning ({reviews.filter(r => r.category === 'dry-cleaning').length})
            </button>
            <button
              onClick={() => setActiveTab('wash-fold')}
              className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all shrink-0 ${
                activeTab === 'wash-fold'
                  ? 'bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Wash & Fold ({reviews.filter(r => r.category === 'wash-fold').length})
            </button>
            <button
              onClick={() => setActiveTab('saree-couture')}
              className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all shrink-0 ${
                activeTab === 'saree-couture'
                  ? 'bg-brand-primary text-white dark:bg-brand-accent dark:text-brand-deep'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300'
              }`}
            >
              Sarees & Couture ({reviews.filter(r => r.category === 'saree-couture').length})
            </button>
          </div>

          {/* Trigger Button */}
          <button
            onClick={() => setShowWriteReview(!showWriteReview)}
            className="flex items-center gap-1.5 rounded-full bg-slate-950 text-white px-5 py-2 text-xs font-bold tracking-wider uppercase shadow-sm hover:bg-brand-primary transition-all duration-300 shrink-0 dark:bg-brand-accent dark:text-brand-deep dark:hover:bg-white"
            id="write-review-trigger"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            Write A Review
          </button>
        </div>

        {/* Success Alert Banner */}
        {successMsg && (
          <div className="mb-8 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm font-semibold flex items-center gap-2.5 animate-bounce">
            <CheckCircle className="h-5 w-5 stroke-[2.5]" />
            Your review was published instantly! Thank you for sharing your experience.
          </div>
        )}

        {/* Collapsible Slide-down Write Review Form */}
        {showWriteReview && (
          <div 
            ref={formRef}
            className="mb-12 rounded-2xl glass-card p-6 md:p-8 border border-brand-primary/20 bg-slate-50/50 dark:bg-brand-deep/50 relative"
            id="write-review-form-container"
          >
            <h3 className="text-base font-serif font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-brand-primary dark:text-brand-accent" />
              Share Your Tumble Spin Experience
            </h3>

            <form onSubmit={handleFormSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Full Name</label>
                  <input
                    type="text"
                    required
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    placeholder="Priya Nair"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs focus:border-brand-primary focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Your Role / Headline</label>
                  <input
                    type="text"
                    name="role"
                    value={formData.role}
                    onChange={handleFormChange}
                    placeholder="Architect, Studio Linear (Optional)"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs focus:border-brand-primary focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Your Location in Bangalore</label>
                  <input
                    type="text"
                    required
                    name="location"
                    value={formData.location}
                    onChange={handleFormChange}
                    placeholder="RR Nagar or Nagarbhavi"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs focus:border-brand-primary focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Service Category</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleFormChange}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs focus:border-brand-primary focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="dry-cleaning">Dry Cleaning</option>
                    <option value="wash-fold">Wash & Fold</option>
                    <option value="wash-iron">Wash & Iron</option>
                    <option value="saree-couture">Saree & Couture Preservation</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">Your Star Rating</label>
                  <div className="flex gap-1.5 pt-1 text-amber-400">
                    {[1, 2, 3, 4, 5].map((stars) => (
                      <button
                        key={stars}
                        type="button"
                        onClick={() => handleRatingChange(stars)}
                        className="transition-transform active:scale-95"
                      >
                        <Star 
                          className={`h-6 w-6 ${formData.rating >= stars ? 'fill-amber-400 text-amber-400' : 'text-slate-300 fill-transparent dark:text-slate-700'}`} 
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Your Review Experience</label>
                <textarea
                  required
                  name="content"
                  value={formData.content}
                  onChange={handleFormChange}
                  rows={3}
                  placeholder="Describe your garment care quality, valet pickup, packaging, and general experience..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs focus:border-brand-primary focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWriteReview(false)}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-850"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-full bg-brand-primary px-6 py-2 text-xs font-bold tracking-wider text-white uppercase dark:bg-brand-accent dark:text-brand-deep"
                >
                  Submit Review
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Dynamic List Container */}
        <div 
          ref={cardsContainerRef}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8"
          id="testimonials-grid"
        >
          {filteredReviews.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <MessageSquare className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No reviews found in this category.</p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Be the first to share your experience with this service!</p>
            </div>
          ) : (
            filteredReviews.map((test, index) => (
              <motion.div
                key={`${test.id}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="testimonial-card rounded-2xl bg-slate-50/50 dark:bg-brand-deep/20 p-6 sm:p-8 border border-brand-primary/5 dark:border-brand-teal/20 shadow-xs flex flex-col justify-between hover:border-brand-primary/20 dark:hover:border-brand-accent/25 transition-all duration-300 relative group"
                id={`testimonial-card-${test.id}`}
              >
                {/* Giant Quote Icon */}
                <div className="absolute top-6 right-6 text-brand-primary/5 dark:text-brand-accent/5 pointer-events-none group-hover:scale-105 transition-transform duration-300">
                  <Quote className="h-14 w-14 fill-current" />
                </div>

                <div>
                  <div className="flex justify-between items-start mb-4">
                    {/* Stars */}
                    <div className="flex gap-1 text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < test.rating ? 'fill-current stroke-none' : 'text-slate-200 dark:text-slate-800'}`} />
                      ))}
                    </div>

                    {/* Verified/Tag Badge */}
                    <span className="text-[9px] font-bold text-emerald-500 flex items-center gap-1 uppercase tracking-wider font-mono bg-emerald-500/5 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full">
                      <CheckCircle className="h-3 w-3 fill-current stroke-none" />
                      Verified Patron
                    </span>
                  </div>

                  {/* Review Text */}
                  <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal italic">
                    "{test.content}"
                  </p>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-200/50 dark:border-brand-teal/10 space-y-4">
                  
                  {/* Author Details */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative h-11 w-11 shrink-0 rounded-full overflow-hidden border border-brand-primary/10">
                        <img 
                          src={test.avatar} 
                          alt={test.name} 
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                          {test.name}
                          <span className="inline-flex h-2 w-2 rounded-full bg-brand-secondary" />
                        </h4>
                        <p className="text-[10px] text-slate-600 dark:text-slate-200 leading-normal">
                          {test.role}
                        </p>
                        <p className="text-[9px] text-brand-primary dark:text-brand-accent font-semibold uppercase tracking-widest font-mono mt-0.5">
                          {test.location}
                        </p>
                      </div>
                    </div>

                    {/* Likes interaction button */}
                    <button
                      onClick={() => handleLike(test.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold tracking-wider transition-all duration-300 ${
                        test.hasLiked 
                          ? 'bg-brand-primary text-white border-brand-primary dark:bg-brand-accent dark:text-brand-deep' 
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5 shrink-0 stroke-[2.2]" />
                      Helpful ({test.likes})
                    </button>
                  </div>

                  {/* Team Reply Section */}
                  {test.teamReply && (
                    <div className="rounded-xl bg-brand-light/60 dark:bg-brand-deep/30 p-4 border border-brand-primary/5 dark:border-brand-accent/5 flex gap-3 text-xs">
                      <MessageSquare className="h-4.5 w-4.5 text-brand-secondary dark:text-brand-accent shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1 text-[11px] uppercase tracking-wider font-mono">
                          Tumble Spin Care Team 
                          <span className="text-[9px] font-normal text-slate-400 capitalize">Replied</span>
                        </p>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed mt-1 text-[11px] font-normal font-sans">
                          "{test.teamReply}"
                        </p>
                      </div>
                    </div>
                  )}

                </div>
              </motion.div>
            ))
          )}
        </div>

      </div>
    </section>
  );
}
