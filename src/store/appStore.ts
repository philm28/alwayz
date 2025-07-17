import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface AppState {
  // UI State
  currentView: string;
  isLoading: boolean;
  error: string | null;
  
  // User State
  user: any | null;
  subscription: any | null;
  usage: any | null;
  
  // Persona State
  selectedPersona: any | null;
  personas: any[];
  
  // Call State
  activeCall: any | null;
  callHistory: any[];
  
  // Actions
  setCurrentView: (view: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setUser: (user: any | null) => void;
  setSubscription: (subscription: any | null) => void;
  setUsage: (usage: any | null) => void;
  setSelectedPersona: (persona: any | null) => void;
  setPersonas: (personas: any[]) => void;
  addPersona: (persona: any) => void;
  updatePersona: (id: string, updates: any) => void;
  removePersona: (id: string) => void;
  setActiveCall: (call: any | null) => void;
  addToCallHistory: (call: any) => void;
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    currentView: 'landing',
    isLoading: false,
    error: null,
    user: null,
    subscription: null,
    usage: null,
    selectedPersona: null,
    personas: [],
    activeCall: null,
    callHistory: [],

    // Actions
    setCurrentView: (view) => set({ currentView: view }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
    setUser: (user) => set({ user }),
    setSubscription: (subscription) => set({ subscription }),
    setUsage: (usage) => set({ usage }),
    setSelectedPersona: (persona) => set({ selectedPersona: persona }),
    setPersonas: (personas) => set({ personas }),
    addPersona: (persona) => set((state) => ({ personas: [persona, ...state.personas] })),
    updatePersona: (id, updates) => set((state) => ({
      personas: state.personas.map(p => p.id === id ? { ...p, ...updates } : p)
    })),
    removePersona: (id) => set((state) => ({
      personas: state.personas.filter(p => p.id !== id)
    })),
    setActiveCall: (call) => set({ activeCall: call }),
    addToCallHistory: (call) => set((state) => ({
      callHistory: [call, ...state.callHistory]
    }))
  }))
);

// Selectors
export const useCurrentView = () => useAppStore((state) => state.currentView);
export const useUser = () => useAppStore((state) => state.user);
export const usePersonas = () => useAppStore((state) => state.personas);
export const useSelectedPersona = () => useAppStore((state) => state.selectedPersona);
export const useActiveCall = () => useAppStore((state) => state.activeCall);