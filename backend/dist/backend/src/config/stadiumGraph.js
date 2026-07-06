"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STADIUM_EDGES = exports.STADIUM_ZONES = exports.ZONES = void 0;
exports.findRoute = findRoute;
// Valid UUID strings that PostgreSQL accepts
exports.ZONES = {
    GATE_A: '00000000-0000-0000-0000-000000000001',
    GATE_B: '00000000-0000-0000-0000-000000000002',
    TRANSIT_EXIT: '00000000-0000-0000-0000-000000000003',
    CONCOURSE_NORTH: '00000000-0000-0000-0000-000000000004',
    CONCOURSE_SOUTH: '00000000-0000-0000-0000-000000000005',
    RESTROOMS: '00000000-0000-0000-0000-000000000006',
    CONCESSIONS: '00000000-0000-0000-0000-000000000007',
};
exports.STADIUM_ZONES = [
    { id: exports.ZONES.GATE_A, name: 'Gate A Concourse', x: 100, y: 150 },
    { id: exports.ZONES.GATE_B, name: 'Gate B Transit', x: 300, y: 150 },
    { id: exports.ZONES.TRANSIT_EXIT, name: 'North Transit Link', x: 200, y: 50 },
    { id: exports.ZONES.CONCOURSE_NORTH, name: 'Concourse North', x: 200, y: 220 },
    { id: exports.ZONES.CONCOURSE_SOUTH, name: 'Concourse South', x: 200, y: 350 },
    { id: exports.ZONES.RESTROOMS, name: 'Concourse Restrooms', x: 80, y: 280 },
    { id: exports.ZONES.CONCESSIONS, name: 'Food Concessions', x: 320, y: 280 },
];
exports.STADIUM_EDGES = [
    { from: exports.ZONES.GATE_A, to: exports.ZONES.TRANSIT_EXIT, directions: 'Walk north-east towards the North Transit Link for 60m.' },
    { from: exports.ZONES.GATE_B, to: exports.ZONES.TRANSIT_EXIT, directions: 'Walk north-west towards the North Transit Link for 60m.' },
    { from: exports.ZONES.GATE_A, to: exports.ZONES.CONCOURSE_NORTH, directions: 'Head south-east along the inner ring toward Concourse North.' },
    { from: exports.ZONES.GATE_B, to: exports.ZONES.CONCOURSE_NORTH, directions: 'Head south-west along the inner ring toward Concourse North.' },
    { from: exports.ZONES.CONCOURSE_NORTH, to: exports.ZONES.CONCOURSE_SOUTH, directions: 'Walk straight down the main concourse pathway for 130m.' },
    { from: exports.ZONES.CONCOURSE_NORTH, to: exports.ZONES.RESTROOMS, directions: 'Turn right at the signpost and walk 50m to the restrooms.' },
    { from: exports.ZONES.CONCOURSE_NORTH, to: exports.ZONES.CONCESSIONS, directions: 'Turn left and walk 50m to the Food Concessions counter.' },
    { from: exports.ZONES.CONCOURSE_SOUTH, to: exports.ZONES.RESTROOMS, directions: 'Head north-west along the outer ring for 80m.' },
    { from: exports.ZONES.CONCOURSE_SOUTH, to: exports.ZONES.CONCESSIONS, directions: 'Head north-east along the outer ring for 80m.' },
];
/**
 * BFS Graph solver to find the shortest path and return node coordinates and directions.
 */
function findRoute(startId, endId) {
    if (startId === endId) {
        const node = exports.STADIUM_ZONES.find((z) => z.id === startId);
        return {
            path: [startId],
            directions: ['You are already at your destination.'],
            coordinates: node ? [{ x: node.x, y: node.y }] : [],
        };
    }
    // Build adjacency list
    const adjList = {};
    const edgeInfo = {};
    exports.STADIUM_ZONES.forEach((node) => {
        adjList[node.id] = [];
    });
    exports.STADIUM_EDGES.forEach((edge) => {
        adjList[edge.from].push(edge.to);
        adjList[edge.to].push(edge.from);
        edgeInfo[`${edge.from}_${edge.to}`] = edge.directions;
        edgeInfo[`${edge.to}_${edge.from}`] = edge.directions;
    });
    // Run BFS
    const queue = [startId];
    const visited = { [startId]: true };
    const parent = {};
    let found = false;
    while (queue.length > 0) {
        const curr = queue.shift();
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
    // Reconstruct path
    const path = [];
    let temp = endId;
    while (temp !== startId) {
        path.push(temp);
        temp = parent[temp];
    }
    path.push(startId);
    path.reverse();
    // Reconstruct directions and coordinates
    const directions = [];
    const coordinates = [];
    for (let i = 0; i < path.length; i++) {
        const nodeId = path[i];
        const node = exports.STADIUM_ZONES.find((z) => z.id === nodeId);
        coordinates.push({ x: node.x, y: node.y });
        if (i < path.length - 1) {
            const nextNodeId = path[i + 1];
            const dirText = edgeInfo[`${nodeId}_${nextNodeId}`] || 'Proceed to the next zone.';
            directions.push(dirText);
        }
    }
    return {
        path,
        directions,
        coordinates,
    };
}
