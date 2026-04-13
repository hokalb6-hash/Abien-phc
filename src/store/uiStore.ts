import { create } from 'zustand'

/** حالة واجهة عامة (الشريط الجانبي وغيره) */
interface UiState {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

export const useUiStore = create<UiState>((set) => ({
  /** على الهاتف يبدأ مغلقاً حتى لا يضيق عمود المحتوى بجانب القائمة */
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}))
