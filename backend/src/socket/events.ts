import { Server } from 'socket.io';
import { Alert, DensityReading } from '../../../shared/types';

let ioInstance: Server | null = null;

/**
 * Initializes the Socket.IO event instance helper.
 * @param io The initialized Socket.IO server.
 */
export function initSocketEvents(io: Server): void {
  ioInstance = io;
  console.log('Socket.IO event helper initialized');
}

/**
 * Emits a density update event to all connected clients.
 */
export function emitDensityUpdate(reading: DensityReading): void {
  if (ioInstance) {
    ioInstance.emit('density:update', reading);
    console.log(`Socket emitted density:update for zone ${reading.zoneId}`);
  } else {
    console.warn('Socket.IO instance not initialized. density:update bypassed.');
  }
}

/**
 * Emits a new alert event to staff/admin dashboard clients.
 */
export function emitNewAlert(alert: Alert): void {
  if (ioInstance) {
    ioInstance.emit('alert:new', alert);
    console.log(`Socket emitted alert:new for alert ${alert.id}`);
  } else {
    console.warn('Socket.IO instance not initialized. alert:new bypassed.');
  }
}

/**
 * Emits an alert resolution event to all connected clients.
 */
export function emitAlertResolved(alert: Alert): void {
  if (ioInstance) {
    ioInstance.emit('alert:resolved', alert);
    console.log(`Socket emitted alert:resolved for alert ${alert.id}`);
  } else {
    console.warn('Socket.IO instance not initialized. alert:resolved bypassed.');
  }
}
