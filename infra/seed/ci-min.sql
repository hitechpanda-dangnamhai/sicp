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
