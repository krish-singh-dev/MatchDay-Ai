"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STADIUM_EDGES = exports.STADIUM_ZONES = void 0;
exports.findRoute = findRoute;
exports.STADIUM_ZONES = [
    { id: 'gate-a', name: 'Gate A Concourse', x: 100, y: 150 },
    { id: 'gate-b', name: 'Gate B Transit', x: 300, y: 150 },
    { id: 'transit-exit', name: 'North Transit Link', x: 200, y: 50 },
    { id: 'concourse-north', name: 'Concourse North', x: 200, y: 220 },
    { id: 'concourse-south', name: 'Concourse South', x: 200, y: 350 },
    { id: 'restrooms', name: 'Concourse Restrooms', x: 80, y: 280 },
    { id: 'concessions', name: 'Food Concessions', x: 320, y: 280 },
];
exports.STADIUM_EDGES = [
    { from: 'gate-a', to: 'transit-exit', directions: 'Walk north-east towards the North Transit Link for 60m.' },
    { from: 'gate-b', to: 'transit-exit', directions: 'Walk north-west towards the North Transit Link for 60m.' },
    { from: 'gate-a', to: 'concourse-north', directions: 'Head south-east along the inner ring toward Concourse North.' },
    { from: 'gate-b', to: 'concourse-north', directions: 'Head south-west along the inner ring toward Concourse North.' },
    { from: 'concourse-north', to: 'concourse-south', directions: 'Walk straight down the main concourse pathway for 130m.' },
    { from: 'concourse-north', to: 'restrooms', directions: 'Turn right at the signpost and walk 50m to the restrooms.' },
    { from: 'concourse-north', to: 'concessions', directions: 'Turn left and walk 50m to the Food Concessions counter.' },
    { from: 'concourse-south', to: 'restrooms', directions: 'Head north-west along the outer ring for 80m.' },
    { from: 'concourse-south', to: 'concessions', directions: 'Head north-east along the outer ring for 80m.' },
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
        // Bidirectional edges might need reversed wording, but we keep it simple or reflect it
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
