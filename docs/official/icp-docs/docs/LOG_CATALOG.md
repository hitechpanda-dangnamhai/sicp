# Log & Event Catalog

> Append-only registry. Mọi message name (operational log) và event_type (behavior event) phải có entry ở đây trước khi dùng trong code.

## A. Operational Log Messages

Từ `06_OBSERVABILITY.md`. Format: `<noun>_<past_verb>` hoặc `<noun>_<verb>_failed`.

### Auth
| Message | Level | Fields (extras) | Service |
|---|---|---|---|
| `auth.login_succeeded` | info | `{user_id, role}` | gateway |
| `auth.login_failed` | warn | `{email_hash, reason}` | gateway |
| `auth.logout_completed` | info | `{user_id, jti}` | gateway |
| `auth.token_verified` | debug | `{user_id, jti}` | gateway |
| `auth.token_invalid` | warn | `{reason}` | gateway |
| `auth.refresh_succeeded` | info | `{user_id}` | gateway |

### Idempotency
| Message | Level | Fields | Service |
|---|---|---|---|
| `idempotency.cache_hit` | debug | `{key_prefix, user_id}` | gateway |
| `idempotency.lock_acquired` | debug | `{key_prefix}` | gateway |
| `idempotency.lock_conflict` | warn | `{key_prefix}` | gateway |
| `idempotency.cached_response_stored` | debug | `{key_prefix, status}` | gateway |

### Intent
| Message | Level | Fields | Service |
|---|---|---|---|
| `intent.received` | info | `{intent_hint?, modality}` | gateway |
| `intent.classified` | info | `{intent, confidence}` | ai |
| `intent.dispatched` | info | `{intent}` | ai |
| `intent.completed` | info | `{intent, duration_ms}` | ai |
| `intent.failed` | error | `{intent, error_code}` | ai |
| `intent.unknown` | warn | `{raw_input_hash}` | ai |
| `intent.resumed` | info | `{intent, request_id}` | ai |

### MCP
| Message | Level | Fields | Service |
|---|---|---|---|
| `mcp.tool_called` | debug | `{tool}` | ai |
| `mcp.tool_completed` | info | `{tool, duration_ms}` | mcp |
| `mcp.tool_failed` | error | `{tool, error_code}` | mcp |
| `mcp.tool_unknown` | error | `{tool}` | mcp |

### Vespa
| Message | Level | Fields | Service |
|---|---|---|---|
| `vespa.search_completed` | info | `{rank_profile, hits, duration_ms}` | mcp |
| `vespa.search_failed` | error | `{error_code}` | mcp |
| `vespa.search_timeout` | warn | `{timeout_ms}` | mcp |
| `vespa.indexed` | info | `{doc_id}` | mcp |
| `vespa.index_failed` | error | `{doc_id, error_code}` | mcp |
| `vespa.partial_update_completed` | debug | `{doc_id, field_count}` | worker-aggregator |

### Vision / Speech / LLM
| Message | Level | Fields | Service |
|---|---|---|---|
| `vision.analyzed` | info | `{category, confidence, duration_ms}` | mcp |
| `vision.low_confidence` | warn | `{confidence}` | mcp |
| `vision.embedded` | debug | `{vector_dim, duration_ms}` | mcp |
| `speech.transcribed` | info | `{lang, confidence, duration_ms}` | mcp |
| `speech.transcribe_failed` | error | `{reason}` | mcp |
| `llm.generated` | info | `{provider, model, in_tokens, out_tokens, duration_ms}` | ai/mcp |
| `llm.rate_limited` | warn | `{provider, retry_after_ms}` | ai/mcp |
| `llm.failed` | error | `{provider, error_code}` | ai/mcp |
| `gtrends.fetched` | info | `{keyword, current_score, delta_pct, trajectory, duration_ms}` | mcp |
| `gtrends.cache_hit` | debug | `{keyword, age_seconds}` | mcp |
| `gtrends.unavailable` | warn | `{keyword, reason}` | mcp |
| `gtrends.rate_limited` | warn | `{retry_after_ms}` | mcp |

### Domain Events (publishing)
| Message | Level | Fields | Service |
|---|---|---|---|
| `event.appended` | debug | `{event_type, aggregate_id}` | mcp |
| `event.published` | info | `{event_type, topic}` | gateway/ai |
| `event.publish_failed` | error | `{event_type, error_code}` | gateway/ai |
| `event.publish_retried` | warn | `{event_type, attempt}` | worker-outbox |
| `event.consumed` | debug | `{event_type, topic, partition, offset}` | workers |
| `event.handler_failed` | error | `{event_type, error_code}` | workers |

### Cards
| Message | Level | Fields | Service |
|---|---|---|---|
| `card.created` | info | `{card_id, action_type, policy_code}` | worker-cardgen |
| `card.accepted` | info | `{card_id, action_type}` | gateway |
| `card.rejected` | info | `{card_id, action_type}` | gateway |
| `card.expired` | debug | `{card_id}` | worker-cardgen |

