# FACTS — generated 2026-06-11T10:55:01Z by scripts/gen-facts.sh — DO NOT EDIT BY HAND

## Migrations   <!-- ls infra/migrations/*.sql -->
- V001__init.sql
- V002__product_enrichment.sql
- V003__insights.sql
- V005__payment_metadata.sql
- V006__analytics_aggregations.sql
- V008__shopee_prices_mock.sql
- V009__auth_refresh_token.sql
- V010__image_data_inline.sql
- V011__multi_tenant.sql
- V012__session_last_active_tenant.sql
- V013__rls_nullif_hardening.sql
- highest: V013

## Gateway routes   <!-- grep @Get/@Post/@Patch/@Delete/@Put trong *.controller.ts -->
- auth: 6 route — @Post('login') @Post('logout') @Get('me') @Post('switch-tenant') @Post('refresh') @Post('forgot-password') 
- landing: 2 route — @Get('landing') @Get('tenants') 
- cards: 3 route — @Get() @Post(':id/accept') @Post(':id/reject') 
- cart: 7 route — @Get() @Post('items') @Patch('items/:productId') @Delete('items/:productId') @Delete() @Post('promo') @Delete('promo') 
- dashboard: 2 route — @Get('stats') @Get('insight') 
- health: 2 route — @Get() @Get('ready') 
- intent-action: 1 route — @Post(':rid/action') 
- intent-suggest-attrs: 1 route — @Post(':rid/suggest-attrs') 
- intent: 2 route — @Post() @Get('stream') 
- products: 1 route — @Patch(':id') 
- public: 1 route — @Get('tenant-by-slug/:slug') 
- tracking: 1 route — @Post() 
- TOTAL: 29 route / 12 controller

## AI graphs   <!-- ls apps/ai/src/graphs/intents/*.py -->
- analyzing_by_voices
- buying_by_voices
- cart_by_text
- importing_by_images
- recommend_by_images
- searching_by_text
- TOTAL: 6 graph

## MCP tools   <!-- grep 'register("' apps/mcp/src -->
- TOTAL: 37 tool (unique)
- analytics.aggregate
- analytics.co_purchased
- analytics.detect_anomaly
- analytics.explain_trend
- analytics.product_corpus_size
- analytics.stock_snapshot
- analytics.suggest_loan
- analytics.suggest_price
- analytics.suggest_promo
- analytics.suggest_restock
- auth.verify_jwt
- cards.create
- cards.list_pending
- cards.update_status
- cart.apply_promo
- cart.clear
- cart.get
- cart.remove
- cart.remove_promo
- cart.update_qty
- cart.validate_stock
- events.append
- gtrends.interest_over_time
- policies.find_matching
- products.create
- products.get
- products.update
- shopee.price_range
- speech.synthesize
- speech.transcribe
- vespa.compare_similar
- vespa.hybrid_search
- vespa.image_nearest_neighbor
- vespa.index
- vespa.search_trend
- vision.analyze
- vision.suggest_attributes

## DB   <!-- docker exec icp-postgres psql; fallback parse migrations -->
- nguồn: ★ DB LIVE (container icp-postgres, db icp)
- tables: 19
  - action_cards
  - behavior_events
  - behavior_events_y2026m05
  - behavior_events_y2026m06
  - behavior_events_y2026m07
  - events
  - insights
  - order_items
  - orders
  - policies
  - product_reviews
  - products
  - schema_migrations
  - sessions
  - shopee_prices_mock
  - tenant_memberships
  - tenants
  - transactions
  - users
- matviews: 3
  - analytics_daily
  - analytics_daily_category
  - analytics_product_performance
- migrations applied: 11
- cột tenant_id: 14

## Frontend (apps/web)   <!-- find app -name page.tsx; ls components -->
- pages (App Router): 48
  - / (root)
  - /auth/forgot-password
  - /auth/login
  - /dev/acceptance/intent-01
  - /dev/acceptance/intent-02
  - /dev/acceptance/intent-03
  - /dev/acceptance/intent-04
  - /dev/acceptance/intent-05
  - /dev/acceptance/intent-06
  - /dev/acceptance/intent-07
  - /dev/acceptance/intent-08
  - /dev/atom-smoke
  - /dev/molecule-smoke/action-card
  - /dev/molecule-smoke/ai-insight-card
  - /dev/molecule-smoke/cart-item-row
  - /dev/molecule-smoke/conversation-bubble
  - /dev/molecule-smoke/drill-chip-row
  - /dev/molecule-smoke/live-partial-transcript
  - /dev/molecule-smoke/mic-button
  - /dev/molecule-smoke/otp-field
  - /dev/molecule-smoke/payment-method-picker
  - /dev/molecule-smoke/phases-card
  - /dev/molecule-smoke/product-card
  - /dev/molecule-smoke/shopee-compare-card
  - /dev/molecule-smoke/trend-card
  - /dev/organism-smoke/bottom-sheet
  - /dev/organism-smoke/chart-card
  - /dev/organism-smoke/charts
  - /dev/organism-smoke/chat-thread-layout
  - /dev/organism-smoke/conversation-thread
  - /dev/organism-smoke/empty-state
  - /dev/organism-smoke/error-state
  - /dev/organism-smoke/login-form
  - /dev/organism-smoke/order-summary
  - /dev/preview-frame
  - /home
  - /intent-01
  - /intent-02
  - /intent-03
  - /intent-04
  - /intent-05
  - /intent-06
  - /intent-07
  - /me
  - /me/help
  - /me/notifications
  - /me/security
  - /onboarding
- components/ui (shadcn): 8 file
- components/icp/atoms: 10 file
- components/icp/molecules: 44 file
- components/icp/organisms: 20 file
- components/icp/layout: 5 file
- e2e specs: 3
- unit/__tests__: 9

## Vespa rank-profiles   <!-- grep rank-profile product.sd -->
- ai_augmented
- baseline
- cross_encoder_rerank
- hybrid
- image_recommendation
- image_similarity

## Workers   <!-- ls apps/workers/src -->
- index.ts
- shopee-mock-seed-worker.ts

## Kafka   <!-- grep kafkajs package.json + docker ps redpanda -->
- app: CHƯA WIRE (0 package.json import kafkajs)

<!-- END FACTS -->
