import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('drizzle/migrations/0001_repair_video_schema_and_project_credit_transactions.sql', 'utf8');

describe('Project processing credit protection', () => {
  it('requires owner role and unlimited credits for the bypass', () => {
    expect(sql).toContain("IF p.unlimited_credits AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p.id AND role = 'owner_admin')");
    expect(sql).toContain("VALUES (p.id, 0, 'project_processing_unlimited', project.id)");
  });
  it('rejects suspended accounts before reserving credits', () => {
    expect(sql).toContain("IF NOT FOUND OR p.suspended THEN RAISE EXCEPTION 'Account unavailable'");
  });
  it('does not expose refunds to browser callers', () => {
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.refund_processing_for_project(uuid,uuid,bigint,text) FROM PUBLIC, anon, authenticated');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.refund_processing_for_project(uuid,uuid,bigint,text) TO service_role');
  });
});