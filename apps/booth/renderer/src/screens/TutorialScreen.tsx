import React from 'react';
import { useSessionStore } from '../store/sessionStore';

export const TutorialScreen: React.FC = () => {
  const setScreen = useSessionStore((state) => state.setScreen);

  return (
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center select-none">
      <div className="w-full max-w-[1180px] rounded-[18px] border-[4px] border-[#ff4bb5] bg-[#ff4bb5] p-4 shadow-[0_0_0_6px_rgba(255,255,255,0.08)] md:p-6">
        <div className="rounded-[14px] bg-[#ff4bb5] p-3 md:p-5">
          <div className="mb-6 text-center">
            <p className="text-[0.9rem] font-black uppercase tracking-[0.28em] text-[#4f3591]">Panduan</p>
            <h1 className="mt-3 text-[2.2rem] font-black uppercase tracking-[-0.08em] text-[#4f3591] md:text-[4rem]">
              How it works
            </h1>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              { step: '01', title: 'Pilih Gaya', body: 'Pilih tata letak dan bingkai yang paling cocok dengan moodmu.', accent: 'bg-[#ff7d57]' },
              { step: '02', title: 'Pose Santai', body: 'Ambil 3 foto dengan hitungan mundur dan retake sampai hasilnya pas.', accent: 'bg-[#4dcaf1]' },
              { step: '03', title: 'Cetak & Simpan', body: 'Lihat hasil akhir, pilih filter, dan bagikan momen lewat QR.', accent: 'bg-[#8fe56d]' },
            ].map((card) => (
              <div key={card.step} className="rounded-[16px] border-[4px] border-[#a35ef6] bg-[#fdf3ff] p-4 text-[#3b2a7a] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.2)]">
                <div className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full ${card.accent} text-xl font-black text-white`}>
                  {card.step}
                </div>
                <h3 className="text-[1.5rem] font-black uppercase tracking-[-0.05em]">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#43376f]">{card.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setScreen('SELECT_LAYOUT')}
              className="rounded-[12px] bg-[#ff7d57] px-8 py-4 text-[0.9rem] font-black uppercase tracking-[0.18em] text-white shadow-[0_5px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Ayo mulai
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default TutorialScreen;
