/// <reference types="vite/client" />

export interface IElectronAPI {
  ping: () => Promise<string>;
  printToPDF: () => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
