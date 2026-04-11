declare global {
  interface Window {
    __CONFIG__?: {
      SERVER_URL?: string;
    };
  }
}

export const SERVER_URL: string = window.__CONFIG__?.SERVER_URL ?? '';
