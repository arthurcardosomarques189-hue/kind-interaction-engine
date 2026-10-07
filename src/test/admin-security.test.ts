import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sql = readFileSync('drizzle/migrations/0000_secure_owner_administration.sql', 'utf8');
describe('Owner security invariants', () => {
  it('limits owner_admin to one account', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX single_owner ON public.user_roles\(role\) WHERE role = 'owner_admin'/);
  });
  it('never grants owner provisioning to an app user', () => {
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.assign_initial_owner(uuid) FROM PUBLIC,anon,authenticated');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.assign_initial_owner(uuid) TO service_role');
  });
  it('requires both owner_admin and unlimited credits to bypass deductions', () => {
    expect(sql).toMatch(/IF p.unlimited_credits AND EXISTS\(SELECT 1 FROM public.user_roles WHERE user_id=target AND role='owner_admin'\) THEN RETURN true/);
  });
  it('blocks ordinary processing when credits are insufficient', () => {
    expect(sql).toContain("IF p.credit_balance IS NULL OR p.credit_balance<amount THEN RAISE EXCEPTION 'Créditos insuficientes'");
  });
  it('enforces owner validation for administrative mutations', () => {
    expect(sql).toMatch(/IF NOT public.is_owner\(\) THEN RAISE EXCEPTION/);
  });
  it('provides no frontend write privilege for roles or account balances', () => {
    expect(sql).not.toMatch(/GRANT (?:UPDATE|ALL|INSERT).*ON public\.(?:profiles|user_roles) TO authenticated/);
  });
});