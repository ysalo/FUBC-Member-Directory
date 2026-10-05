import test from 'node:test';
import assert from 'node:assert/strict';
import { memberSearchScore, normalizeMemberSearch } from '../src/lib/member-search.ts';
const member = { name: 'Mary Jane van der Berg', first_name: 'Mary Jane', last_name: 'van der Berg', patronymic: 'Ivanivna' };
test('first and last name matching ignores order, punctuation, accents and extra spaces', () => {
  for (const query of ['Mary', 'Berg', 'berg mary', '  MARY   BERG ', 'mar ber', 'van der', 'Jane Mary', 'Mary Ivanivna Berg']) assert.notEqual(memberSearchScore(member, query), null, query);
  assert.notEqual(memberSearchScore({ name: 'José O’Neil', first_name: 'José', last_name: 'O’Neil' }, 'jose oneil'), null);
  assert.notEqual(memberSearchScore({ name: 'Anna Smith-Jones' }, 'anna smithjones'), null);
  assert.equal(normalizeMemberSearch('О\u0301лена   Петренко'), 'олена петренко');
});
test('long names tolerate a single insertion, deletion, replacement or transposition', () => {
  for (const query of ['Petrenk', 'Petrneko', 'Petranko', 'Petrrenko']) assert.notEqual(memberSearchScore({ name: 'Olena Petrenko' }, query), null, query);
  assert.equal(memberSearchScore({ name: 'Olena Petrenko' }, 'Patranko'), null);
  assert.equal(memberSearchScore({ name: 'Mary Berg' }, 'max'), null);
  assert.equal(memberSearchScore(member, 'Mary Mary'), null);
  assert.equal(memberSearchScore(member, 'Choir'), null);
});
test('exact names score ahead of prefixes and typos, with Ukrainian name support', () => {
  assert.ok(memberSearchScore({ name: 'Mary Berg' }, 'Mary') < memberSearchScore({ name: 'Maryanne Berg' }, 'Mary'));
  assert.notEqual(memberSearchScore({ name: 'Олена Петренко', first_name: 'Олена', last_name: 'Петренко' }, 'петренко оле'), null);
  assert.notEqual(memberSearchScore({ name: 'Олена Петренко' }, 'Петренк'), null);
  assert.notEqual(memberSearchScore({ name: 'Олена Cавчук', first_name: 'Олена', last_name: 'Cавчук' }, 'сав олена'), null);
  assert.equal(memberSearchScore(member, ''), 0);
});
