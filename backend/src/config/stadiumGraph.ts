export interface GraphNode {
  id: string;
  name: string;
  x: number; // For SVG mapping overlay
  y: number; // For SVG mapping overlay
}

export interface GraphEdge {
  from: string;
  to: string;
  directions: string;
}

// Valid UUID strings that PostgreSQL accepts
export const ZONES = {
  GATE_A: '00000000-0000-0000-0000-000000000001',
  GATE_B: '00000000-0000-0000-0000-000000000002',
  TRANSIT_EXIT: '00000000-0000-0000-0000-000000000003',
  CONCOURSE_NORTH: '00000000-0000-0000-0000-000000000004',
  CONCOURSE_SOUTH: '00000000-0000-0000-0000-000000000005',
  RESTROOMS: '00000000-0000-0000-0000-000000000006',
  CONCESSIONS: '00000000-0000-0000-0000-000000000007',
};

export const STADIUM_ZONES: GraphNode[] = [
  { id: ZONES.GATE_A, name: 'Gate A Concourse', x: 100, y: 150 },
  { id: ZONES.GATE_B, name: 'Gate B Transit', x: 300, y: 150 },
  { id: ZONES.TRANSIT_EXIT, name: 'North Transit Link', x: 200, y: 50 },
  { id: ZONES.CONCOURSE_NORTH, name: 'Concourse North', x: 200, y: 220 },
  { id: ZONES.CONCOURSE_SOUTH, name: 'Concourse South', x: 200, y: 350 },
  { id: ZONES.RESTROOMS, name: 'Concourse Restrooms', x: 80, y: 280 },
  { id: ZONES.CONCESSIONS, name: 'Food Concessions', x: 320, y: 280 },
];

export const STADIUM_EDGES: GraphEdge[] = [
  { from: ZONES.GATE_A, to: ZONES.TRANSIT_EXIT, directions: 'Walk north-east towards the North Transit Link for 60m.' },
  { from: ZONES.GATE_B, to: ZONES.TRANSIT_EXIT, directions: 'Walk north-west towards the North Transit Link for 60m.' },
  { from: ZONES.GATE_A, to: ZONES.CONCOURSE_NORTH, directions: 'Head south-east along the inner ring toward Concourse North.' },
  { from: ZONES.GATE_B, to: ZONES.CONCOURSE_NORTH, directions: 'Head south-west along the inner ring toward Concourse North.' },
  { from: ZONES.CONCOURSE_NORTH, to: ZONES.CONCOURSE_SOUTH, directions: 'Walk straight down the main concourse pathway for 130m.' },
  { from: ZONES.CONCOURSE_NORTH, to: ZONES.RESTROOMS, directions: 'Turn right at the signpost and walk 50m to the restrooms.' },
  { from: ZONES.CONCOURSE_NORTH, to: ZONES.CONCESSIONS, directions: 'Turn left and walk 50m to the Food Concessions counter.' },
  { from: ZONES.CONCOURSE_SOUTH, to: ZONES.RESTROOMS, directions: 'Head north-west along the outer ring for 80m.' },
  { from: ZONES.CONCOURSE_SOUTH, to: ZONES.CONCESSIONS, directions: 'Head north-east along the outer ring for 80m.' },
];

// ---------------------------------------------------------------------------
// Private helpers — split out of findRoute to reduce function complexity
// ---------------------------------------------------------------------------

interface AdjacencyMap {
  adjList: Record<string, string[]>;
  edgeInfo: Record<string, string>;
}

/**
 * Builds a bidirectional adjacency list and a direction-lookup map from STADIUM_EDGES.
 * @returns adjList — maps each zone ID to its direct neighbours
 * @returns edgeInfo — maps `"fromId_toId"` to the human-readable direction string
 */
function buildAdjacencyList(): AdjacencyMap {
  const adjList: Record<string, string[]> = {};
  const edgeInfo: Record<string, string> = {};

  STADIUM_ZONES.forEach((node) => {
    adjList[node.id] = [];
  });

  STADIUM_EDGES.forEach((edge) => {
    adjList[edge.from].push(edge.to);
    adjList[edge.to].push(edge.from);
    edgeInfo[`${edge.from}_${edge.to}`] = edge.directions;
    edgeInfo[`${edge.to}_${edge.from}`] = edge.directions;
  });

  return { adjList, edgeInfo };
}

/**
 * Reconstructs the shortest path from startId to endId by walking the BFS parent map.
 * @param parent — BFS parent map: parent[node] = the node that discovered it during traversal
 * @param startId — zone ID where the BFS began
 * @param endId — zone ID that was found
 * @returns ordered array of zone IDs from start to end (inclusive)
 */
function reconstructPath(
  parent: Record<string, string>,
  startId: string,
  endId: string
): string[] {
  const path: string[] = [];
  let temp = endId;
  while (temp !== startId) {
    path.push(temp);
    temp = parent[temp];
  }
  path.push(startId);
  path.reverse();
  return path;
}

interface RouteDetails {
  directions: string[];
  coordinates: { x: number; y: number }[];
}

/**
 * Converts an ordered zone-ID path into human-readable direction strings and SVG coordinates.
 * @param path — ordered array of zone IDs from reconstructPath
 * @param edgeInfo — direction-lookup map from buildAdjacencyList
 */
function buildRouteDetails(path: string[], edgeInfo: Record<string, string>): RouteDetails {
  const directions: string[] = [];
  const coordinates: { x: number; y: number }[] = [];

  for (let i = 0; i < path.length; i++) {
    const nodeId = path[i];
    const node = STADIUM_ZONES.find((z) => z.id === nodeId)!;
    coordinates.push({ x: node.x, y: node.y });

    if (i < path.length - 1) {
      const nextNodeId = path[i + 1];
      const dirText = edgeInfo[`${nodeId}_${nextNodeId}`] || 'Proceed to the next zone.';
      directions.push(dirText);
    }
  }

  return { directions, coordinates };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * BFS graph solver: finds the shortest path between two stadium zones and returns
 * the path (as zone IDs), step-by-step direction strings, and SVG coordinates.
 * Returns null if no path exists between the two zones.
 */
export function findRoute(startId: string, endId: string) {
  if (startId === endId) {
    const node = STADIUM_ZONES.find((z) => z.id === startId);
    return {
      path: [startId],
      directions: ['You are already at your destination.'],
      coordinates: node ? [{ x: node.x, y: node.y }] : [],
    };
  }

  const { adjList, edgeInfo } = buildAdjacencyList();

  // BFS traversal
  const queue: string[] = [startId];
  const visited: Record<string, boolean> = { [startId]: true };
  const parent: Record<string, string> = {};

  let found = false;
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === endId) {
      found = true;
      break;
    }

    for (const neighbor of adjList[curr]) {
      if (!visited[neighbor]) {
        visited[neighbor] = true;
        parent[neighbor] = curr;
        queue.push(neighbor);
      }
    }
  }

  if (!found) {
    return null;
  }

  const path = reconstructPath(parent, startId, endId);
  const { directions, coordinates } = buildRouteDetails(path, edgeInfo);

  return { path, directions, coordinates };
}

