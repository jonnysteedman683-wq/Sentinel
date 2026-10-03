import { vi } from 'vitest'

export const useRegisterSW = () => ({
  needRefresh: [false, vi.fn()],
  offlineReady: [false, vi.fn()],
  updateServiceWorker: vi.fn(),
})
