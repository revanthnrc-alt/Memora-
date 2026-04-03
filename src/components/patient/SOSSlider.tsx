import React, { useState, useRef, MouseEvent, TouchEvent } from 'react';

interface SOSSliderProps {
  onActivate: () => void;
}

const SOSSlider: React.FC<SOSSliderProps> = ({ onActivate }) => {
  const [thumbPosition, setThumbPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);

  const handleDragStart = (clientX: number) => {
    if (!sliderRef.current) return;
    setIsDragging(true);
    const thumbRect = thumbRef.current?.getBoundingClientRect();
    startXRef.current = clientX - (thumbRect?.left || 0);
  };

  const handleDragMove = (clientX: number) => {
    if (!isDragging || !sliderRef.current) return;
    const sliderRect = sliderRef.current.getBoundingClientRect();
    const newX = clientX - sliderRect.left - startXRef.current;
    const endPosition = sliderRect.width - (thumbRef.current?.clientWidth || 0);
    const clampedX = Math.max(0, Math.min(newX, endPosition));
    setThumbPosition(clampedX);
  };

  const handleDragEnd = () => {
    if (!isDragging || !sliderRef.current || !thumbRef.current) return;
    setIsDragging(false);

    const sliderWidth = sliderRef.current.clientWidth;
    const thumbWidth = thumbRef.current.clientWidth;
    const activationThreshold = sliderWidth * 0.8;

    if (thumbPosition + thumbWidth > activationThreshold) {
      onActivate();
    }

    setThumbPosition(0);
  };

  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => handleDragStart(e.clientX);
  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isDragging) handleDragMove(e.clientX);
  };
  const onMouseUp = () => {
    if (isDragging) handleDragEnd();
  };
  const onMouseLeave = () => {
    if (isDragging) handleDragEnd();
  };

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => handleDragStart(e.touches[0].clientX);
  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (isDragging) handleDragMove(e.touches[0].clientX);
  };
  const onTouchEnd = () => {
    if (isDragging) handleDragEnd();
  };

  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[388px] z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onTouchMove={onTouchMove}
    >
      <div
        ref={sliderRef}
        className="relative w-full h-16 rounded-[28px] flex items-center p-1.5 overflow-hidden"
        style={{
          background: 'rgba(224, 122, 122, 0.12)',
          border: '1px solid rgba(224, 122, 122, 0.25)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div
          ref={thumbRef}
          className="absolute h-[52px] w-[52px] rounded-full flex items-center justify-center cursor-pointer select-none z-10"
          style={{
            background: 'linear-gradient(135deg, #E07A7A, #C87070)',
            boxShadow: '0 4px 20px rgba(224, 122, 122, 0.35)',
            transform: `translateX(${thumbPosition}px)`,
            transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <div
          className="flex-grow text-center font-body text-[13px] font-medium pointer-events-none"
          style={{
            color: '#E07A7A',
            letterSpacing: '1.5px',
            paddingLeft: '52px',
            animation: 'textPulse 2.5s ease-in-out infinite',
          }}
        >
          SLIDE FOR SOS
        </div>
      </div>
    </div>
  );
};

export default SOSSlider;
