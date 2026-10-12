import React, { useState } from 'react';
import { useTelegram } from '../context/TelegramContext';
import { X, ArrowRight, Sparkles } from 'lucide-react';

export const ClaimServiceModal = ({ service, onClose, onClaimNumber }) => {
  const { triggerHaptic } = useTelegram();
  const ranges = service?.ranges || [];
  const [selectedRange, setSelectedRange] = useState(ranges[0] || null);
  const [quantity, setQuantity] = useState(1);
  const [isClaiming, setIsClaiming] = useState(false);

  if (!service) return null;

  const handleClaim = () => {
    if (!selectedRange) return;
    triggerHaptic('heavy');
    setIsClaiming(true);

    onClaimNumber({
      service,
      range: selectedRange,
      quantity
    });
    setIsClaiming(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-md bg-[#FFFFFF] border-t sm:border border-[#EBE3D8] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#F0E8DE]">
          <div className="flex items-center gap-3">
            <span className="text-3xl p-2 rounded-2xl bg-[#FAF7F2] border border-[#EBE3D8]">
              {service.icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[#26160F] leading-tight">
                  {service.name}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF7F2] text-[#6E442D] border border-[#EBE3D8]">
                  {service.badge || 'Live Stock'}
                </span>
              </div>
              <p className="text-xs text-[#826A5C] mt-0.5">
                Virtual OTP Verification Numbers
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-[#FAF7F2] text-[#826A5C] hover:text-[#26160F] flex items-center justify-center border border-[#EBE3D8]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Country & Provider Selection */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-[#4A2E1F] uppercase tracking-wider">
              Select Country & Rate
            </label>
            <span className="text-[11px] text-[#8D5B4C] font-semibold">
              {ranges.length} {ranges.length === 1 ? 'Country' : 'Countries'} Available
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {ranges.length === 0 ? (
              <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EBE3D8] text-center text-xs text-[#826A5C]">
                Currently no numbers in stock for this service.
              </div>
            ) : (
              ranges.map((range) => {
                const isSelected = selectedRange && selectedRange.id === range.id;
                return (
                  <div
                    key={range.id}
                    onClick={() => {
                      triggerHaptic('selection');
                      setSelectedRange(range);
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#F7F2EC] border-[#5C3824] shadow-sm'
                        : 'bg-[#FAF7F2] border-[#EBE3D8] hover:border-[#D5C6B6]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{range.flag}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-[#26160F]">
                            {range.country}
                          </span>
                          <span className="text-xs text-[#826A5C] font-mono">
                            {range.dialCode}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[#826A5C]">
                            Server: {range.provider}
                          </span>
                          <span className="text-[10px] text-[#2D6A4F] font-semibold">
                            ● {range.stock} In Stock
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black text-[#5C3824] font-mono">
                        ৳{range.rate.toFixed(2)}
                      </div>
                      <span className="text-[10px] text-[#826A5C] block">per SMS</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quantity Selector */}
        <div className="mt-4 pt-3 border-t border-[#F0E8DE]">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-[#4A2E1F] uppercase tracking-wider">
              Quantity (How Many Numbers?)
            </label>
            <span className="text-[11px] text-[#826A5C]">Max 6 Numbers</span>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <button
                key={num}
                onClick={() => {
                  triggerHaptic('selection');
                  setQuantity(num);
                }}
                className={`py-2 rounded-xl text-sm font-bold border transition-all ${
                  quantity === num
                    ? 'bg-[#5C3824] text-white border-[#5C3824] shadow-md shadow-[#5C3824]/20'
                    : 'bg-[#FAF7F2] text-[#4A2E1F] border-[#EBE3D8] hover:border-[#D5C6B6]'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Card */}
        <div className="mt-4 p-3 rounded-2xl bg-[#FAF7F2] border border-[#EBE3D8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#C48B5E]" />
            <span className="text-xs font-semibold text-[#4A2E1F]">Estimated Potential Earnings</span>
          </div>
          <div className="text-sm font-black text-[#2D6A4F] font-mono">
            ৳{selectedRange?.rate ? (selectedRange.rate * quantity).toFixed(2) : '0.00'}
          </div>
        </div>

        {/* Claim Action Button */}
        <div className="mt-4">
          <button
            onClick={handleClaim}
            disabled={isClaiming || !selectedRange || selectedRange.stock === 0}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#4A2E1F] via-[#5C3824] to-[#784A33] hover:from-[#3D2518] hover:to-[#6E442D] active:scale-[0.98] text-white font-bold text-sm shadow-lg shadow-[#4A2E1F]/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isClaiming ? (
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Assigning Numbers...</span>
              </div>
            ) : !selectedRange ? (
              <span>Select a Country</span>
            ) : selectedRange.stock === 0 ? (
              <span>Out of Stock</span>
            ) : (
              <>
                <span>Claim {quantity} {quantity > 1 ? 'Numbers' : 'Number'} ({selectedRange.country})</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <p className="text-[11px] text-center text-[#826A5C] mt-2">
            🔒 Numbers are reserved for 20 minutes. Zero upfront fee!
          </p>
        </div>
      </div>
    </div>
  );
};