### Orders & Payments
| Message | Level | Fields | Service |
|---|---|---|---|
| `order.created` | info | `{order_id, item_count, total}` | gateway |
| `order.placed_published` | info | `{order_id}` | gateway |
| `order.status_changed` | info | `{order_id, from, to}` | gateway/workers |
| `payment.charge_started` | info | `{order_id, amount}` | worker-payment |
| `payment.charge_succeeded` | info | `{order_id, transaction_id}` | worker-payment |
| `payment.charge_failed` | error | `{order_id, reason}` | worker-payment |
| `stock.reserved` | info | `{order_id, items}` | worker-inventory |
| `stock.reservation_failed` | warn | `{order_id, reason}` | worker-inventory |
| `stock.released` | info | `{order_id}` | worker-inventory |
| `notification.dispatched` | info | `{order_id, channel}` | worker-notif |

### Cart
| Message | Level | Fields | Service |
|---|---|---|---|
| `cart.item_upserted` | info | `{user_id, product_id, qty}` | mcp |
| `cart.item_removed` | info | `{user_id, product_id}` | mcp |
| `cart.cleared` | info | `{user_id}` | mcp |

### System / Health
| Message | Level | Fields | Service |
|---|---|---|---|
| `service.started` | info | `{version, env}` | all |
| `service.shutting_down` | info | - | all |
| `health.check_failed` | error | `{dep, error}` | all |
| `db.connection_pool_exhausted` | error | `{pool_size}` | services |
| `kafka.consumer_lag_high` | warn | `{topic, lag}` | workers |
| `redis.unavailable` | error | - | services |

---

## B. Behavior Event Types

Từ `07_BEHAVIOR_LOGS.md`. Format: `<domain>.<verb>`.

### Session & Auth
| event_type | Required properties |
|---|---|
| `session.started` | `source: 'web'\|'mobile'` |
| `session.ended` | `duration_seconds: int` |
| `auth.signed_in` | `method: 'password'` |
| `auth.signed_out` | `{}` |

### Discovery
| event_type | Required properties |
|---|---|
| `search.performed` | `query: str, filters: obj, modality, result_count: int` |
| `search.result_impressed` | `query, product_id, position: int, rank_profile?: str` |
| `search.result_clicked` | `query, product_id, position, dwell_ms_before_click?: int` |
| `search.result_dismissed` | `query, product_id, position` |
| `recommendation.shown` | `source: str, seed_product_id?, products: [{id, position, reason}]` |
| `recommendation.clicked` | `source, product_id, position` |
| `recommendation.dismissed` | `source, product_id, position` |

### Product Interaction
| event_type | Required properties |
|---|---|
| `product.viewed` | `product_id, source: str, dwell_ms?: int` |
| `product.zoomed` | `product_id` |
| `product.shared` | `product_id, channel: str` |

### Cart & Checkout
| event_type | Required properties |
|---|---|
| `cart.item_added` | `product_id, qty: int, unit_price: int, source: str, from_query?: str` |
| `cart.item_removed` | `product_id, qty_removed: int` |
| `cart.qty_changed` | `product_id, old_qty: int, new_qty: int` |
| `cart.viewed` | `item_count: int, total: int` |
| `cart.cleared` | `{}` |
| `checkout.started` | `items: array, total: int` |
| `checkout.completed` | `order_id, items, total` |
| `checkout.failed` | `order_id, reason: str` |
| `checkout.cancelled` | `order_id, stage: 'pending'\|'processing'` |

### Merchant
| event_type | Required properties |
|---|---|
| `product.import_started` | `source: 'image'\|'voice'\|'text'` |
| `product.import_completed` | `product_id, category, price, was_prefilled: bool` |
| `product.import_abandoned` | `stage: 'form'\|'cards'` |
| `card.shown` | `card_id, action_type, event_id` |
| `card.accepted` | `card_id, action_type, applied_value?: any` |
| `card.rejected` | `card_id, action_type` |
| `card.expired` | `card_id` |

### Analytics
| event_type | Required properties |
|---|---|
| `analytics.queried` | `metric, dimension, range_months: int, modality` |
| `analytics.chart_viewed` | `chart_type: str, duration_seconds: int` |

---

## C. Rules for Adding New Messages/Events

1. **Append-only** — Never rename. If schema changes, version: `event.v2`
2. **Naming check** — Must follow patterns:
   - Operational log: `<domain>.<noun>_<past_verb>` (snake_case)
   - Behavior event: `<domain>.<verb>` (lowercase)
3. **Propose first** — Add entry với status `[Proposed]`, human approve → remove tag
4. **Document fields** — Required + optional clearly
5. **Update code** — Add to TypeScript `PropertiesMap` (behavior) or constant (ops)

## D. Quick Look-up Index

### "Cái này log ở đâu?"

| Question | Look at |
|---|---|
| Service quá chậm? | `intent.completed.duration_ms` ops log → Tempo trace |
| Vespa miss data? | `vespa.search_completed.hits` ops log |
| Tại sao product này không lên top search? | Behavior: `search.result_clicked` vs `search.result_impressed` ratio |
| Tại sao card không được accept? | Behavior: `card.shown` vs `card.accepted/rejected` |
| Payment fail rate? | Ops metric `icp.payments.outcome` |
| User abandon ở đâu? | Behavior funnel: `product.viewed` → `cart.item_added` → `checkout.started` → `checkout.completed` |

---

**END OF CATALOG.**
