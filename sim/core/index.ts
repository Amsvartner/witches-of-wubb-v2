/**
 * sim/core — transport-free simulator logic (ADR-001). No socket.io imports
 * anywhere below this entry point; `sim/server.ts` provides the transport.
 */
export * from './types';
export * from './csv';
export * from './music-database';
export * from './simulator';
export * from './scenario';
export * from './scenarios';
