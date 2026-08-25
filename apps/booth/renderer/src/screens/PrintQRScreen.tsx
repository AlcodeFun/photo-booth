import React, { useEffect } from 'react';
import { useSessionStore } from '../store/sessionStore';

export const PrintQRScreen: React.FC = () => {
  const { printStatus, uploadStatus, completeSession } = useSessionStore((state) => ({
    printStatus: state.printStatus,
    uploadStatus: state.uploadStatus,
    completeSession: state.completeSession,
  }));

  const isDone = printStatus === 'SUCCESS' && uploadStatus === 'SUCCESS';

  return (
    <div className="flex flex-col items-center justify-between h-full max-w-xl mx-auto px-6 py-10 select-none">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Delivering Your Memories</h1>
        <p className="text-zinc-400">Please wait while your physical and digital copies are prepared</p>
      </div>

      <div className="w-full flex flex-col items-center gap-6 my-6 flex-grow justify-center">
        {/* Status Indicators */}
        <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 max-w-md">
          {/* Printer State */}
          <div className="flex items-center justify-between">
            <span className="font-medium text-zinc-300">Physical Print:</span>
            <span
              className={`text-sm font-semibold ${
                printStatus === 'PRINTING'
                  ? 'text-amber-400 animate-pulse'
                  : printStatus === 'SUCCESS'
                    ? 'text-emerald-400'
                    : 'text-zinc-500'
              }`}
            >
              {printStatus === 'PRINTING' && '🖨️ Printing...'}
              {printStatus === 'SUCCESS' && '✅ Completed'}
              {printStatus === 'IDLE' && 'Pending'}
            </span>
          </div>

          {/* Upload State */}
          <div className="flex items-center justify-between">
            <span className="font-medium text-zinc-300">Digital Upload:</span>
            <span
              className={`text-sm font-semibold ${
                uploadStatus === 'UPLOADING'
                  ? 'text-amber-400 animate-pulse'
                  : uploadStatus === 'SUCCESS'
                    ? 'text-emerald-400'
                    : 'text-zinc-500'
              }`}
            >
              {uploadStatus === 'UPLOADING' && '☁️ Uploading...'}
              {uploadStatus === 'SUCCESS' && '✅ Uploaded'}
              {uploadStatus === 'IDLE' && 'Pending'}
            </span>
          </div>
        </div>

        {/* QR Code Placeholder */}
        <div className="flex flex-col items-center justify-center p-6 bg-white border border-zinc-200 rounded-3xl w-48 h-48 shadow-xl relative mt-4">
          {uploadStatus === 'SUCCESS' ? (
            <>
              {/* Simple mock QR code grid lines */}
              <div className="w-36 h-36 border-4 border-black p-2 flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="w-10 h-10 border-4 border-black bg-black"></div>
                  <div className="w-10 h-10 border-4 border-black bg-black"></div>
                </div>
                <div className="w-full h-8 flex justify-center items-center font-mono text-[9px] font-black text-black">
                  [ SCAN ME ]
                </div>
                <div className="flex justify-between items-end">
                  <div className="w-10 h-10 border-4 border-black bg-black"></div>
                  <div className="w-6 h-6 bg-black"></div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center text-zinc-500 text-xs">
              <span className="animate-spin text-xl">⏳</span>
              Generating QR...
            </div>
          )}
        </div>
        
        {uploadStatus === 'SUCCESS' && (
          <span className="text-zinc-400 text-sm mt-2">Scan the QR code to download your framed photo strip and GIF!</span>
        )}
      </div>

      <button
        onClick={completeSession}
        disabled={!isDone}
        className={`w-full max-w-md py-4 font-bold rounded-2xl text-lg shadow-lg active:scale-[0.98] transition-all tracking-wider ${
          isDone
            ? 'bg-emerald-500 hover:bg-emerald-600 text-black cursor-pointer'
            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
        }`}
      >
        Finish Session
      </button>
    </div>
  );
};
export default PrintQRScreen;
