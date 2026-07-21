import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Award, Users, ShieldCheck, MapPin, Smile } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export default function TrustBar() {
  const barRef = useRef<HTMLDivElement>(null);
  
  // States for counters to ensure seamless React display
  const [stats, setStats] = useState({
    customers: 0,
    onTime: 0,
    garmentsCared: 0,
    postalCodes: 0,
    satisfaction: 0
  });

  useEffect(() => {
    if (!barRef.current) return;

    const targetStats = {
      customers: 12400,
      onTime: 99.8,
      garmentsCared: 450, // in thousands (450k)
      postalCodes: 42,
      satisfaction: 100
    };

    const animObject = {
      customers: 0,
      onTime: 0,
      garmentsCared: 0,
      postalCodes: 0,
      satisfaction: 0
    };

    const ctx = gsap.context(() => {
      gsap.to(animObject, {
        customers: targetStats.customers,
        onTime: targetStats.onTime,
        garmentsCared: targetStats.garmentsCared,
        postalCodes: targetStats.postalCodes,
        satisfaction: targetStats.satisfaction,
        duration: 2.2,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: barRef.current,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
        onUpdate: () => {
          setStats({
            customers: Math.floor(animObject.customers),
            onTime: Number(animObject.onTime.toFixed(1)),
            garmentsCared: Math.floor(animObject.garmentsCared),
            postalCodes: Math.floor(animObject.postalCodes),
            satisfaction: Math.floor(animObject.satisfaction)
          });
        }
      });
    }, barRef);

    return () => ctx.revert();
  }, []);

  const statItems = [
    {
      id: 'stat-customers',
      value: stats.customers.toLocaleString() + '+',
      label: 'Delighted Clients',
      icon: <Users className="h-5 w-5" />,
      desc: 'Exclusive households'
    },
    {
      id: 'stat-ontime',
      value: stats.onTime + '%',
      label: 'On-Time Handover',
      icon: <ShieldCheck className="h-5 w-5" />,
      desc: 'Guaranteed time-slots'
    },
    {
      id: 'stat-garments',
      value: stats.garmentsCared + 'k+',
      label: 'Garments Polished',
      icon: <Award className="h-5 w-5" />,
      desc: 'Absolute fabric safety'
    },
    {
      id: 'stat-coverage',
      value: stats.postalCodes + ' Districts',
      label: 'Pickup Coverage',
      icon: <MapPin className="h-5 w-5" />,
      desc: 'Bespoke delivery fleet'
    },
    {
      id: 'stat-satisfaction',
      value: stats.satisfaction + '%',
      label: 'Elite Rating',
      icon: <Smile className="h-5 w-5" />,
      desc: '5-star reviews standard'
    }
  ];

  return (
    <div 
      ref={barRef}
      className="relative z-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-8"
      id="trust-bar-container"
    >
      <div className="rounded-2xl bg-slate-900 text-white p-6 md:p-8 shadow-xl dark:bg-brand-deep border border-brand-accent/10">
        
        {/* Subtle Water/Aqua Gradient Backdrop Light */}
        <div className="absolute top-0 right-10 w-48 h-12 bg-brand-accent/20 blur-xl pointer-events-none rounded-full" />
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-800 dark:divide-brand-teal/30">
          {statItems.map((item, idx) => (
            <div 
              key={item.id} 
              className={`flex flex-col items-center text-center p-3 md:p-1 ${
                idx > 0 && idx % 2 === 0 ? 'border-t sm:border-t-0' : ''
              }`}
              id={item.id}
            >
              {/* Stat Icon */}
              <div className="mb-2 text-brand-secondary dark:text-brand-accent">
                {item.icon}
              </div>

              {/* Counter Value */}
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono">
                {item.value}
              </div>

              {/* Title / Label */}
              <div className="mt-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider font-sans">
                {item.label}
              </div>

              {/* Supporting details */}
              <div className="text-[10px] text-slate-400 mt-0.5">
                {item.desc}
              </div>

            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
