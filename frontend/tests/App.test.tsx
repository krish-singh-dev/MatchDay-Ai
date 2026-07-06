import { render, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';
import App from '../src/App';
import { useChatStore } from '../src/store/useChatStore';
import { useNavigationStore } from '../src/store/useNavigationStore';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Clear stores before each test
beforeEach(() => {
  useChatStore.getState().clearChat();
  useNavigationStore.getState().clearRoute();
  vi.restoreAllMocks();
});

describe('App component', () => {
  it('renders header text and welcome instruction', () => {
    const { getByRole, getByText } = render(<App />);
    expect(getByRole('heading', { level: 1 })).toHaveTextContent(/MatchDay/i);
    expect(getByText(/Ask a question to start the conversation/i)).toBeInTheDocument();
  });

  it('submits a query and displays the response and language headers', async () => {
    // Mock global fetch for chat
    const mockResponseData = {
      id: 'msg-response-123',
      responseText: 'Gate B is on the right side of the main hall.',
      detectedLanguage: 'es',
      createdAt: new Date().toISOString(),
      wasCached: false,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponseData,
    });
    vi.stubGlobal('fetch', mockFetch);

    const { getByLabelText, getByRole, getByText, queryByText } = render(<App />);

    const input = getByLabelText(/Ask a wayfinding question/i);
    const sendButton = getByRole('button', { name: /Send/i });

    fireEvent.change(input, { target: { value: '¿Dónde está la Puerta B?' } });
    fireEvent.click(sendButton);

    expect(input).toHaveValue('');
    expect(getByText(/Thinking.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(getByText('Gate B is on the right side of the main hall.')).toBeInTheDocument();
    });

    expect(queryByText(/Thinking.../i)).not.toBeInTheDocument();
    expect(getByText(/Detected Source: ES \| Response: EN/i)).toBeInTheDocument();
  });

  it('allows map tab navigation, displays zones, and calculates routes', async () => {
    // Mock list of zones and calculated route
    const mockZones = [
      { id: 'gate-a', name: 'Gate A Concourse', x: 100, y: 150 },
      { id: 'gate-b', name: 'Gate B Transit', x: 300, y: 150 },
      { id: 'restrooms', name: 'Concourse Restrooms', x: 80, y: 280 },
    ];

    const mockRoute = {
      path: ['gate-a', 'restrooms'],
      directions: ['Turn right at the signpost and walk 50m to the restrooms.'],
      coordinates: [{ x: 100, y: 150 }, { x: 80, y: 280 }],
    };

    const mockFetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/navigation/zones')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockZones,
        });
      }
      if (url.includes('/navigation/route')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockRoute,
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
    vi.stubGlobal('fetch', mockFetch);

    const { getByLabelText, getByRole, getByText } = render(<App />);

    // Wait for initial zones fetch on mount
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/navigation/zones'));
    });

    // Switch to Map Directions tab
    const mapTabButton = getByRole('button', { name: /Wayfinding Map/i });
    fireEvent.click(mapTabButton);

    // Verify map content loaded
    expect(getByText(/Select your current location and desired destination/i)).toBeInTheDocument();

    // Select start and end location dropdowns
    const startSelect = getByLabelText(/START LOCATION/i);
    const endSelect = getByLabelText(/DESTINATION/i);

    fireEvent.change(startSelect, { target: { value: 'gate-a' } });
    fireEvent.change(endSelect, { target: { value: 'restrooms' } });

    // Submit route calculation
    const calcButton = getByRole('button', { name: /Calculate Route/i });
    fireEvent.click(calcButton);

    // Wait for route and directions to load
    await waitFor(() => {
      expect(getByText(/Directions Guide/i)).toBeInTheDocument();
      expect(getByText('Turn right at the signpost and walk 50m to the restrooms.')).toBeInTheDocument();
    });

    // Verify map is rendered
    expect(getByRole('img', { name: /Stadium Floor Plan and Wayfinding Map/i })).toBeInTheDocument();
  });

  it('has no accessibility violations in loaded state', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal('fetch', mockFetch);

    const { container } = render(<App />);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
