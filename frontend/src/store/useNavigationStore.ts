import { create } from 'zustand';

export interface ZoneNode {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface CalculatedRoute {
  path: string[];
  directions: string[];
  coordinates: { x: number; y: number }[];
}

interface NavigationState {
  zones: ZoneNode[];
  startZoneId: string;
  endZoneId: string;
  route: CalculatedRoute | null;
  isLoading: boolean;
  error: string | null;
  setStartZoneId: (id: string) => void;
  setEndZoneId: (id: string) => void;
  fetchZones: () => Promise<void>;
  calculateRoute: () => Promise<void>;
  clearRoute: () => void;
}

const API_BASE_URL = 'http://localhost:5000/api/v1';

export const useNavigationStore = create<NavigationState>((set, get) => ({
  zones: [],
  startZoneId: '',
  endZoneId: '',
  route: null,
  isLoading: false,
  error: null,

  setStartZoneId: (id) => set({ startZoneId: id }),
  setEndZoneId: (id) => set({ endZoneId: id }),

  fetchZones: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/navigation/zones`);
      if (!response.ok) throw new Error('Failed to fetch stadium zones.');
      const data = await response.json();
      set({ zones: data, error: null });
    } catch (err: any) {
      set({ error: err.message || 'Could not load zones.' });
    }
  },

  calculateRoute: async () => {
    const { startZoneId, endZoneId } = get();
    if (!startZoneId || !endZoneId) return;

    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/navigation/route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ startZoneId, endZoneId }),
      });

      if (!response.ok) {
        throw new Error('Could not calculate a route. Please try another pair.');
      }

      const data = await response.json();
      set({ route: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Routing failed.', isLoading: false });
    }
  },

  clearRoute: () => set({ route: null, startZoneId: '', endZoneId: '', error: null }),
}));
