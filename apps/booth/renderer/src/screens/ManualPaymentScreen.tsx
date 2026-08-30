import React from 'react';
import { useSessionStore } from '../store/sessionStore';

export const ManualPaymentScreen: React.FC = () => {
  const confirmPayment = useSessionStore((state) => state.confirmPayment);

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto px-6 text-center select-none">
      <div className="mb-8">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-zinc-800 text-emerald-400 mb-6 border border-emerald-500/20">
          <span className="text-4xl font-semibold">$</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">Welcome to Photo Booth</h1>
        <p className="text-zinc-400 text-lg leading-relaxed">
          Get ready to create a photo memory that is uniquely yours.
        </p>
      </div>

      <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8 text-left">
        <h3 className="font-semibold text-zinc-300 mb-2">Before you begin:</h3>
        <ul className="text-zinc-400 space-y-2 text-sm">
          <li>• Choose a layout and frame.</li>
          <li>• Pose for each photo during the countdown.</li>
          <li>• Add a filter and review your final result.</li>
        </ul>
      </div>

      <button
        onClick={confirmPayment}
        className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold rounded-2xl text-lg shadow-lg hover:shadow-emerald-500/10 active:scale-[0.98] transition-all"
      >
        Start
      </button>
    </div>
  );
};
export default ManualPaymentScreen;
