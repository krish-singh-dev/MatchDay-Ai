import { render, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';
import App from '../src/App';
import { useDashboardStore } from '../src/store/useDashboardStore';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Clear store state between tests
beforeEach(() => {
  useDashboardStore.getState().clearRecommendation();
  vi.restoreAllMocks();
});

describe('Staff Operations Dashboard', () => {
  it('loads active alerts list and triggers the recommendation modal dialog on click', async () => {
    const mockZones = [
      {
        id: 'zone-1',
        venueId: 'venue-fifa-2026',
        name: 'Gate B Transit',
        zoneType: 'transit',
        maxCapacity: 1000,
        geoCoordinates: {},
        estimatedCount: 950,
        densityPct: 0.95,
        recordedAt: new Date().toISOString(),
      },
    ];

    const mockAlerts = [
      {
        id: 'alert-1',
        zoneId: 'zone-1',
        severity: 'critical',
        aiRecommendation: 'Mitigation recommendation analysis pending.',
        acknowledgedBy: null,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        zone: {
          name: 'Gate B Transit',
        },
      },
    ];

    const mockRecResponse = {
      alertId: 'alert-1',
      recommendation: 'RE-ROUTE: Direct fans from Gate B to Gate A immediately.',
    };

    // Mock global fetch for dashboard endpoints
    const mockFetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/auth/login')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ token: 'mock-staff-token' }),
        });
      }
      if (url.includes('/zones/')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockZones,
        });
      }
      if (url.includes('/alerts/active/')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockAlerts,
        });
      }
      if (url.includes('/alerts/alert-1/acknowledge')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ...mockAlerts[0], acknowledgedBy: 'mock-staff-id' }),
        });
      }
      if (url.includes('/alerts/alert-1/recommendation')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockRecResponse,
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
    vi.stubGlobal('fetch', mockFetch);

    const { getByRole, getByText, queryByText, container } = render(<App />);

    // Wait for login and dashboard fetch on mount
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/zones/venue-fifa-2026'), expect.any(Object));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/alerts/active/venue-fifa-2026'), expect.any(Object));
    });

    // Verify dashboard metrics are rendered
    expect(getByText('Gate B Transit')).toBeInTheDocument();
    expect(getByText(/Critical \(95%\)/i)).toBeInTheDocument();
    expect(getByText('Crowd spike at Gate B Transit. Capacity limits exceeded.')).toBeInTheDocument();

    // Verify Acknowledge button is active and can be clicked
    const ackButton = getByRole('button', { name: /Acknowledge/i });
    fireEvent.click(ackButton);

    // Wait for acknowledgment status update
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/alerts/alert-1/acknowledge'), expect.any(Object));
    });

    // Click "View AI mitigation recommendation" to load recommendations
    const recButton = getByRole('button', { name: /View AI mitigation recommendation/i });
    fireEvent.click(recButton);

    // Verify modal heading displays during load
    expect(getByRole('dialog', { name: /AI Mitigation Recommendation/i })).toBeInTheDocument();

    // Wait for recommendation text to load
    await waitFor(() => {
      expect(getByText('RE-ROUTE: Direct fans from Gate B to Gate A immediately.')).toBeInTheDocument();
    });

    // Run axe accessibility validation on the opened modal dialog
    const modalResults = await axe(container);
    expect(modalResults).toHaveNoViolations();

    // Close the modal
    const closeButton = getByRole('button', { name: /Close recommendation modal/i });
    fireEvent.click(closeButton);

    // Verify modal is closed
    expect(queryByText('RE-ROUTE: Direct fans from Gate B to Gate A immediately.')).not.toBeInTheDocument();
  });
});
