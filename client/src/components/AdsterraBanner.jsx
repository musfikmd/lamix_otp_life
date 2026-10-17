import React, { useEffect, useRef } from 'react';

export const AdsterraBanner = ({ 
  adKey = '', 
  width = 320, 
  height = 50,
  format = 'iframe',
  fallbackText = 'Sponsored Advertisement'
}) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous children
    container.innerHTML = '';

    if (!adKey) {
      return;
    }

    try {
      const iframe = document.createElement('iframe');
      iframe.width = String(width);
      iframe.height = String(height);
      iframe.style.border = 'none';
      iframe.style.overflow = 'hidden';
      iframe.scrolling = 'no';
      iframe.frameBorder = '0';
      iframe.marginWidth = '0';
      iframe.marginHeight = '0';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: transparent; }
            </style>
          </head>
          <body>
            <script type="text/javascript">
              atOptions = {
                'key' : '${adKey}',
                'format' : '${format}',
                'height' : ${height},
                'width' : ${width},
                'params' : {}
              };
            </script>
            <script type="text/javascript" src="//www.highperformanceformat.com/${adKey}/invoke.js"></script>
          </body>
        </html>
      `;

      container.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
      }
    } catch (e) {
      console.warn('Adsterra banner mount error:', e);
    }

    return () => {
      if (container) container.innerHTML = '';
    };
  }, [adKey, width, height, format]);

  return (
    <div className="w-full flex flex-col items-center justify-center my-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[9px] font-black uppercase tracking-widest text-[#A8988C] bg-[#EBE3D8]/60 px-2 py-0.5 rounded-full">
          Ad • Adsterra
        </span>
      </div>

      <div 
        ref={containerRef} 
        className="flex items-center justify-center overflow-hidden rounded-2xl border border-[#EBE3D8] bg-white shadow-sm min-h-[50px] w-full max-w-sm"
        style={{ minHeight: `${height}px` }}
      >
        {!adKey && (
          <div className="p-3 text-center text-xs text-[#8D786D] flex flex-col items-center justify-center">
            <span className="font-semibold text-[#5C3824]">💰 Adsterra Banner Slot ({width}x{height})</span>
            <span className="text-[10px] text-[#A8988C] mt-0.5">Paste your Ad Unit Key in Settings / Admin to activate live ads!</span>
          </div>
        )}
      </div>
    </div>
  );
};
