/// <reference types="vite/client" />

declare module "*.css" {
  const content: string;
  export default content;
}

declare module 'virtual:pwa-register/react' {
  import type { Dispatch, SetStateAction } from 'react'
  export type RegisterSWOptions = {
    onRegisteredSW?: (url: string, registration: ServiceWorkerRegistration | undefined) => void
    onRegisterError?: (error: unknown) => void
  }
  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: [boolean, Dispatch<SetStateAction<boolean>>]
    offlineReady: [boolean, Dispatch<SetStateAction<boolean>>]
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>
  }
}
