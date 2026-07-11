import { ZoneNode } from '../store/useNavigationStore';

/** Visual style properties for a single zone node on the SVG map. */
interface NodeStyle {
  fill: string;
  stroke: string;
  size: number;
}

/**
 * Returns the SVG fill color, stroke color, and radius for a zone node
 * based on whether it is the route start, route end, an intermediate path node, or idle.
 */
function getNodeStyle(
  zone: ZoneNode,
  startZoneId: string,
  endZoneId: string,
  activePath: string[]
): NodeStyle {
  if (zone.id === startZoneId) {
    return { fill: 'var(--color-primary)', stroke: 'var(--color-primary-foreground)', size: 11 };
  }
  if (zone.id === endZoneId) {
    return { fill: 'var(--color-secondary)', stroke: 'var(--color-secondary-foreground)', size: 11 };
  }
  if (activePath.includes(zone.id)) {
    return { fill: 'var(--color-focus-ring)', stroke: 'var(--color-background)', size: 9 };
  }
  return { fill: 'var(--color-surface)', stroke: 'var(--color-border)', size: 8 };
}

interface VenueMapProps {
  zones: ZoneNode[];
  activePath: string[];
  coordinates: { x: number; y: number }[];
  startZoneId: string;
  endZoneId: string;
}

export default function VenueMap({
  zones,
  activePath,
  coordinates,
  startZoneId,
  endZoneId,
}: VenueMapProps) {
  // Static connections matching the backend edge definitions to draw the walkways/map corridors
  const connections = [
    { from: 'gate-a', to: 'transit-exit' },
    { from: 'gate-b', to: 'transit-exit' },
    { from: 'gate-a', to: 'concourse-north' },
    { from: 'gate-b', to: 'concourse-north' },
    { from: 'concourse-north', to: 'concourse-south' },
    { from: 'concourse-north', to: 'restrooms' },
    { from: 'concourse-north', to: 'concessions' },
    { from: 'concourse-south', to: 'restrooms' },
    { from: 'concourse-south', to: 'concessions' },
  ];

  // Helper to find zone coordinates
  const getCoords = (id: string) => {
    const zone = zones.find((z) => z.id === id);
    return zone ? { x: zone.x, y: zone.y } : null;
  };

  return (
    <div className="w-full bg-background rounded-lg border border-border p-4 flex flex-col items-center">
      <span className="text-xs text-text-secondary mb-2 uppercase font-semibold self-start tracking-wider">
        Interactive Stadium Map
      </span>
      
      <div className="relative w-full aspect-[4/3] max-w-[500px] border border-border rounded bg-surface overflow-hidden">
        <svg 
          role="img"
          viewBox="0 0 400 400" 
          className="w-full h-full"
          aria-label="Stadium Floor Plan and Wayfinding Map"
        >
          {/* Defs for gradients/glowing filters */}
          <defs>
            <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-primary)" />
              <stop offset="100%" stopColor="var(--color-focus-ring)" />
            </linearGradient>
            
            {/* Pulsing route glow filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Stadium Inner Field/Arena Circle (FIFA green grass style background representation) */}
          <circle 
            cx="200" 
            cy="240" 
            r="70" 
            fill="#052c16" 
            stroke="var(--color-border)" 
            strokeWidth="2" 
            opacity="0.3" 
          />
          <text 
            x="200" 
            y="245" 
            fill="var(--color-secondary)" 
            className="text-[10px] font-display font-semibold" 
            textAnchor="middle"
          >
            PITCH
          </text>

          {/* Draw Walkways / Corridor Links (Background connections) */}
          {connections.map((conn, idx) => {
            const p1 = getCoords(conn.from);
            const p2 = getCoords(conn.to);
            if (!p1 || !p2) return null;
            return (
              <line
                key={`conn-${idx}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="var(--color-border)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            );
          })}

          {/* Draw Calculated Route Highlight Overlay Line (with animated dash offset) */}
          {coordinates.length > 1 && (
            <>
              {/* Glow backing */}
              <polyline
                points={coordinates.map((c) => `${c.x},${c.y}`).join(' ')}
                fill="none"
                stroke="var(--color-focus-ring)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.4"
                filter="url(#glow)"
              />
              {/* Highlight Foreground */}
              <polyline
                points={coordinates.map((c) => `${c.x},${c.y}`).join(' ')}
                fill="none"
                stroke="url(#routeGrad)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-route-dash"
                style={{
                  strokeDasharray: '8,4',
                }}
              />
            </>
          )}

          {/* Draw Stadium Zone Nodes */}
          {zones.map((zone) => {
            const isStart = zone.id === startZoneId;
            const isEnd = zone.id === endZoneId;
            const { fill: nodeFill, stroke: nodeStroke, size: nodeSize } = getNodeStyle(
              zone,
              startZoneId,
              endZoneId,
              activePath
            );

            return (
              <g key={zone.id}>
                {/* Node Ring outer outline */}
                <circle
                  cx={zone.x}
                  cy={zone.y}
                  r={nodeSize + 2}
                  fill="transparent"
                  stroke={isStart || isEnd ? 'var(--color-focus-ring)' : 'transparent'}
                  strokeWidth="2"
                  className={isStart || isEnd ? 'animate-ping' : ''}
                  style={{ transformOrigin: `${zone.x}px ${zone.y}px` }}
                />
                
                {/* Main Node Circle */}
                <circle
                  cx={zone.x}
                  cy={zone.y}
                  r={nodeSize}
                  fill={nodeFill}
                  stroke={nodeStroke}
                  strokeWidth="2"
                  aria-label={`${zone.name} node`}
                />
                
                {/* Node Text Label */}
                <text
                  x={zone.x}
                  y={zone.y - nodeSize - 5}
                  fill={isStart || isEnd ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}
                  fontSize="8px"
                  fontWeight={isStart || isEnd ? 'bold' : 'normal'}
                  className="font-base"
                  textAnchor="middle"
                >
                  {zone.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Map Legend */}
      <div className="flex space-x-4 mt-3 text-[10px] text-text-secondary">
        <div className="flex items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-primary border border-primary-foreground mr-1.5" />
          <span>Start Point</span>
        </div>
        <div className="flex items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-secondary border border-secondary-foreground mr-1.5" />
          <span>Destination</span>
        </div>
        <div className="flex items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-focusRing mr-1.5" />
          <span>Route Path</span>
        </div>
      </div>
    </div>
  );
}
