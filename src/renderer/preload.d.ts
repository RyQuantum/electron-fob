import { Channels } from 'main/preload';
import { Fob } from '../main/db';

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        sendMessage(channel: Channels, args: unknown[]): void;
        on(channel: 'fobs', func: (arg: Fob[]) => void): void;
        on(channel: 'fob', func: (arg: Fob) => void): void;
        on(channel: 'card', func: (arg: string) => void): void;
        on(
          channel: string,
          func: (...args: unknown[]) => void
        ): (() => void) | undefined;
        once(channel: 'start', func: (arg: number) => void): void;
        once(channel: string, func: (...args: unknown[]) => void): void;
      };
    };
  }
}

export {};
