import test from 'node:test';
import assert from 'node:assert/strict';
import { memberSearchScore, normalizeMemberSearch, searchMembers } from '../src/lib/member-search.ts';
const member = { name: 'Mary Jane van der Berg', first_name: 'Mary Jane', last_name: 'van der Berg', patronymic: 'Ivanivna' };
test('first and last name matching ignores order, punctuation, accents and extra spaces', () => {
  for (const query of ['Mary', 'Berg', 'berg mary', '  MARY   BERG ', 'mar ber', 'van der', 'Jane Mary', 'Mary Ivanivna Berg']) assert.notEqual(memberSearchScore(member, query), null, query);
  assert.notEqual(memberSearchScore({ name: 'José O’Neil', first_name: 'José', last_name: 'O’Neil' }, 'jose oneil'), null);
  assert.notEqual(memberSearchScore({ name: 'Anna Smith-Jones' }, 'anna smithjones'), null);
  assert.equal(normalizeMemberSearch('О\u0301лена   Петренко'), 'олена петренко');
});
test('name search rejects substrings and fuzzy names', () => {
  for (const [name, query] of [['Drew Smith', 'Andrew'], ['Andrew Smith', 'Drew'], ['Andrew Smith', 'ndrew'], ['Mary Berg', 'Mory'], ['Alexandrew Smith', 'Andrew']]) assert.equal(memberSearchScore({ name }, query), null, `${name}: ${query}`);
  assert.equal(memberSearchScore(member, 'Mary Mary'), null);
  assert.equal(memberSearchScore(member, 'Choir'), null);
});
test('exact names score ahead of prefixes, with Ukrainian name support', () => {
  assert.ok(memberSearchScore({ name: 'Mary Berg' }, 'Mary') < memberSearchScore({ name: 'Maryanne Berg' }, 'Mary'));
  assert.notEqual(memberSearchScore({ name: 'Олена Петренко', first_name: 'Олена', last_name: 'Петренко' }, 'петренко оле'), null);
  assert.notEqual(memberSearchScore({ name: 'Олена Петренко' }, 'Петренк'), null);
  assert.notEqual(memberSearchScore({ name: 'Олена Cавчук', first_name: 'Олена', last_name: 'Cавчук' }, 'сав олена'), null);
  assert.equal(memberSearchScore(member, ''), 0);
});

test('ranked results put exact names before prefixes regardless of surname order', () => {
  const people = [{ name: 'Andrews Alpha' }, { name: 'Drew Baker' }, { name: 'Andrew Zulu' }, { name: 'Andrew Zee' }];
  assert.deepEqual(searchMembers(people, 'Andrew', person => person).map(person => person.name), ['Andrew Zulu', 'Andrew Zee', 'Andrews Alpha']);
  assert.deepEqual(searchMembers(people, 'Drew', person => person).map(person => person.name), ['Drew Baker']);
  assert.deepEqual(searchMembers(people, '', person => person), people);
});
