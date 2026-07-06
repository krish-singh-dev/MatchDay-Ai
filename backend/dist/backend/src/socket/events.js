"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocketEvents = initSocketEvents;
exports.emitDensityUpdate = emitDensityUpdate;
exports.emitNewAlert = emitNewAlert;
exports.emitAlertResolved = emitAlertResolved;
let ioInstance = null;
/**
 * Initializes the Socket.IO event instance helper.
 * @param io The initialized Socket.IO server.
 */
function initSocketEvents(io) {
    ioInstance = io;
    console.log('Socket.IO event helper initialized');
}
/**
 * Emits a density update event to all connected clients.
 */
function emitDensityUpdate(reading) {
    if (ioInstance) {
        ioInstance.emit('density:update', reading);
        console.log(`Socket emitted density:update for zone ${reading.zoneId}`);
    }
    else {
        console.warn('Socket.IO instance not initialized. density:update bypassed.');
    }
}
/**
 * Emits a new alert event to staff/admin dashboard clients.
 */
function emitNewAlert(alert) {
    if (ioInstance) {
        ioInstance.emit('alert:new', alert);
        console.log(`Socket emitted alert:new for alert ${alert.id}`);
    }
    else {
        console.warn('Socket.IO instance not initialized. alert:new bypassed.');
    }
}
/**
 * Emits an alert resolution event to all connected clients.
 */
function emitAlertResolved(alert) {
    if (ioInstance) {
        ioInstance.emit('alert:resolved', alert);
        console.log(`Socket emitted alert:resolved for alert ${alert.id}`);
    }
    else {
        console.warn('Socket.IO instance not initialized. alert:resolved bypassed.');
    }
}
