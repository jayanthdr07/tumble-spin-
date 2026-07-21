import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Search, Compass, ShieldCheck, Clock, Sparkles, Navigation } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Neighborhood {
  id: string;
  name: string;
  x: number; // coordinate representation
  y: number; // coordinate representation
  lat: number;
  lng: number;
  popularService: string;
  valetCount: number;
  deliveryFreq: string;
  rating: number;
  promo: string;
  zone: 'East' | 'West' | 'North' | 'South' | 'Central';
}

const NEIGHBORHOODS: Neighborhood[] = [
  {
    id: 'kengeri',
    name: 'Mariyappanapalya (Kengeri Ring Rd Hub)',
    x: 50,
    y: 50,
    lat: 12.9562,
    lng: 77.5132,
    popularService: 'Main Processing Plant & Distribution Hub',
    valetCount: 15,
    deliveryFreq: 'Continuous 24-hour dispatch',
    rating: 4.99,
    promo: 'Main sorting facility supporting all local 10 km zones',
    zone: 'West'
  },
  {
    id: 'gnana-bharathi',
    name: 'Gnana Bharathi (BU Campus)',
    x: 55,
    y: 50,
    lat: 12.9462,
    lng: 77.5085,
    popularService: 'Express Wash & Fold (Student Bundles)',
    valetCount: 5,
    deliveryFreq: 'Continuous 12-hour dispatch',
    rating: 4.95,
    promo: '₹50 discount on student ID orders',
    zone: 'West'
  },
  {
    id: 'bu-quarters',
    name: 'Bangalore University Quarters',
    x: 58,
    y: 55,
    lat: 12.9410,
    lng: 77.5010,
    popularService: 'Premium Bed Linen & Heavy Curtain Care',
    valetCount: 3,
    deliveryFreq: 'Daily doorstep collection',
    rating: 4.92,
    promo: 'Free premium fabric softener upgrade',
    zone: 'West'
  },
  {
    id: 'malathalli',
    name: 'Malathalli',
    x: 55,
    y: 64,
    lat: 12.9598,
    lng: 77.4912,
    popularService: 'Traditional Zari Saree Care & Steam Ironing',
    valetCount: 4,
    deliveryFreq: 'Daily delivery cycles',
    rating: 4.94,
    promo: 'Flat 10% off on all heavy cleaning orders',
    zone: 'West'
  },
  {
    id: 'kengeri-satellite-town',
    name: 'Kengeri Satellite Town',
    x: 46,
    y: 67,
    lat: 12.9062,
    lng: 77.4820,
    popularService: 'Premium Dry Cleaning & Office Wear Press',
    valetCount: 8,
    deliveryFreq: 'Twice daily collection cycles',
    rating: 4.97,
    promo: 'Free express upgrade for active members',
    zone: 'West'
  },
  {
    id: 'kengeri-upanagara',
    name: 'Kengeri Upanagara',
    x: 37,
    y: 61,
    lat: 12.9015,
    lng: 77.4690,
    popularService: 'Express Wash & Fold (Household laundry)',
    valetCount: 6,
    deliveryFreq: 'Daily doorstep routing',
    rating: 4.93,
    promo: 'Flat ₹100 cashback on household bundles',
    zone: 'West'
  },
  {
    id: 'annapurneshwari-nagar',
    name: 'Annapurneshwari Nagar',
    x: 30,
    y: 52,
    lat: 12.9642,
    lng: 77.5002,
    popularService: 'Artisan Steam Ironing & Premium Wash',
    valetCount: 5,
    deliveryFreq: 'Daily doorstep collection',
    rating: 4.96,
    promo: 'Zero delivery surcharge for active residents',
    zone: 'West'
  },
  {
    id: 'smv-layout',
    name: 'Sir M. Visvesvaraya Layout (SMV Layout)',
    x: 32,
    y: 41,
    lat: 12.9350,
    lng: 77.4800,
    popularService: 'Couture Saree Archival Preservation',
    valetCount: 7,
    deliveryFreq: 'Hourly express scheduling',
    rating: 4.98,
    promo: 'Flat 15% off on active first bookings',
    zone: 'West'
  },
  {
    id: 'rr-nagar',
    name: 'Rajarajeshwari Nagar (RR Nagar)',
    x: 38,
    y: 30,
    lat: 12.9150,
    lng: 77.5250,
    popularService: 'Designer Footwear & Premium Bag Spa',
    valetCount: 10,
    deliveryFreq: 'Same-day Express / Twice Daily',
    rating: 4.99,
    promo: 'Free doorstep valet pickup in all apartment complexes',
    zone: 'South'
  },
  {
    id: 'nagarbavi',
    name: 'Nagarbavi',
    x: 48,
    y: 27,
    lat: 12.9719,
    lng: 77.5094,
    popularService: 'Wrinkle-Free Professional Shirt Care',
    valetCount: 9,
    deliveryFreq: 'Hourly custom delivery scheduling',
    rating: 4.98,
    promo: 'Exclusive priority processing slots',
    zone: 'West'
  },
  {
    id: 'mysore-road',
    name: 'Mysore Road',
    x: 54,
    y: 43,
    lat: 12.9480,
    lng: 77.5310,
    popularService: 'Heavy Blanket & Duvet sanitization',
    valetCount: 11,
    deliveryFreq: 'Continuous 24-hour dispatch',
    rating: 4.99,
    promo: 'Zero delivery fee for Mysore Road properties',
    zone: 'South'
  },
  {
    id: 'nayandahalli',
    name: 'Nayandahalli',
    x: 74,
    y: 43,
    lat: 12.9420,
    lng: 77.5380,
    popularService: 'Eco-safe Gentle Detergent Wet-Wash',
    valetCount: 5,
    deliveryFreq: 'Daily doorstep courier slots',
    rating: 4.91,
    promo: 'Free high-grade collar supports with orders',
    zone: 'South'
  },
  {
    id: 'papareddypalya',
    name: 'Papareddypalya',
    x: 73,
    y: 57,
    lat: 12.9740,
    lng: 77.5110,
    popularService: 'Delicate Silk Wear & Gown restoration',
    valetCount: 4,
    deliveryFreq: 'Daily valet schedules',
    rating: 4.92,
    promo: 'Eco-safe hypoallergenic detergent options',
    zone: 'West'
  },
  {
    id: 'herohalli',
    name: 'Herohalli',
    x: 65,
    y: 69,
    lat: 12.9850,
    lng: 77.4880,
    popularService: 'Household Bedding & Curtain sanitization',
    valetCount: 4,
    deliveryFreq: 'Alternate day doorstep pickup',
    rating: 4.90,
    promo: 'Complimentary insect-repellent cedar blocks',
    zone: 'West'
  },
  {
    id: 'mariapura-komaghatta',
    name: 'Mariapura / Komaghatta',
    x: 51,
    y: 74,
    lat: 12.8950,
    lng: 77.4750,
    popularService: 'Heavy Fabric & Sofa Cover deep wash',
    valetCount: 3,
    deliveryFreq: 'Daily doorstep routing',
    rating: 4.91,
    promo: 'Free premium tissue folding and box packing',
    zone: 'South'
  }
];

