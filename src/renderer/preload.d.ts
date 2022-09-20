import { Channels } from 'main/preload';
import { Fob } from '../main/db';

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        sendMessage(channel: Channels, args: unknown[]): void;
        on(channel: 'fobs', func: (fobs: Fob[]) => void): void;
        on(channel: 'fob', func: (fob: Fob) => void): void;
        on(channel: 'card', func: (fobNumber: string) => void): void;
        on(
          channel: 'found',
          func: (id: number, sequence?: number) => void
        ): void;
        on(channel: 'uploadAll', func: (enabled: boolean) => void): void;
        on(
          channel: string,
          func: (...args: unknown[]) => void
        ): (() => void) | undefined;
        once(
          channel: 'login',
          func: (res: { success: boolean; message: string }) => void
        ): void;
        once(channel: 'init', func: (arg: boolean) => void): void;
        once(channel: 'verify', func: (arg: boolean) => void): void;
        once(channel: string, func: (...args: unknown[]) => void): void;
      };
    };
  }
}

export {};
