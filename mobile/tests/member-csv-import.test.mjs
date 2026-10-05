import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMemberCsv, MemberCsvError } from '../supabase/functions/_shared/member-csv.ts';
import { createImportHandler } from '../supabase/functions/import-members/handler.ts';

const csv = 'first_name,last_name,patronymic,gender,email,phone,membership_joined_at,birth_date,address\r\nAndrew,Smith,,male,,(253) 555-1234,2010-01-01,1990-04-05,"123 Main St, Apt 2"\r\n';
test('CSV supports BOM, quoted delimiters/newlines/quotes, optional fields, and US phone normalization', () => {
  const rows = parseMemberCsv('\uFEFF' + csv);
  assert.equal(rows[0].first_name, 'Andrew');
  assert.equal(rows[0].gender, 'male');
  assert.equal(rows[0].phone, '2535551234');
  assert.equal(rows[0].patronymic, null);
  assert.equal(rows[0].address, '123 Main St, Apt 2');
  assert.equal(parseMemberCsv('first_name,last_name,gender,address\nMary,Smith,female,"Line 1\nLine ""2"""')[0].address, 'Line 1\nLine "2"');
});
test('CSV rejects invalid fields, dates, missing names, malformed CSV, and duplicate identities before importing', () => {
  for (const invalid of [
    'name,gender\nCombined,male', 'first_name,last_name,gender,photo_path\nA,B,male,private.jpg',
    'first_name,last_name,gender\nA,B,unknown', 'first_name,last_name,gender\n,B,male',
    'first_name,last_name,gender,birth_date\nA,B,male,2020-02-30',
    'first_name,last_name,gender,birth_date\nA,B,male,2999-01-01',
    'first_name,last_name,gender\nA,B,male\nA,B,male', 'first_name,last_name,gender\n"A,B,male',
    'first_name,last_name,gender\n"A"junk,B,male', 'first_name,last_name,gender\nA,B,male,extra',
  ]) assert.throws(() => parseMemberCsv(invalid), MemberCsvError);
});
function fixture({ role = 'admin', status = 'active', storageFailure = false, acknowledgementFailure = false, importFailure = false, uncertainFailure = false } = {}) {
  const calls = [];
  let pending = ['old/original.jpg', 'old/original.jpg.avatar-256.jpg', 'orphan.jpg'];
  const receipt = () => ({ importId: '60000000-0000-4000-8000-000000000001', importedCount: 1, replacedCount: 36, pendingPhotos: pending.length });
  const client = {
    auth: { async getUser() { return { data: { user: { id: 'admin' } }, error: null }; } },
    from(table) { assert.equal(table, 'profiles'); const query = { select() { return query; }, eq() { return query; }, async maybeSingle() { return { data: { role, status }, error: null }; } }; return query; },
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === 'import_members_from_csv' && uncertainFailure) return {data:null,error:{message:'Failed to fetch'}};
      if (name === 'import_members_from_csv') return importFailure ? { data: null, error: { message: 'Transaction failed', code: 'P0001' } } : { data: receipt(), error: null };
      if (name === 'member_import_receipt') return { data: receipt(), error: null };
      if (name === 'member_import_cleanup_batch') return { data: pending.map(path => ({ path })), error: null };
      if (name === 'member_import_cleanup_completed') {
        if (acknowledgementFailure) return { data: null, error: { message: 'Lost response' } };
        pending = pending.filter(path => !args.p_paths.includes(path)); return { data: pending.length, error: null };
      }
      throw new Error(`Unexpected RPC ${name}`);
    },
    storage: { from(bucket) { assert.equal(bucket, 'member-photos'); return { async remove(paths) { calls.push({ name: 'storage.remove', paths }); return { error: storageFailure ? { message: 'Unavailable' } : null }; } }; } },
  };
  const handler = createImportHandler(() => ({ caller: client, admin: client }));
  const request = (overrides = {}) => new Request('https://example.com/import-members', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify({ action: 'import', importId: receipt().importId, csv, mode: 'replace', confirmation: 'REPLACE MEMBERS', ...overrides }) });
  return { handler, request, calls };
}
test('import commits before metadata-only photo removal and returns counts with no member/photo payload', async () => {
  const f = fixture(); const response = await f.handler(f.request());
  assert.equal(response.status, 200); const result = await response.json();
  assert.equal(result.status, 'completed'); assert.equal(result.pendingPhotos, 0);
  assert.deepEqual(f.calls.map(call => call.name), ['import_members_from_csv', 'member_import_cleanup_batch', 'storage.remove', 'member_import_cleanup_completed']);
  assert.deepEqual(Object.keys(result).sort(), ['importId', 'importedCount', 'pendingPhotos', 'replacedCount', 'status']);
  assert.deepEqual(f.calls[2].paths, ['old/original.jpg', 'old/original.jpg.avatar-256.jpg', 'orphan.jpg']);
});
test('cleanup failures preserve confirmed import success and retry cleanup without another import', async () => {
  for (const failure of [{ storageFailure: true }, { acknowledgementFailure: true }]) {
    const f = fixture(failure); const result = await f.handler(f.request()).then(r => r.json());
    assert.equal(result.status, 'cleanup-pending'); assert.equal(result.importedCount, 1);
    f.calls.length = 0;
    await f.handler(f.request({ action: 'retry-cleanup', csv: undefined }));
    assert.equal(f.calls.some(call => call.name === 'import_members_from_csv'), false);
  }
});
test('invalid CSV, transaction failure, and nonadministrators never delete photos', async () => {
  for (const option of [{ role: 'editor' }, { status: 'pending' }, { importFailure: true }]) {
    const f = fixture(option); const response = await f.handler(f.request());
    assert.ok(response.status >= 400); assert.ok(!f.calls.some(call => call.name === 'storage.remove'));
  }
  const f = fixture(); const response = await f.handler(f.request({ csv: 'bad\nfile' }));
  assert.equal(response.status, 400); assert.equal(f.calls.length, 0);
});

test('an uncertain RPC transport failure requires retry with the same operation',async()=>{
  const f=fixture({uncertainFailure:true});const response=await f.handler(f.request());
  assert.equal(response.status,500);assert.ok(!f.calls.some(call=>call.name==='storage.remove'));
});