export default function ServiceAreasMap() {
  const [selectedId, setSelectedId] = useState<string>('gnana-bharathi');
  const [searchQuery, setSearchQuery] = useState('');
  
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const polylinesRef = useRef<L.Polyline[]>([]);

  // Initialize Map
  useEffect(() => {
    if (!mapElementRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapElementRef.current, {
      center: [NEIGHBORHOODS[0].lat, NEIGHBORHOODS[0].lng],
      zoom: 12,
      zoomControl: false,
      scrollWheelZoom: false,
    });
    mapRef.current = map;

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    const markers: { [key: string]: L.Marker } = {};

    NEIGHBORHOODS.forEach((n) => {
      const isHub = n.id === 'kengeri';

      const icon = L.divIcon({
        html: isHub ? `
          <div class="relative flex items-center justify-center">
            <div class="absolute h-9 w-9 rounded-full bg-rose-500/20 animate-ping"></div>
            <div class="h-6 w-6 rounded-full bg-rose-500 border-2 border-white flex items-center justify-center shadow-lg">
              <span class="h-2.5 w-2.5 rounded-full bg-white"></span>
            </div>
          </div>
        ` : `
          <div class="relative flex items-center justify-center">
            <div class="h-4.5 w-4.5 rounded-full bg-slate-400 border-2 border-white flex items-center justify-center shadow-md">
              <span class="h-1.5 w-1.5 rounded-full bg-white"></span>
            </div>
          </div>
        `,
        className: `custom-area-marker-${n.id}`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([n.lat, n.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div class="p-1 font-sans text-left min-w-[150px]">
            <strong class="text-xs text-slate-900 block font-bold font-sans">${n.name}</strong>
            <span class="text-[10px] text-slate-500 block mt-0.5">${n.popularService}</span>
            <span class="text-[9px] text-teal-600 block mt-0.5 font-bold font-mono">${n.zone} Zone • ${n.deliveryFreq}</span>
          </div>
        `);

      marker.on('click', () => {
        setSelectedId(n.id);
      });

      markers[n.id] = marker;
    });

    markersRef.current = markers;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update selected marker & view
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    polylinesRef.current.forEach((line) => line.remove());
    polylinesRef.current = [];

    const hub = NEIGHBORHOODS[0];
    const active = NEIGHBORHOODS.find((n) => n.id === selectedId) || hub;

    map.setView([active.lat, active.lng], 13);

    NEIGHBORHOODS.slice(1).forEach((n) => {
      const isSelected = selectedId === n.id;
      const polyline = L.polyline(
        [[hub.lat, hub.lng], [n.lat, n.lng]],
        {
          color: isSelected ? '#14b8a6' : '#94a3b8',
          weight: isSelected ? 3.5 : 1.5,
          opacity: isSelected ? 0.9 : 0.25,
          dashArray: isSelected ? '5, 5' : '3, 6',
        }
      ).addTo(map);

      polylinesRef.current.push(polyline);
    });

    NEIGHBORHOODS.forEach((n) => {
      const marker = markersRef.current[n.id];
      if (!marker) return;

      const isHub = n.id === 'kengeri';
      const isSelected = selectedId === n.id;

      let iconHtml = '';
      if (isHub) {
        iconHtml = `
          <div class="relative flex items-center justify-center">
            <div class="absolute h-9 w-9 rounded-full bg-rose-500/30 ${isSelected ? 'animate-ping' : ''}"></div>
            <div class="h-6 w-6 rounded-full bg-rose-500 border-2 border-white flex items-center justify-center shadow-lg">
              <span class="h-2.5 w-2.5 rounded-full bg-white"></span>
            </div>
          </div>
        `;
      } else if (isSelected) {
        iconHtml = `
          <div class="relative flex items-center justify-center">
            <div class="absolute h-9 w-9 rounded-full bg-teal-500/25 animate-ping"></div>
            <div class="h-5 w-5 rounded-full bg-teal-500 border-2 border-white flex items-center justify-center shadow-lg transform scale-110">
              <span class="h-2 w-2 rounded-full bg-white"></span>
            </div>
          </div>
        `;
      } else {
        iconHtml = `
          <div class="relative flex items-center justify-center">
            <div class="h-4.5 w-4.5 rounded-full bg-slate-400 dark:bg-slate-500 border-2 border-white flex items-center justify-center shadow-xs">
              <span class="h-1.5 w-1.5 rounded-full bg-white"></span>
            </div>
          </div>
        `;
      }

      const icon = L.divIcon({
        html: iconHtml,
        className: `custom-area-marker-${n.id}`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      marker.setIcon(icon);

      if (isSelected) {
        marker.openPopup();
      }
    });
  }, [selectedId]);

  // ResizeObserver to prevent Leaflet rendering bugs on layout changes
  useEffect(() => {
    if (!mapElementRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });
    observer.observe(mapElementRef.current);
    return () => observer.disconnect();
  }, []);

  const activeNeighborhood = useMemo(() => {
    return NEIGHBORHOODS.find((n) => n.id === selectedId) || NEIGHBORHOODS[0];
  }, [selectedId]);

  const filteredSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return NEIGHBORHOODS.filter(
      (n) =>
        n.id !== 'kengeri' &&
        n.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const hub = NEIGHBORHOODS[0];

  return (
    <section 
      id="service-areas-section" 
      className="py-16 px-4 md:px-8 bg-slate-50 dark:bg-brand-deep/20 border-t border-slate-100 dark:border-brand-teal/5 transition-colors duration-500"
    >
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header Block */}
        <div className="text-center max-w-2xl mx-auto space-y-3.5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-primary/10 dark:bg-brand-accent/10 border border-brand-primary/20 dark:border-brand-accent/25 text-brand-primary dark:text-brand-accent text-xs font-mono font-bold uppercase tracking-widest">
            <Compass className="h-3.5 w-3.5 animate-spin-slow" />
            Bangalore Footprint
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-black tracking-tight text-slate-900 dark:text-white leading-tight">
            Neighborhoods We <span className="text-brand-primary dark:text-brand-accent">Serve</span>
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
            <span className="font-bold text-brand-primary dark:text-brand-accent">Tumble Spin Service Areas (Within 10 km of Mariyappanapalya, Kengeri Ring Road)</span>
            <br />
            Tumble Spin can offer premium laundry and dry-cleaning services in the following locations:
          </p>
        </div>

        {/* Interactive Bento Dashboard Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Left Side: Visual Interactive Map (7 Cols) */}
          <div 
            className="lg:col-span-7 bg-white dark:bg-brand-dark border border-slate-100 dark:border-brand-teal/5 rounded-3xl p-4 sm:p-6 shadow-xs relative flex flex-col justify-between overflow-hidden min-h-[400px]"
            id="neighborhoods-leaflet-map-container"
          >
            {/* Background Map Grid Accents */}
            <div className="absolute inset-0 bg-grid-slate-100/50 dark:bg-grid-white/[0.02] opacity-75 pointer-events-none" />

            {/* Floating Search Auto-complete Widget */}
            <div className="relative z-10 w-full sm:w-80 space-y-1" id="map-search-bar">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <input 
                  type="text"
                  placeholder="Search Bangalore neighborhood..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-100 dark:border-brand-teal/10 bg-slate-50/50 dark:bg-brand-deep/20 text-xs font-sans text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-teal-500 transition-all shadow-sm"
                />
              </div>

              {/* Suggestions List */}
              <AnimatePresence>
                {filteredSuggestions.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-brand-dark border border-slate-100 dark:border-brand-teal/10 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto z-50 text-left"
                  >
                    {filteredSuggestions.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          setSelectedId(n.id);
                          setSearchQuery('');
                        }}
                        className="w-full px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-brand-deep/30 text-left flex items-center justify-between border-b last:border-0 border-slate-50 dark:border-slate-800/50"
                      >
                        <span className="font-semibold">{n.name}</span>
                        <span className="text-[10px] text-teal-400 font-mono">{n.zone} Zone</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Real Interactive Leaflet Map Element */}
            <div className="relative flex-1 w-full rounded-2xl overflow-hidden border border-slate-100 dark:border-brand-teal/10 min-h-[350px] shadow-xs my-4 z-10" id="leaflet-main-map-parent">
              <div 
                ref={mapElementRef} 
                className="h-full w-full" 
                style={{ minHeight: '350px', position: 'relative' }}
              />
            </div>

            {/* Map Legend indicators */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-brand-teal/5 text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold uppercase shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block" />
                  <span>Kengeri Master Plant</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-teal-400 inline-block" />
                  <span>Doorstep Valet Zones</span>
                </div>
              </div>
              <span className="text-teal-500 tracking-wider">● Interactive map</span>
            </div>
          </div>

          {/* Right Side: Interactive Bento details pane & Grid (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            {/* Bento Card 1: Active Location Details */}
            <div className="flex-1 bg-white dark:bg-brand-dark border border-slate-100 dark:border-brand-teal/5 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-teal-500/5 to-transparent rounded-full filter blur-xl" />
              
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] text-teal-500 dark:text-teal-400 font-mono font-black uppercase tracking-widest block">
                      {activeNeighborhood.zone} Bangalore Operations
                    </span>
                    <h3 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                      {activeNeighborhood.name}
                    </h3>
                  </div>
                  <div className="p-3 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-2xl animate-pulse">
                    <MapPin className="h-5 w-5" />
                  </div>
                </div>

                {/* Interactive metrics grid */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-50/50 dark:bg-brand-deep/20 border border-slate-100 dark:border-brand-teal/5 p-3 rounded-2xl space-y-1 text-left">
                    <span className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-wider block">Specialty Care</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                      {activeNeighborhood.popularService}
                    </span>
                  </div>

                  <div className="bg-slate-50/50 dark:bg-brand-deep/20 border border-slate-100 dark:border-brand-teal/5 p-3 rounded-2xl space-y-1 text-left">
                    <span className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-wider block">Dispatch Frequency</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                      {activeNeighborhood.deliveryFreq}
                    </span>
                  </div>

                  <div className="bg-slate-50/50 dark:bg-brand-deep/20 border border-slate-100 dark:border-brand-teal/5 p-3 rounded-2xl space-y-1 text-left">
                    <span className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-wider block">Valet Fleet Active</span>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-ping" />
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                        {activeNeighborhood.valetCount} Specialists
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 dark:bg-brand-deep/20 border border-slate-100 dark:border-brand-teal/5 p-3 rounded-2xl space-y-1 text-left">
                    <span className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-wider block">Satisfaction Rating</span>
                    <div className="flex items-center gap-1">
                      <span className="text-amber-400 font-bold">★</span>
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                        {activeNeighborhood.rating.toFixed(2)} / 5.0
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Promo Banner block */}
              <div className="bg-teal-500/5 border border-teal-500/10 rounded-2xl p-4 flex items-start gap-3 text-left relative overflow-hidden">
                <Sparkles className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-[9px] text-teal-500 dark:text-teal-400 font-mono font-bold uppercase tracking-widest block">Active Local Campaign</span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {activeNeighborhood.promo}
                  </p>
                </div>
              </div>

              {/* Direct Maps Routing buttons */}
              {activeNeighborhood.id !== 'kengeri' && (
                <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Tumble Spin, " + activeNeighborhood.name + ", Bangalore")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-850 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 transition-all font-sans text-xs font-black uppercase tracking-wider shadow-sm group"
                  >
                    <Navigation className="h-4 w-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    Open Route in Maps
                  </a>
                </div>
              )}
            </div>

            {/* Quick Directory list of neighborhoods to select */}
            <div className="bg-white dark:bg-brand-dark border border-slate-100 dark:border-brand-teal/5 rounded-3xl p-5 shadow-xs max-h-52 overflow-y-auto space-y-2">
              <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider block text-left">
                Direct Zone Selection ({NEIGHBORHOODS.length - 1} Neighborhoods)
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-left">
                {NEIGHBORHOODS.slice(1).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setSelectedId(n.id)}
                    className={`px-3 py-2 rounded-xl text-[11px] font-bold font-sans transition-all flex items-center justify-between border ${
                      selectedId === n.id 
                        ? 'bg-teal-500/10 text-teal-400 border-teal-500/30' 
                        : 'bg-slate-50/50 hover:bg-slate-50 dark:bg-brand-deep/10 dark:hover:bg-brand-deep/20 text-slate-700 dark:text-slate-300 border-transparent'
                    }`}
                  >
                    <span className="truncate">{n.name}</span>
                    <span className="text-[8px] font-mono opacity-65 shrink-0 ml-1">📍</span>
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* Value Proposition Grid (3 columns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="bg-white dark:bg-brand-dark border border-slate-100 dark:border-brand-teal/5 rounded-2xl p-5 flex items-start gap-4 text-left">
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase font-mono tracking-wider text-slate-900 dark:text-white">Same-Day Express Available</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                Select areas including Kengeri, Rajarajeshwari Nagar, and Vijayanagar enjoy dedicated expedited courier slots for urgent events.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-brand-dark border border-slate-100 dark:border-brand-teal/5 rounded-2xl p-5 flex items-start gap-4 text-left">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase font-mono tracking-wider text-slate-900 dark:text-white">Dedicated Valet Tracking</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                Every neighborhood is allocated custom local valet personnel, ensuring complete doorstep accountability.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-brand-dark border border-slate-100 dark:border-brand-teal/5 rounded-2xl p-5 flex items-start gap-4 text-left">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase font-mono tracking-wider text-slate-900 dark:text-white">Zero Carbon Wet-Cleaning</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                All garments from any neighborhood are processed at our master sanitizing plant using non-toxic biodegradable cleansers.
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
