-- ============================================================================
-- infra/seed/ci-min.sql — S-P0-03/T01b MINIMAL CI seed.
--
-- ONLY what the un-skipped integration specs need — NOT the full demo seed
-- (products/policies/2-tenant = T02 W-80). Run AFTER infra/migrations/apply.sh.
--
-- merchant1@demo.icp with a FIXED id: apps/mcp/tests/test_t05_stock_atomic.py:30
-- hardcodes 19f25ecb-... as products.merchant_id (FK → users.id), and
-- apps/gateway/.../auth.service.spec.ts selects it by email + verifies bcrypt.
-- password_hash = bcryptjs cost-10 hash of 'demo1234' (D-01 contract).
-- DEMO tenant 11111111 is created by V011; membership lets login resolve a
-- tenant so the auth.signed_in loopback persists (AC-12).
-- Idempotent: ON CONFLICT DO NOTHING.
-- ============================================================================

INSERT INTO users (id, email, password_hash, role, display_name)
VALUES (
  '19f25ecb-569d-459e-9e5d-a70a7cf15af6',
  'merchant1@demo.icp',
  '$2a$10$4H9mrclNBYOfVpwQUIa..eEHD1.tD7ZMJyNDjnDmei6luBbsRuHGe',
  'merchant',
  'Anh Nam'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO tenant_memberships (user_id, tenant_id, role)
VALUES (
  '19f25ecb-569d-459e-9e5d-a70a7cf15af6',
  '11111111-1111-1111-1111-111111111111',
  'owner'
)
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- ============================================================================
-- S-P0-03/T02a (W-80 + W-75 seed-close): ≥2 tenant + customer global cho CI.
-- ----------------------------------------------------------------------------
-- WHY tenant#2 id KHÔNG dùng 22222222: id đó là tenant EPHEMERAL của
-- tenant-isolation.spec.ts (tạo beforeAll + DELETE afterAll) — persistent seed
-- trùng nó sẽ bị spec xoá → seed-assert đỏ. Dùng id riêng a2a2a2a2 (persistent).
-- test_t05/test_t03b dùng 22222222 CHỈ làm GUC value (không insert tenants row)
-- → không liên quan. merchant1 id GIỮ NGUYÊN (test_t05:30 hardcode).
-- WHY customer KHÔNG có membership: ADR-046 model #2 — customer GLOBAL, quyền
-- mua là quyền global (V011 comment). password_hash = cùng hash 'demo1234'.
-- Superuser-applied (DATABASE_URL_MIGRATE) → BYPASSRLS; tenant_id tường minh.
-- ============================================================================

-- tenant#2 (persistent, cho cross-tenant e2e T02b).
INSERT INTO tenants (id, slug, name)
VALUES ('a2a2a2a2-0000-4000-8000-000000000002', 'demo2', 'Demo Shop 2')
ON CONFLICT (id) DO NOTHING;

-- merchant2 (owner tenant#2) + customer1 (global, no membership).
INSERT INTO users (id, email, password_hash, role, display_name)
VALUES
  ('b2b2b2b2-0000-4000-8000-000000000002',
   'merchant2@demo.icp',
   '$2a$10$4H9mrclNBYOfVpwQUIa..eEHD1.tD7ZMJyNDjnDmei6luBbsRuHGe',
   'merchant', 'Chị Lan'),
  ('c1c1c1c1-0000-4000-8000-000000000001',
   'customer1@demo.icp',
   '$2a$10$4H9mrclNBYOfVpwQUIa..eEHD1.tD7ZMJyNDjnDmei6luBbsRuHGe',
   'customer', 'Khách 1')
ON CONFLICT (email) DO NOTHING;

INSERT INTO tenant_memberships (user_id, tenant_id, role)
VALUES (
  'b2b2b2b2-0000-4000-8000-000000000002',
  'a2a2a2a2-0000-4000-8000-000000000002',
  'owner'
)
ON CONFLICT (user_id, tenant_id) DO NOTHING;
