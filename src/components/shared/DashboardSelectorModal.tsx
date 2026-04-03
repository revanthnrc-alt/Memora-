import React from 'react';
import { ViewMode } from '../../types';
import { useAppContext } from '../../context/AppContext';

const DashboardSelectorModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { dispatch } = useAppContext();

  const choose = (v: ViewMode) => {
    dispatch({ type: 'SET_VIEW_MODE', payload: v });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 border border-[rgba(255,255,255,0.06)]">
        <h2 className="font-display text-xl font-semibold text-[#F5F0E8] mb-2">Choose Dashboard</h2>
        <p className="text-sm text-[#A8A0B4] mb-5">Select which dashboard you'd like this device to open for the demo.</p>
        <div className="space-y-3">
          <button onClick={() => choose(ViewMode.PATIENT)} className="w-full px-5 py-4 bg-gradient-to-br from-[#B8A9C9] to-[#9D8AA5] text-white font-medium rounded-xl touch-feedback">
            Patient
          </button>
          <button onClick={() => choose(ViewMode.CAREGIVER)} className="w-full px-5 py-4 bg-gradient-to-br from-[#E8C4A0] to-[#C9B896] text-white font-medium rounded-xl touch-feedback">
            Caregiver
          </button>
          <button onClick={() => choose(ViewMode.FAMILY)} className="w-full px-5 py-4 bg-gradient-to-br from-[#D4A5A5] to-[#B8A9C9] text-white font-medium rounded-xl touch-feedback">
            Family
          </button>
        </div>
        <div className="mt-5 text-right">
          <button onClick={onClose} className="text-sm text-[#7A7582] hover:text-[#A8A0B4] transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default DashboardSelectorModal;
