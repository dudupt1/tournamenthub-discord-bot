import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBracket, reportWinner } from '../src/features/tournaments.js';

function teams(amount) {
  return Array.from({ length: amount }, (_, index) => ({ id: `T${index + 1}`, name: `Team ${index + 1}` }));
}

test('buildBracket produces first-round teams and future placeholders', () => {
  const rounds = buildBracket(teams(4));
  assert.equal(rounds.length, 2);
  assert.deepEqual(rounds[0][0], { id: 'R1-M1', teamA: 'T1', teamB: 'T2', winner: null });
  assert.deepEqual(rounds[1][0], { id: 'R2-M1', teamA: null, teamB: null, winner: null });
});

test('reportWinner advances winners and declares a champion after the final', () => {
  const tournament = { rounds: buildBracket(teams(4)), status: 'active', champion: null };
  assert.equal(reportWinner(tournament, 'R1-M1', 'T1').ok, true);
  assert.equal(reportWinner(tournament, 'R1-M2', 'T3').ok, true);
  assert.deepEqual(tournament.rounds[1][0], { id: 'R2-M1', teamA: 'T1', teamB: 'T3', winner: null });

  const final = reportWinner(tournament, 'R2-M1', 'T1');
  assert.equal(final.champion, true);
  assert.equal(tournament.champion, 'T1');
  assert.equal(tournament.status, 'complete');
});
