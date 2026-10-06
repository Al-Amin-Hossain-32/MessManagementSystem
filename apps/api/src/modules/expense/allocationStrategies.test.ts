import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { allocationStrategies } from './allocationStrategies';

const boarder = (boarderMembershipId: string, weightedMeals: number) => ({
  boarderMembershipId,
  weightedMeals: new Prisma.Decimal(weightedMeals),
});

test('equal split reconciles every paisa after rounding', () => {
  const allocation = allocationStrategies.EQUAL_SPLIT.allocate(new Prisma.Decimal('10.00'), [
    boarder('one', 1),
    boarder('two', 1),
    boarder('three', 1),
  ]);

  assert.deepEqual(
    allocation.map((row) => row.allocatedAmount.toFixed(2)),
    ['3.33', '3.33', '3.34'],
  );
  assert.equal(
    allocation
      .reduce((total, row) => total.add(row.allocatedAmount), new Prisma.Decimal(0))
      .toFixed(2),
    '10.00',
  );
});

test('meal-proportional allocation skips zero-weight members and reconciles totals', () => {
  const allocation = allocationStrategies.MEAL_PROPORTIONAL.allocate(new Prisma.Decimal('10.00'), [
    boarder('one', 1),
    boarder('two', 2),
    boarder('inactive', 0),
  ]);

  assert.deepEqual(
    allocation.map((row) => [row.boarderMembershipId, row.allocatedAmount.toFixed(2)]),
    [
      ['one', '3.33'],
      ['two', '6.67'],
    ],
  );
});

test('meal-proportional allocation does not invent charges when all weights are zero', () => {
  const allocation = allocationStrategies.MEAL_PROPORTIONAL.allocate(new Prisma.Decimal('10.00'), [
    boarder('one', 0),
  ]);

  assert.deepEqual(allocation, []);
});

test('direct charge assigns the exact amount only to the selected member', () => {
  const allocation = allocationStrategies.DIRECT_CHARGE.allocate(
    new Prisma.Decimal('12.34'),
    [boarder('other', 1)],
    'selected',
  );

  assert.equal(allocation.length, 1);
  assert.equal(allocation[0].boarderMembershipId, 'selected');
  assert.equal(allocation[0].allocatedAmount.toFixed(2), '12.34');
});
