import { isOpenNow, getTodayHours, getWeekHours } from './hours';

const operatingHours = {
  Monday: { open: '08:00', close: '22:00' },
  Tuesday: { open: '08:00', close: '22:00' },
  Wednesday: { open: '08:00', close: '22:00' },
  Thursday: { open: '08:00', close: '22:00' },
  Friday: { open: '08:00', close: '23:00' },
  Saturday: { open: '10:00', close: '23:00' },
  Sunday: { open: '10:00', close: '22:00' },
};

const overnightHours = {
  Monday: { open: '20:00', close: '02:00' },
  Tuesday: { open: '20:00', close: '02:00' },
  Wednesday: { open: '20:00', close: '02:00' },
  Thursday: { open: '20:00', close: '02:00' },
  Friday: { open: '20:00', close: '03:00' },
  Saturday: { open: '20:00', close: '03:00' },
  Sunday: { open: '20:00', close: '02:00' },
};

function testIsOpenNow() {
  const timezone = 'Asia/Dubai';

  // Test: Open (Monday 10:00)
  const mondayOpen = new Date('2024-01-08T10:00:00'); // Monday 10 AM
  const result1 = isOpenNow(operatingHours, timezone, mondayOpen);
  console.assert(result1 === true, 'Should be open on Monday at 10:00');

  // Test: Closed (Monday 23:00)
  const mondayClose = new Date('2024-01-08T23:00:00'); // Monday 11 PM
  const result2 = isOpenNow(operatingHours, timezone, mondayClose);
  console.assert(result2 === false, 'Should be closed on Monday at 23:00');

  // Test: Overnight (Monday 23:30 in overnight hours)
  const midnightOvernight = new Date('2024-01-08T23:30:00'); // Monday 11:30 PM
  const result3 = isOpenNow(overnightHours, timezone, midnightOvernight);
  console.assert(result3 === true, 'Should be open on Monday at 23:30 with overnight hours');

  // Test: Overnight after closing (Monday 03:30 in overnight hours)
  const afterOvernight = new Date('2024-01-09T03:30:00'); // Tuesday 3:30 AM
  const result4 = isOpenNow(overnightHours, timezone, afterOvernight);
  console.assert(result4 === false, 'Should be closed on Tuesday at 03:30 with overnight hours');

  // Test: Missing hours
  const result5 = isOpenNow(null, timezone, mondayOpen);
  console.assert(result5 === null, 'Should return null for missing hours');

  console.log('✓ isOpenNow tests passed');
}

function testGetTodayHours() {
  const timezone = 'Asia/Dubai';
  const mondayOpen = new Date('2024-01-08T10:00:00'); // Monday

  const hours = getTodayHours(operatingHours, timezone, mondayOpen);
  console.assert(hours?.open === '08:00', 'Should get Monday open time');
  console.assert(hours?.close === '22:00', 'Should get Monday close time');

  const nullHours = getTodayHours(null, timezone, mondayOpen);
  console.assert(nullHours === null, 'Should return null for missing hours');

  console.log('✓ getTodayHours tests passed');
}

function testGetWeekHours() {
  const weekHours = getWeekHours(operatingHours);
  console.assert(weekHours?.length === 7, 'Should return 7 days');
  console.assert(weekHours?.[0].day === 'Sunday', 'First day should be Sunday');
  console.assert(weekHours?.[1].day === 'Monday', 'Second day should be Monday');

  const nullWeekHours = getWeekHours(null);
  console.assert(nullWeekHours === null, 'Should return null for missing hours');

  console.log('✓ getWeekHours tests passed');
}

testIsOpenNow();
testGetTodayHours();
testGetWeekHours();

console.log('\n✅ All hours tests passed');
