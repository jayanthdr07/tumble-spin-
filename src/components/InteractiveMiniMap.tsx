import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Compass, Info, Clock, Truck, Crosshair, Loader2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Sector {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  distance: number; // in km
  estTime: string; // doorstep valet arrival time
  minOrder: number; // in ₹
}

const SECTORS: Sector[] = [
  {
    id: 'mariyappanapalya',
    name: 'Tumble Spin (Central Hub)',
    lat: 12.9562,
    lng: 77.5132,
    address: 'Tumble Spin, #6, 80 feet road, Kengeri Ring Rd, Mariyappana Palya, Bengaluru, Karnataka 560056, India',
    distance: 0.1,
    estTime: '10 mins',
    minOrder: 200
  },
  {
    id: 'nagarbhavi',
    name: 'Nagarbhavi (North Sector)',
    lat: 12.9719,
    lng: 77.5094,
    address: 'Nagarbhavi, near BDA Complex, Bengaluru, Karnataka 560072',
    distance: 1.8,
    estTime: '15 mins',
    minOrder: 200
  },
  {
    id: 'mallathahalli',
    name: 'Mallathahalli (West Sector)',
    lat: 12.9594,
    lng: 77.4981,
    address: 'Mallathahalli Lake Area, Bengaluru, Karnataka 560056',
    distance: 1.7,
    estTime: '15 mins',
    minOrder: 200
  },
  {
    id: 'rrnagar',
    name: 'Rajarajeshwari Nagar (South Sector)',
    lat: 12.9284,
    lng: 77.5152,
    address: 'RR Nagar Double Road, Bengaluru, Karnataka 560098',
    distance: 3.1,
    estTime: '20 mins',
    minOrder: 250
  },
  {
    id: 'kengeri',
    name: 'Kengeri (South-West Sector)',
    lat: 12.9176,
    lng: 77.4834,
    address: 'Kengeri Satellite Town, Bengaluru, Karnataka 560060',
    distance: 5.3,
    estTime: '25 mins',
    minOrder: 300
  },
  {
    id: 'vijayanagar',
    name: 'Vijayanagar (East Sector)',
    lat: 12.9692,
    lng: 77.5361,
    address: 'Vijayanagar Metro Station Area, Bengaluru, Karnataka 560040',
    distance: 2.9,
    estTime: '20 mins',
    minOrder: 250
  },
  {
    id: 'chandralayout',
    name: 'Chandra Layout (North-East Sector)',
    lat: 12.9587,
    lng: 77.5276,
    address: 'Chandra Layout 80 Feet Road, Bengaluru, Karnataka 560040',
    distance: 1.6,
    estTime: '15 mins',
    minOrder: 200
  }
];

interface InteractiveMiniMapProps {
  onLocationSelected: (address: string, details: { distance: number; estTime: string }) => void;
  initialAddress?: string;
}

