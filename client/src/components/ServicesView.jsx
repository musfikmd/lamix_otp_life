import React, { useState, useMemo, useEffect } from 'react';
import { useTelegram } from '../context/TelegramContext';
import { CATEGORIES, SERVICES } from '../data/servicesData';
import { Search, Zap, ArrowUpRight } from 'lucide-react';
import { BannerAd } from './BannerAd';

export const ServicesView = ({ onSelectService, ads = null }) => {
  const { triggerHaptic } = useTelegram();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [servicesList, setServicesList] = useState(SERVICES);

  useEffect(() => {
    fetch('/api/services')
      .then((res) => res.json())
      .then((data) => {
        if (data?.services && data.services.length > 0) {
          setServicesList(data.services);
        }
      })
      .catch(() => {});
  }, []);

  // Filter services
  const filteredServices = useMemo(() => {
    return servicesList.filter((service) => {
      const matchesCategory =
        selectedCategory === 'all'
          ? true
          : selectedCategory === 'popular'
          ? service.isPopular
          : service.category === selectedCategory;

      const matchesSearch =
        service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (service.ranges && service.ranges.some((r) => r.country.toLowerCase().includes(searchQuery.toLowerCase())));

      return matchesCategory && matchesSearch;
    });
  }, [servicesList, selectedCategory, searchQuery]);

  return (
    <div className="pb-24 pt-2 px-4 space-y-4">
      {/* Live Notice / Announcement Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#4A2E1F] via-[#5C3824] to-[#784A33] border border-[#6E442D] p-4 shadow-lg shadow-[#4A2E1F]/15 text-white">
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
              <Zap className="w-5 h-5 text-amber-300 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-black/20 px-1.5 py-0.5 rounded">
                  LIVE ENGINE
                </span>
                <span className="text-xs font-bold text-white">
                  OTP LIFE Live Server Active
                </span>
              </div>
              <p className="text-[11px] text-[#F3E8E1] mt-0.5">
                Instant SMS detection with automatic BDT earnings per OTP.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8D786D]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search service or country (WhatsApp, Algeria...)"
          className="w-full bg-[#FFFFFF] border border-[#EBE3D8] rounded-2xl pl-10 pr-4 py-2.5 text-sm text-[#26160F] placeholder:text-[#A8988C] focus:outline-none focus:border-[#5C3824] shadow-sm transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8D786D] hover:text-[#26160F]"
          >
            Clear
          </button>
        )}
      </div>

      {/* Category Horizontal Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                triggerHaptic('selection');
                setSelectedCategory(cat.id);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#5C3824] text-white shadow-md shadow-[#5C3824]/20'
                  : 'bg-[#FFFFFF] text-[#7A6355] hover:text-[#26160F] border border-[#EBE3D8]'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Monetization / Sponsor Banner Ad */}
      <BannerAd ads={ads} slot="services" />

      {/* Services Grid */}
      <div className="grid grid-cols-2 gap-3">
        {filteredServices.map((service) => {
          const ranges = service.ranges || [];
          const rates = ranges.map((r) => r.rate);
          const minRate = rates.length > 0 ? Math.min(...rates) : 1.50;
          const maxRate = rates.length > 0 ? Math.max(...rates) : 1.50;

          return (
            <div
              key={service.id}
              onClick={() => {
                triggerHaptic('medium');
                onSelectService(service);
              }}
              className="group relative bg-[#FFFFFF] border border-[#EBE3D8] hover:border-[#8D5B4C] rounded-3xl p-3.5 flex flex-col justify-between transition-all duration-200 active:scale-95 cursor-pointer shadow-sm hover:shadow-md hover:shadow-[#5C3824]/10"
            >
              {/* Badge */}
              {service.badge && (
                <div className="absolute top-2.5 right-2.5">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#FAF7F2] text-[#6E442D] border border-[#EBE3D8]">
                    {service.badge}
                  </span>
                </div>
              )}

              {/* Service Icon & Title */}
              <div>
                <div className="w-11 h-11 rounded-2xl bg-[#FAF7F2] border border-[#EBE3D8] flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  {service.icon}
                </div>
                <h3 className="font-bold text-sm text-[#26160F] mt-2.5 truncate">
                  {service.name}
                </h3>
                <div className="flex items-center gap-1 mt-0.5 text-[11px] text-[#826A5C]">
                  <span>{ranges.length} {ranges.length === 1 ? 'Country' : 'Countries'}</span>
                </div>
              </div>

              {/* Rate & Action */}
              <div className="mt-3 pt-2.5 border-t border-[#F0E8DE] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#8D786D] block leading-none font-medium">Rate</span>
                  <div className="text-xs font-black text-[#2D6A4F] font-mono mt-0.5">
                    {rates.length > 0 ? `৳${minRate.toFixed(2)} - ৳${maxRate.toFixed(2)}` : '৳1.50'}
                  </div>
                </div>

                <div className="w-7 h-7 rounded-xl bg-[#5C3824]/10 text-[#5C3824] group-hover:bg-[#5C3824] group-hover:text-white flex items-center justify-center transition-colors">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredServices.length === 0 && (
        <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-[#EBE3D8]">
          <p className="text-[#8D786D] text-sm">No services found.</p>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSearchQuery('');
            }}
            className="mt-2 text-xs text-[#5C3824] font-bold"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
};
