import test from 'node:test';
import assert from 'node:assert/strict';
import { receiptTitle, receiptTime } from '../src/lib/wallet-receipt.ts';

test('receipt labels distinguish topup, incoming, outgoing and compensation', () => {
  assert.equal(receiptTitle({kind:'TOPUP',direction:'CREDIT'}),'Simulated top up');
  assert.equal(receiptTitle({kind:'TRANSFER',direction:'DEBIT'}),'Money sent');
  assert.equal(receiptTitle({kind:'TRANSFER',direction:'CREDIT'}),'Money received');
  assert.equal(receiptTitle({kind:'REVERSAL',direction:'CREDIT'}),'Transaction correction');
});
test('receipt time uses Jakarta and handles invalid data honestly', () => {
  assert.match(receiptTime('2026-10-09T18:00:00Z'), /10 Oct 2026/);
  assert.match(receiptTime('2026-10-09T18:00:00Z'), /01:00:00/);
  assert.equal(receiptTime('invalid'),'Time unavailable');
});
