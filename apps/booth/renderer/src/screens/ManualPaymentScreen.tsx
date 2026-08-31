import React from 'react';
import { useSessionStore } from '../store/sessionStore';

export const ManualPaymentScreen: React.FC = () => {
  const confirmPayment = useSessionStore((state) => state.confirmPayment);

  return (
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center overflow-hidden px-2 py-4 select-none sm:px-4">
      <div className="w-full max-w-[1220px] rounded-[16px] border-[4px] border-[#ff4bb5] bg-[#ff4bb5] p-2 shadow-[0_0_0_4px_rgba(255,255,255,0.08)] sm:p-3 md:p-5">
        <div className="overflow-hidden rounded-[14px] bg-[#ff4bb5]">
          <div className="grid gap-3 bg-[#ff4bb5] p-2 md:grid-cols-[1.1fr_1.45fr] md:p-4">
            <div className="space-y-3">
              <div className="rounded-[12px] border-[4px] border-[#a35ef6] bg-[#a35ef6] p-2">
                <div className="relative overflow-hidden rounded-[8px] bg-[#9fe8fd] p-3">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_30%)]" />
                  <div className="relative flex h-[160px] items-end justify-center gap-3 sm:h-[180px] md:h-[210px]">
                    <div className="h-14 w-14 rounded-full bg-[#f6dfe8] sm:h-16 sm:w-16" />
                    <div className="h-[4.5rem] w-[4.5rem] rounded-full bg-[#c8d8ff] sm:h-20 sm:w-20" />
                    <div className="h-20 w-20 rounded-full bg-[#f9fbff] sm:h-24 sm:w-24" />
                  </div>
                </div>
              </div>

              <div className="rounded-[12px] border-[4px] border-[#a35ef6] bg-[#a35ef6] p-2">
                <div className="relative overflow-hidden rounded-[8px] bg-[#93ddff] p-3">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,0.45),transparent_25%)]" />
                  <div className="relative flex h-[160px] items-center justify-center sm:h-[180px] md:h-[210px]">
                    <div className="h-20 w-20 rounded-full bg-[#fec1d0] sm:h-24 sm:w-24" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-[12px] border-[4px] border-[#a35ef6] bg-[#ff4bb5] p-3 sm:p-4 md:p-6">
              <div className="mb-3 flex flex-col gap-2 rounded-[10px] bg-[#ff7d57] px-3 py-3 text-[#fff6ff] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.12)] sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] sm:text-[10px]">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#ffec5a] text-[#4f3494] sm:h-8 sm:w-8">✦</span>
                  <span className="leading-tight">Birthday Photostrip</span>
                </div>
                <div className="hidden items-center gap-3 text-[9px] font-black uppercase tracking-[0.08em] sm:flex md:gap-6 md:text-[11px]">
                  <span>Home</span>
                  <span>About</span>
                  <span>Info</span>
                  <span>Contact</span>
                </div>
              </div>

              <div className="rounded-[12px] bg-[#ff7d57] px-3 py-4 text-[#fffefb] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.08)] sm:px-4 sm:py-5 md:px-6 md:py-7">
                <h1 className="text-start text-[1.5rem] font-black leading-[1] tracking-[-0.08em] sm:text-[2.2rem] md:text-[3.2rem]">
               <span className="text-[#d9f85a] text-[4rem]">Amelia</span>   is turning <span className="text-[#d9f85a] text-[4rem]">24 </span>
                  Happy Birthday Yaaa Ubil!
                </h1>
              </div>

              <div className="mt-4 rounded-[12px] bg-[#4acaf1] px-3 py-3 text-center text-[0.7rem] font-black uppercase tracking-[0.14em] text-[#3f3392] sm:text-[0.82rem] md:px-6 md:text-[1rem]">
                Exclusively crafted for <span className="text-[#ff7d57]">Amelia</span> by <span className="text-[#ff7d57] lowercase">@aldryansyahp</span>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-[12px] bg-[#2db3d0] p-3 text-[#2d2b66] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.08)] sm:p-4">
                <p className="text-[0.68rem] leading-relaxed text-[#1f2f66] sm:text-[0.76rem] md:text-[0.88rem]">
                  Lorem Ipsum is simply dummy text of the typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book.
                </p>
                <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-[0.72rem] font-bold text-[#1f2f66] sm:text-[0.8rem]">
                    <span className="text-base">f</span>
                    <span className="text-base">◎</span>
                    <span className="text-base">x</span>
                    <span className="text-base">◌</span>
                    <span className="ml-2 font-black">@themecolate</span>
                  </div>

                  <button
                    onClick={confirmPayment}
                    className="rounded-[10px] bg-[#ff7d57] px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.12em] text-white shadow-[0_4px_0_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 active:translate-y-0 sm:px-5 sm:text-[0.8rem]"
                  >
                    Lanjut Yuk
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ManualPaymentScreen;
