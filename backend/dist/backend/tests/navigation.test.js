"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const stadiumGraph = __importStar(require("../src/config/stadiumGraph"));
describe('Navigation Routes /api/v1/navigation', () => {
    describe('GET /zones', () => {
        it('returns the list of stadium zones', async () => {
            const res = await (0, supertest_1.default)(app_1.default).get('/api/v1/navigation/zones');
            expect(res.status).toBe(200);
            expect(res.body).toBeInstanceOf(Array);
            expect(res.body.length).toBeGreaterThan(0);
            expect(res.body[0]).toHaveProperty('id');
            expect(res.body[0]).toHaveProperty('name');
            expect(res.body[0]).toHaveProperty('x');
            expect(res.body[0]).toHaveProperty('y');
        });
    });
    describe('POST /route', () => {
        it('calculates route between gate-a and concessions successfully', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/navigation/route')
                .send({
                startZoneId: 'gate-a',
                endZoneId: 'concessions',
            });
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('path');
            expect(res.body).toHaveProperty('directions');
            expect(res.body).toHaveProperty('coordinates');
            expect(res.body.path[0]).toBe('gate-a');
            expect(res.body.path[res.body.path.length - 1]).toBe('concessions');
            expect(res.body.directions.length).toBe(res.body.path.length - 1);
        });
        it('returns 400 on missing parameters', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/navigation/route')
                .send({
                startZoneId: 'gate-a',
            });
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Missing startZoneId or endZoneId parameters');
        });
        it('returns 404 if no route found', async () => {
            // Mock findRoute to return null
            const originalFindRoute = stadiumGraph.findRoute;
            stadiumGraph.findRoute = () => null;
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/v1/navigation/route')
                .send({
                startZoneId: 'gate-a',
                endZoneId: 'transit-exit',
            });
            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'No route found between the selected zones');
            // Restore
            stadiumGraph.findRoute = originalFindRoute;
        });
    });
});
