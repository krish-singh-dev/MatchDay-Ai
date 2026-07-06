import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

export interface DashboardZone {
  id: string;
  venueId: string;
  name: string;
  zoneType: string;
  maxCapacity: number;
  geoCoordinates: any;
  estimatedCount: number;
  densityPct: number;
  recordedAt: string | null;
}

export interface DashboardAlert {
  id: string;
  zoneId: string;
  severity: 'info' | 'warning' | 'critical';
  aiRecommendation: string;
  acknowledgedBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
  zone?: {
    name: string;
  };
}

interface DashboardState {
  zones: DashboardZone[];
  activeAlerts: DashboardAlert[];
  aiRecommendation: string | null;
  announcements: string[];
  isLoading: boolean;
  error: string | null;
  socket: Socket | null;
  
  fetchDashboardData: (venueId: string, token: string) => Promise<void>;
  acknowledgeAlert: (alertId: string, token: string) => Promise<void>;
  resolveAlert: (alertId: string, token: string) => Promise<void>;
  fetchRecommendation: (alertId: string, token: string) => Promise<void>;
  connectSocket: () => void;
  disconnectSocket: () => void;
  addAnnouncement: (text: string) => void;
  clearRecommendation: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api/v1` 
  : 'http://localhost:5000/api/v1';

const SOCKET_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const useDashboardStore = create<DashboardState>((set, get) => ({
  zones: [],
  activeAlerts: [],
  aiRecommendation: null,
  announcements: [],
  isLoading: false,
  error: null,
  socket: null,

  fetchDashboardData: async (venueId, token) => {
    set({ isLoading: true, error: null });
    try {
      // Fetch zones
      const zonesRes = await fetch(`${API_BASE_URL}/zones/${venueId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!zonesRes.ok) throw new Error('Failed to fetch zones data.');
      const zonesData = await zonesRes.json();

      // Fetch active alerts
      const alertsRes = await fetch(`${API_BASE_URL}/alerts/active/${venueId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!alertsRes.ok) throw new Error('Failed to fetch active alerts.');
      const alertsData = await alertsRes.json();

      set({ zones: zonesData, activeAlerts: alertsData, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load dashboard data.', isLoading: false });
    }
  },

  acknowledgeAlert: async (alertId, token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to acknowledge alert.');
      const updatedAlert = await res.json();

      set((state) => ({
        activeAlerts: state.activeAlerts.map((a) => (a.id === alertId ? updatedAlert : a)),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  resolveAlert: async (alertId, token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to resolve alert.');
      // The socket event alert:resolved will remove the alert from the state,
      // but we optimistically update it here to make interactions responsive.
      set((state) => ({
        activeAlerts: state.activeAlerts.filter((a) => a.id !== alertId),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchRecommendation: async (alertId, token) => {
    set({ isLoading: true, aiRecommendation: null });
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/${alertId}/recommendation`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to retrieve AI recommendations.');
      const data = await res.json();
      set({ aiRecommendation: data.recommendation, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  connectSocket: () => {
    const existingSocket = get().socket;
    if (existingSocket) return;

    const socket = io(SOCKET_BASE_URL);

    socket.on('connect', () => {
      console.log('Socket.IO dashboard connection established');
    });

    socket.on('density:update', (reading) => {
      set((state) => {
        // Find if reading's zone belongs to this venue
        const zones = state.zones.map((z) => {
          if (z.id === reading.zoneId) {
            const updated = {
              ...z,
              estimatedCount: reading.estimatedCount,
              densityPct: reading.densityPct,
              recordedAt: reading.recordedAt,
            };
            // Add announcement for live updates
            const pct = Math.round(reading.densityPct * 100);
            state.addAnnouncement(`Zone "${z.name}" capacity updated to ${pct}%.`);
            return updated;
          }
          return z;
        });
        return { zones };
      });
    });

    socket.on('alert:new', (alert: DashboardAlert) => {
      set((state) => {
        // Add to active alerts list if not present
        const exists = state.activeAlerts.some((a) => a.id === alert.id);
        const activeAlerts = exists
          ? state.activeAlerts.map((a) => (a.id === alert.id ? alert : a))
          : [alert, ...state.activeAlerts];

        const zoneName = alert.zone?.name || 'unknown zone';
        state.addAnnouncement(`ALERT TRIGGERED: ${alert.severity.toUpperCase()} level warning at ${zoneName}.`);
        return { activeAlerts };
      });
    });

    socket.on('alert:resolved', (alert: DashboardAlert) => {
      set((state) => {
        const activeAlerts = state.activeAlerts.filter((a) => a.id !== alert.id);
        const zoneName = alert.zone?.name || 'zone';
        state.addAnnouncement(`Alert resolved for ${zoneName}.`);
        return { activeAlerts };
      });
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },

  addAnnouncement: (text) => {
    set((state) => ({
      announcements: [text, ...state.announcements.slice(0, 19)], // Limit to last 20
    }));
  },

  clearRecommendation: () => set({ aiRecommendation: null }),
}));
