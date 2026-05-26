/**
 * apps/gateway/src/clients/clients.module.ts
 *
 * NestJS module wrapping HTTP clients to upstream ICP services.
 *
 * Currently provides:
 *   - AiClient — talks to apps/ai/ Flask service (S-02 T05 ship)
 *   - McpClient — JSON-RPC 2.0 client for apps/mcp/ direct calls (S-07 T01.E
 *     amend per C-S07-A; introduced for cards.* tools — cards.list_pending +
 *     cards.update_status. Aligns with the deferred-need note in the original
 *     S-02 T05 docstring: "If a Gateway-side direct MCP call ever becomes
 *     needed (e.g. auth.verify_jwt before AI dispatch), add here.")
 *
 * Future (S-08 voice / S-10 analytics):
 *   - VespaClient, KafkaProducerClient, etc. as needed.
 *
 * Pattern: this module exports clients so any consumer module (HealthModule
 * for T05 readiness, IntentModule for T07 SSE wrapper, CartModule for cart
 * REST, CardsModule for cards REST) imports ClientsModule to inject the
 * needed client via constructor DI.
 *
 * Reference:
 *   - slices/S-07_decisions-log.md C-S07-A (Gateway cards.* REST proxy → MCP)
 */
import { Module } from '@nestjs/common';
import { AiClient } from './ai.client';
import { McpClient } from './mcp.client';

@Module({
  providers: [AiClient, McpClient],
  exports: [AiClient, McpClient],
})
export class ClientsModule {}
