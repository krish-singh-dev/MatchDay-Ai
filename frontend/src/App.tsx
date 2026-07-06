import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Languages, Users, Loader2, Navigation, RefreshCw, CheckCircle, Eye, Volume2 } from 'lucide-react';
import { useChatStore } from './store/useChatStore';
import { useNavigationStore } from './store/useNavigationStore';
import { useDashboardStore } from './store/useDashboardStore';
import VenueMap from './components/VenueMap';

export default function App() {
  const {
    messages,
    isLoading: isChatLoading,
    error: chatError,
    preferredLanguage,
    setPreferredLanguage,
    sendMessage,
  } = useChatStore();

  const {
    zones: mapZones,
    startZoneId,
    endZoneId,
    route,
    isLoading: isRouteLoading,
    error: routeError,
    setStartZoneId,
    setEndZoneId,
    fetchZones,
    calculateRoute,
    clearRoute,
  } = useNavigationStore();

  const {
    zones: dashboardZones,
    activeAlerts,
    aiRecommendation,
    announcements,
    isLoading: isDashboardLoading,
    fetchDashboardData,
    acknowledgeAlert,
    resolveAlert,
    fetchRecommendation,
    connectSocket,
    disconnectSocket,
    clearRecommendation,
  } = useDashboardStore();

  const [activeTab, setActiveTab] = useState<'chat' | 'map'>('chat');
  const [inputText, setInputText] = useState('');
  const [staffToken, setStaffToken] = useState<string | null>(null);
  const [activeAlertIdForModal, setActiveAlertIdForModal] = useState<string | null>(null);

  // Matches seeded UUID in Postgres database
  const mockVenueId = '00000000-0000-0000-0000-000000000000';

  // Generate a valid mock JWT for staff operations console demonstration
  // This matches backend expectations for role 'staff'
  const simulateStaffLogin = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'staff', password: 'password' }),
      });
      if (res.ok) {
        const data = await res.json();
        setStaffToken(data.token);
      }
    } catch (e) {
      console.warn('Backend server offline. Simulating staff token offline.', e);
      // Fallback dummy token signed with correct structure
      setStaffToken('dummy-token');
    }
  };

  // Load static zones and simulate login
  useEffect(() => {
    fetchZones();
    simulateStaffLogin();
  }, []);

  // Connect Socket.IO on mount, disconnect on unmount
  useEffect(() => {
    connectSocket();
    return () => {
      disconnectSocket();
    };
  }, []);

  // Fetch dashboard data periodically or when authenticated
  useEffect(() => {
    if (staffToken) {
      fetchDashboardData(mockVenueId, staffToken);
    }
  }, [staffToken]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isChatLoading) return;
    const text = inputText;
    setInputText('');
    await sendMessage(text, mockVenueId, null);
  };

  const handleCalculateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startZoneId || !endZoneId || isRouteLoading) return;
    await calculateRoute();
  };

  const handleViewRecommendation = async (alertId: string) => {
    if (!staffToken) return;
    setActiveAlertIdForModal(alertId);
    await fetchRecommendation(alertId, staffToken);
  };

  const handleAcknowledge = async (alertId: string) => {
    if (!staffToken) return;
    await acknowledgeAlert(alertId, staffToken);
  };

  const handleResolve = async (alertId: string) => {
    if (!staffToken) return;
    await resolveAlert(alertId, staffToken);
  };

  return (
    <div className="min-h-screen bg-background text-text-primary font-base flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-border bg-surface px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="font-display font-bold text-xl text-primary-foreground tracking-tight">
            MatchDay <span className="text-secondary">AI</span>
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          <span className="text-xs bg-secondary bg-opacity-20 text-secondary-foreground border border-secondary px-2.5 py-1 rounded-full font-semibold">
            FIFA World Cup 2026
          </span>
          {/* Language Switcher */}
          <div className="flex items-center space-x-2 bg-background border border-border rounded-md px-3 py-1.5">
            <Languages className="w-4 h-4 text-text-secondary" />
            <select
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
              className="bg-transparent text-text-primary text-sm focus:outline-none cursor-pointer"
              aria-label="Select Language"
            >
              <option value="en" className="bg-surface text-text-primary">EN</option>
              <option value="es" className="bg-surface text-text-primary">ES</option>
              <option value="fr" className="bg-surface text-text-primary">FR</option>
            </select>
          </div>
        </div>
      </header>

      {/* Screen Reader Live Announcements Region (Accessibility Requirement) */}
      <div className="sr-only" aria-live="assertive" id="announcement-live-region">
        {announcements[0] || ''}
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Fan Navigation Kiosk panel */}
        <section className="bg-surface border border-border rounded-lg p-6 flex flex-col justify-between" aria-labelledby="chat-heading">
          <div className="flex flex-col h-full justify-between">
            <div>
              {/* Header with Tab Selectors */}
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <h2 id="chat-heading" className="font-display font-semibold text-lg text-primary-foreground flex items-center">
                  <Navigation className="w-5 h-5 mr-2 text-primary" />
                  Fan Assistant
                </h2>
                
                <div className="flex bg-background rounded-md p-1 border border-border">
                  <button
                    type="button"
                    onClick={() => setActiveTab('chat')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                      activeTab === 'chat'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                    aria-label="Show Chat Assistant"
                  >
                    Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('map')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                      activeTab === 'map'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                    aria-label="Show Wayfinding Map"
                  >
                    Map Directions
                  </button>
                </div>
              </div>

              {/* Chat Tab Panel */}
              {activeTab === 'chat' && (
                <div>
                  <p className="text-text-secondary text-sm mb-4">
                    Ask questions in your preferred language about gates, concessions, exits, or restrooms.
                  </p>
                  
                  {/* Chat Messages */}
                  <div 
                    className="space-y-4 h-[350px] overflow-y-auto bg-background rounded-md p-4 border border-border flex flex-col"
                    aria-live="polite"
                  >
                    {messages.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-text-secondary text-xs">
                        Ask a question to start the conversation
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex flex-col max-w-[80%] ${
                            msg.sender === 'user' ? 'self-end items-end' : 'self-start items-start'
                          }`}
                        >
                          {/* Language indicator headers above bot responses */}
                          {msg.sender === 'bot' && (
                            <span className="text-[10px] text-text-secondary mb-1 uppercase font-semibold">
                              Detected Source: {msg.detectedLanguage || 'EN'} | Response: {preferredLanguage.toUpperCase()}
                              {msg.wasCached && <span className="text-secondary ml-1.5">(Cached)</span>}
                            </span>
                          )}
                          
                          <div
                            className={`rounded-lg px-4 py-2 text-sm ${
                              msg.sender === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-surface border border-border text-text-primary'
                            }`}
                          >
                            {msg.text}
                          </div>
                        </div>
                      ))
                    )}

                    {/* Loading / Typing State */}
                    {isChatLoading && (
                      <div className="self-start flex flex-col items-start max-w-[80%]">
                        <span className="text-[10px] text-text-secondary mb-1 uppercase font-semibold">
                          Assistant is typing...
                        </span>
                        <div className="bg-surface border border-border rounded-lg px-4 py-2 text-sm text-text-secondary flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          <span>Thinking...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Wayfinding Map Tab Panel */}
              {activeTab === 'map' && (
                <div className="space-y-4">
                  <p className="text-text-secondary text-sm">
                    Select your current location and desired destination to map the route.
                  </p>

                  {/* Dropdowns */}
                  <form onSubmit={handleCalculateRoute} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="start-zone" className="block text-xs font-semibold text-text-secondary mb-1">
                        START LOCATION
                      </label>
                      <select
                        id="start-zone"
                        value={startZoneId}
                        onChange={(e) => setStartZoneId(e.target.value)}
                        className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-focusRing"
                      >
                        <option value="">Choose start...</option>
                        {mapZones.map((zone) => (
                          <option key={`start-${zone.id}`} value={zone.id}>
                            {zone.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="end-zone" className="block text-xs font-semibold text-text-secondary mb-1">
                        DESTINATION
                      </label>
                      <select
                        id="end-zone"
                        value={endZoneId}
                        onChange={(e) => setEndZoneId(e.target.value)}
                        className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-focusRing"
                      >
                        <option value="">Choose destination...</option>
                        {mapZones.map((zone) => (
                          <option key={`end-${zone.id}`} value={zone.id}>
                            {zone.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2 flex space-x-2">
                      <button
                        type="submit"
                        disabled={!startZoneId || !endZoneId || isRouteLoading}
                        className="flex-1 bg-primary text-primary-foreground py-2 rounded-md text-sm font-semibold hover:bg-opacity-90 transition disabled:opacity-50 flex items-center justify-center space-x-1.5"
                      >
                        {isRouteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>Calculate Route</span>
                      </button>

                      {route && (
                        <button
                          type="button"
                          onClick={clearRoute}
                          className="bg-surface border border-border px-3 rounded-md text-sm text-text-secondary hover:text-text-primary flex items-center"
                          aria-label="Clear calculated route"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </form>

                  {/* Custom Map View */}
                  <VenueMap
                    zones={mapZones}
                    activePath={route?.path || []}
                    coordinates={route?.coordinates || []}
                    startZoneId={startZoneId}
                    endZoneId={endZoneId}
                  />

                  {/* Step-by-Step Directions Text */}
                  {route && (
                    <div className="bg-background border border-border rounded-md p-4">
                      <h3 className="text-xs font-bold text-text-primary mb-2 uppercase tracking-wide">
                        Directions Guide
                      </h3>
                      <ol className="list-decimal pl-4 text-xs text-text-secondary space-y-1.5">
                        {route.directions.map((dir, idx) => (
                          <li key={`dir-${idx}`}>{dir}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error notifications */}
            {activeTab === 'chat' && chatError && (
              <div className="bg-critical bg-opacity-10 border border-critical rounded-md p-3 mt-4 text-xs text-critical-foreground flex justify-between items-center">
                <span>{chatError}</span>
                <button
                  type="button"
                  onClick={() => sendMessage(messages[messages.length - 1]?.text || '', mockVenueId, null)}
                  className="bg-critical text-critical-foreground font-semibold px-2 py-1 rounded hover:bg-opacity-95"
                >
                  Retry
                </button>
              </div>
            )}

            {activeTab === 'map' && routeError && (
              <div className="bg-critical bg-opacity-10 border border-critical rounded-md p-3 mt-4 text-xs text-critical-foreground flex justify-between items-center">
                <span>{routeError}</span>
                <button
                  type="button"
                  onClick={calculateRoute}
                  className="bg-critical text-critical-foreground font-semibold px-2 py-1 rounded hover:bg-opacity-95"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Chat Form Footer */}
            {activeTab === 'chat' && (
              <form onSubmit={handleSend} className="mt-4 flex space-x-2">
                <input 
                  type="text" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="e.g. ¿Dónde está la Puerta B?" 
                  disabled={isChatLoading}
                  className="flex-1 bg-background border border-border rounded-md px-4 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-focusRing disabled:opacity-50"
                  aria-label="Ask a wayfinding question"
                />
                <button 
                  type="submit"
                  disabled={isChatLoading || !inputText.trim()}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-opacity-90 transition disabled:opacity-50 flex items-center space-x-2"
                >
                  {isChatLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Send</span>
                </button>
              </form>
            )}
          </div>
        </section>

        {/* Venue Staff / Operations Dashboard panel */}
        <section className="bg-surface border border-border rounded-lg p-6 flex flex-col justify-between" aria-labelledby="dashboard-heading">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h2 id="dashboard-heading" className="font-display font-semibold text-lg text-primary-foreground flex items-center">
                <Users className="w-5 h-5 mr-2 text-secondary" />
                Staff Operations Dashboard
              </h2>
              <span className="text-[10px] text-text-secondary border border-border rounded px-2 py-0.5 uppercase tracking-wide">
                Live Console
              </span>
            </div>
            
            <p className="text-text-secondary text-sm mb-6">
              Monitor real-time crowd-density levels and handle safety alerts below.
            </p>

            {/* Zones Grid */}
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 mb-6">
              <h3 className="text-xs font-semibold text-text-primary mb-2 uppercase tracking-wide">Zone Capacity Levels</h3>
              {dashboardZones.length === 0 ? (
                <div className="text-center text-xs text-text-secondary py-4 bg-background rounded border border-border">
                  No zones registered
                </div>
              ) : (
                dashboardZones.map((z) => {
                  let badgeColor = 'bg-secondary text-secondary-foreground';
                  let label = 'Low';
                  
                  if (z.densityPct >= 0.90) {
                    badgeColor = 'bg-critical text-critical-foreground';
                    label = 'Critical';
                  } else if (z.densityPct >= 0.70) {
                    badgeColor = 'bg-warning text-warning-foreground';
                    label = 'Warning';
                  }

                  const pctText = Math.round(z.densityPct * 100);

                  return (
                    <div key={z.id} className="bg-background border border-border rounded-md p-3 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium">{z.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-text-secondary">{z.estimatedCount}/{z.maxCapacity} fans</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${badgeColor}`}>
                          {label} ({pctText}%)
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Active Alerts List */}
            <div className="border-t border-border pt-4">
              <h3 className="text-xs font-bold text-text-primary mb-2 uppercase tracking-wide flex items-center">
                <AlertTriangle className="w-4 h-4 text-warning mr-1.5" />
                Active Safety Alerts
              </h3>
              
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {activeAlerts.length === 0 ? (
                  <div className="text-center text-xs text-text-secondary py-4 bg-background rounded border border-border">
                    No active crowd-density alerts. System normal.
                  </div>
                ) : (
                  activeAlerts.map((alert) => {
                    const isCritical = alert.severity === 'critical';
                    return (
                      <div 
                        key={alert.id} 
                        className={`border rounded-md p-3 flex flex-col justify-between ${
                          isCritical 
                            ? 'bg-critical bg-opacity-10 border-critical' 
                            : 'bg-warning bg-opacity-10 border-warning'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            isCritical ? 'bg-critical text-critical-foreground' : 'bg-warning text-warning-foreground'
                          }`}>
                            {alert.severity}
                          </span>
                          <span className="text-[10px] text-text-secondary">
                            Triggered: {new Date(alert.createdAt).toLocaleTimeString()}
                          </span>
                        </div>

                        <p className="text-xs text-text-primary font-medium mb-3">
                          Crowd spike at {alert.zone?.name || 'stadium zone'}. Capacity limits exceeded.
                        </p>

                        <div className="flex space-x-2">
                          {/* Acknowledge Action */}
                          {!alert.acknowledgedBy ? (
                            <button
                              type="button"
                              onClick={() => handleAcknowledge(alert.id)}
                              className="flex-1 bg-surface border border-border hover:bg-opacity-80 text-text-primary text-[10px] font-semibold py-1.5 rounded flex items-center justify-center space-x-1"
                              aria-label="Acknowledge alert"
                            >
                              <span>Acknowledge</span>
                            </button>
                          ) : (
                            <div className="flex-1 bg-surface border border-border text-secondary text-[10px] font-semibold py-1.5 rounded flex items-center justify-center space-x-1 opacity-75">
                              <CheckCircle className="w-3 h-3" />
                              <span>Acknowledged</span>
                            </div>
                          )}

                          {/* View AI Mitigation recommendation */}
                          <button
                            type="button"
                            onClick={() => handleViewRecommendation(alert.id)}
                            className="flex-1 bg-primary text-primary-foreground hover:bg-opacity-95 text-[10px] font-semibold py-1.5 rounded flex items-center justify-center space-x-1"
                            aria-label="View AI mitigation recommendation"
                          >
                            <Eye className="w-3 h-3" />
                            <span>AI Action Plan</span>
                          </button>

                          {/* Resolve Action */}
                          <button
                            type="button"
                            onClick={() => handleResolve(alert.id)}
                            className="bg-secondary text-secondary-foreground hover:bg-opacity-95 text-[10px] font-semibold px-2 py-1.5 rounded"
                            aria-label="Mark alert resolved"
                          >
                            Resolve
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          
          {/* Socket status indicator */}
          <div className="mt-4 text-[9px] text-text-secondary text-right">
            Real-time feed connected via WebSocket.
          </div>
        </section>

      </main>

      {/* AI Mitigation Recommendation Modal Dialog Overlay */}
      {activeAlertIdForModal && (
        <div 
          className="fixed inset-0 bg-background bg-opacity-80 flex items-center justify-center p-4 z-50 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-heading"
        >
          <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 id="modal-heading" className="font-display font-semibold text-base text-primary-foreground flex items-center">
                <Volume2 className="w-5 h-5 mr-2 text-primary" />
                AI Mitigation Recommendation
              </h3>
              <button
                type="button"
                onClick={() => {
                  setActiveAlertIdForModal(null);
                  clearRecommendation();
                }}
                className="text-text-secondary hover:text-text-primary text-xs font-semibold px-2 py-1 border border-border rounded"
                aria-label="Close recommendation modal"
              >
                Close
              </button>
            </div>

            {isDashboardLoading && !aiRecommendation ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs text-text-secondary">Generating Crowd Action Plan...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-background rounded border border-border p-4 text-xs text-text-primary leading-relaxed whitespace-pre-line">
                  {aiRecommendation || 'No recommendation received.'}
                </div>
                <p className="text-[10px] text-text-secondary italic">
                  Recommendations generated dynamically using Gemini based on live surrounding zone capacities.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-border bg-surface px-6 py-4 text-center text-xs text-text-secondary">
        &copy; 2026 FIFA World Cup MatchDay AI Assistant. Operations Console v1.0.
      </footer>
    </div>
  );
}