export default function InteractiveMiniMap({ onLocationSelected, initialAddress = '' }: InteractiveMiniMapProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<Sector>(SECTORS[0]);
  const [searchResults, setSearchResults] = useState<Sector[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const activeMarkerRef = useRef<L.Marker | null>(null);

  // Sync initial address with corresponding sector if matched
  useEffect(() => {
    if (initialAddress) {
      const matched = SECTORS.find(s => 
        initialAddress.toLowerCase().includes(s.name.split(' (')[0].toLowerCase()) || 
        initialAddress.toLowerCase().includes(s.id)
      );
      if (matched && matched.id !== selectedSector.id) {
        setSelectedSector(matched);
        if (mapRef.current && activeMarkerRef.current) {
          mapRef.current.setView([matched.lat, matched.lng], 14);
          activeMarkerRef.current.setLatLng([matched.lat, matched.lng]);
        }
      }
    }
  }, [initialAddress]);

  // Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [SECTORS[0].lat, SECTORS[0].lng],
      zoom: 13,
      zoomControl: false,
    });
    mapRef.current = map;

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Setup central hub marker (Tumblespin Care Studio)
    const hubIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute h-8 w-8 rounded-full bg-teal-500/30 animate-ping"></div>
          <div class="h-5 w-5 rounded-full bg-teal-500 border-2 border-white dark:border-brand-deep flex items-center justify-center shadow-lg">
            <span class="h-2 w-2 rounded-full bg-white"></span>
          </div>
        </div>
      `,
      className: 'custom-hub-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker([SECTORS[0].lat, SECTORS[0].lng], { icon: hubIcon })
      .addTo(map)
      .bindPopup(`<strong style="font-family: Inter, sans-serif; font-size: 11px;">Tumblespin Central Studio</strong>`)
      .openPopup();

    // Setup interactive marker for user doorstep valet selection
    const activeIcon = L.divIcon({
      html: `
        <div class="relative flex flex-col items-center justify-center">
          <div class="absolute h-10 w-10 rounded-full bg-indigo-500/25 animate-ping -bottom-3"></div>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#6366f1" width="36" height="36" style="filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.3)); transform: translateY(-8px);">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      `,
      className: 'custom-active-marker',
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });

    const activeMarker = L.marker([SECTORS[0].lat, SECTORS[0].lng], { icon: activeIcon }).addTo(map);
    activeMarkerRef.current = activeMarker;

    // Handle map click
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      activeMarker.setLatLng([lat, lng]);
      map.panTo([lat, lng]);

      // Calculate distance from central hub
      const hubLat = SECTORS[0].lat;
      const hubLng = SECTORS[0].lng;
      
      const R = 6371; // km
      const dLat = (lat - hubLat) * Math.PI / 180;
      const dLng = (lng - hubLng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(hubLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const calculatedDistance = parseFloat((R * c).toFixed(1));

      const estArrivalMin = Math.round(calculatedDistance * 4 + 15);
      
      const customSector: Sector = {
        id: `custom-${lat.toFixed(4)}-${lng.toFixed(4)}`,
        name: `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        lat,
        lng,
        address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        distance: calculatedDistance,
        estTime: `${estArrivalMin} mins`,
        minOrder: calculatedDistance > 5 ? 300 : 250
      };

      setSelectedSector(customSector);
      setIsGeocoding(true);

      try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'TumblespinLaundromatApp/1.0'
          }
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.display_name) {
            customSector.address = data.display_name;
            customSector.name = data.address.suburb || data.address.neighbourhood || data.address.road || 'Pinned Location';
          }
        }
      } catch (err) {
        console.error('Reverse geocoding error:', err);
        customSector.address = `${lat.toFixed(5)}, ${lng.toFixed(5)}, Sector Zone, Bangalore, Karnataka`;
      } finally {
        setIsGeocoding(false);
        onLocationSelected(customSector.address, { distance: calculatedDistance, estTime: customSector.estTime });
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const handleSelectSector = (sector: Sector) => {
    setSelectedSector(sector);
    setSearchQuery(sector.name);
    setShowDropdown(false);

    if (mapRef.current && activeMarkerRef.current) {
      mapRef.current.setView([sector.lat, sector.lng], 14);
      activeMarkerRef.current.setLatLng([sector.lat, sector.lng]);
    }

    onLocationSelected(sector.address, { distance: sector.distance, estTime: sector.estTime });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim() === '') {
      setSearchResults([]);
      setShowDropdown(false);
    } else {
      const filtered = SECTORS.filter(s => 
        s.name.toLowerCase().includes(query.toLowerCase()) || 
        s.address.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(filtered);
      setShowDropdown(true);
    }
  };

  return (
    <div className="border border-slate-150 dark:border-brand-teal/10 bg-slate-50/50 dark:bg-brand-deep/20 rounded-2xl p-4 space-y-3" id="interactive-mini-map-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/50 dark:border-brand-teal/5 pb-2.5">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-brand-primary dark:text-brand-accent animate-spin-slow" />
          <div>
            <h5 className="text-[11px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
              Interactive OpenStreetMap Valet Map
            </h5>
            <p className="text-[9px] text-slate-400 dark:text-slate-500">
              Pick your location in Bangalore for live doorstep delivery estimation
            </p>
          </div>
        </div>
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary dark:bg-brand-accent/15 dark:text-brand-accent font-bold self-start sm:self-auto uppercase tracking-wider">
          Coverage: 100% Free Doorstep Valet
        </span>
      </div>

      {/* Map Search bar */}
      <div className="relative">
        <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-brand-teal/15 px-3 py-1.5 shadow-xs">
          <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
            placeholder="Search delivery sector (e.g. Nagarbhavi, Kengeri, Vijayanagar...)"
            className="w-full text-xs font-semibold text-slate-800 dark:text-white bg-transparent outline-hidden"
          />
          <button
            type="button"
            onClick={() => handleSelectSector(SECTORS[0])}
            className="text-[9px] text-brand-primary dark:text-brand-accent font-extrabold shrink-0 hover:underline uppercase flex items-center gap-1 ml-1"
          >
            <Crosshair className="h-3 w-3 shrink-0" />
            Recenter Studio
          </button>
        </div>

        {/* Search dropdown suggestions */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-brand-teal/20 shadow-lg z-20 max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {searchResults.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectSector(s)}
                className="w-full text-left px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-brand-deep/40 transition-colors flex justify-between items-center"
              >
                <span>{s.name}</span>
                <span className="text-[9px] text-slate-400 font-mono">{s.distance} km</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Real Interactive Leaflet Map Div */}
      <div className="relative h-44 w-full rounded-xl border border-slate-200 dark:border-brand-teal/10 overflow-hidden shadow-xs" id="leaflet-map-element-parent">
        <div 
          ref={mapContainerRef} 
          className="h-full w-full z-10" 
          style={{ minHeight: '100%' }}
        />
        {isGeocoding && (
          <div className="absolute inset-0 bg-white/75 dark:bg-brand-dark/75 flex items-center justify-center z-20 gap-2">
            <Loader2 className="h-4 w-4 text-brand-primary dark:text-brand-accent animate-spin" />
            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
              Resolving address...
            </span>
          </div>
        )}
        <div className="absolute bottom-1.5 left-1.5 bg-white/90 dark:bg-brand-dark/95 border border-slate-100 dark:border-brand-teal/5 px-2 py-1 rounded-lg text-[8px] font-bold text-slate-500 dark:text-slate-400 font-mono shadow-xs z-20">
          📍 Click anywhere to pin valet doorstep location
        </div>
      </div>

      {/* Real-time Distance, Dispatch, and Minimum Order Estimation Info Card */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-brand-teal/5 p-2 rounded-xl">
          <div className="flex items-center justify-center gap-1 text-[8px] text-slate-400 font-bold uppercase tracking-wider">
            <Compass className="h-3 w-3 text-slate-400 shrink-0" />
            Distance
          </div>
          <span className="block text-xs font-extrabold font-mono text-slate-800 dark:text-white mt-1">
            {selectedSector.distance} km
          </span>
          <span className="text-[7px] text-slate-400 dark:text-slate-500 block font-semibold mt-0.5 font-mono">hub delta</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-brand-teal/5 p-2 rounded-xl">
          <div className="flex items-center justify-center gap-1 text-[8px] text-slate-400 font-bold uppercase tracking-wider">
            <Clock className="h-3 w-3 text-brand-primary dark:text-brand-accent shrink-0" />
            Valet Arrives
          </div>
          <span className="block text-xs font-extrabold font-mono text-slate-800 dark:text-white mt-1">
            {selectedSector.estTime}
          </span>
          <span className="text-[7px] text-emerald-500 font-extrabold block mt-0.5">ESTIMATED LIVE</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-brand-teal/5 p-2 rounded-xl">
          <div className="flex items-center justify-center gap-1 text-[8px] text-slate-400 font-bold uppercase tracking-wider">
            <Truck className="h-3 w-3 text-brand-secondary shrink-0" />
            Valet Charge
          </div>
          <span className="block text-xs font-extrabold font-mono text-brand-secondary dark:text-brand-accent mt-1">
            FREE
          </span>
          <span className="text-[7px] text-slate-400 dark:text-slate-500 block font-semibold mt-0.5">Min. Order: ₹{selectedSector.minOrder}</span>
        </div>
      </div>

      {/* Selected location confirmation info bar */}
      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-brand-primary/[0.02] dark:bg-brand-accent/[0.02] border border-brand-primary/10 dark:border-brand-accent/15">
        <Info className="h-3.5 w-3.5 text-brand-primary dark:text-brand-accent shrink-0" />
        <p className="text-[10px] leading-tight text-slate-600 dark:text-slate-300 font-medium">
          Selected: <strong className="text-slate-800 dark:text-white">{selectedSector.name}</strong>. Doorstep valet coordinates resolved to address input.
        </p>
      </div>
    </div>
  );
}
