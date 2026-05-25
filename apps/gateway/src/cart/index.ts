/**
 * apps/gateway/src/cart/index.ts
 *
 * S-05 T02 NEW (Phiên Sx05-2b per D-S05-01 LAW).
 *
 * Barrel exports for cart module — single import surface for app.module.ts
 * (`import { CartModule } from './cart'`).
 */

export { CartModule } from './cart.module';
export { CartService } from './cart.service';
export { CartController } from './cart.controller';
