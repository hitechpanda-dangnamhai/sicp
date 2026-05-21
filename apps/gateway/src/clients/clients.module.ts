/**
 * apps/gateway/src/clients/clients.module.ts
 *
 * NestJS module wrapping HTTP clients to upstream ICP services.
 *
 * Currently provides:
 *   - AiClient — talks to apps/ai/ Flask service.
 *
 * Future (S-02 T07+, V-SLICEs):
 *   - McpClient — direct MCP JSON-RPC client (currently Gateway doesn't talk
 *     to MCP directly; AI service owns that path via apps/ai/src/tools/mcp_client.py).
 *     If a Gateway-side direct MCP call ever becomes needed (e.g. auth.verify_jwt
 *     before AI dispatch), add here.
 *   - VespaClient, etc. as needed.
 *
 * Pattern: this module exports AiClient so any consumer module (HealthModule
 * for T05 readiness, IntentModule for T07 SSE wrapper) imports ClientsModule
 * to inject AiClient via constructor DI.
 */

import { Module } from '@nestjs/common';
import { AiClient } from './ai.client';

@Module({
  providers: [AiClient],
  exports: [AiClient],
})
export class ClientsModule {}
