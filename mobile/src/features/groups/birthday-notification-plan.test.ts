import { birthdayTrigger, BIRTHDAY_NOTIFICATION_TIME_ZONE, upcomingBirthdays } from "./birthday-notification-plan";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function equal<T>(actual: T, expected: T, message: string) { if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`); }

const tests = [
  {
    name: "upcoming birthdays are the seven PDT calendar dates beginning today",
    run: () => {
      const birthdays = [
        { id: "today", name: "Today", month: 12, day: 30 },
        { id: "six", name: "Six days", month: 1, day: 5 },
        { id: "seven", name: "Seven days", month: 1, day: 6 },
      ];
      const ids = upcomingBirthdays(birthdays, new Date("2026-12-30T08:00:00Z")).map((item) => item.id);
      assert(ids.length === 2 && ids[0] === "today" && ids[1] === "six", "The seven-day PDT window is incorrect");
    },
  },
  {
    name: "birthday notification repeats annually at 9 AM fixed PDT",
    run: () => {
      const trigger = birthdayTrigger({ month: 6, day: 15 });
      equal(trigger.type, "calendar", "Trigger type");
      equal(trigger.month, 6, "Trigger month");
      equal(trigger.day, 15, "Trigger day");
      equal(trigger.hour, 9, "Trigger hour");
      equal(trigger.minute, 0, "Trigger minute");
      equal(trigger.timezone, "Etc/GMT+7", "Trigger timezone");
      equal(BIRTHDAY_NOTIFICATION_TIME_ZONE, "Etc/GMT+7", "PDT timezone");
      equal(trigger.repeats, true, "Annual repeat");
    },
  },
];

async function run() {
  let failures = 0;
  for (const test of tests) {
    try { await test.run(); console.log(`✓ ${test.name}`); }
    catch (error) { failures += 1; console.error(`✗ ${test.name}`); console.error(error); }
  }
  if (failures) throw new Error(`${failures} group birthday test(s) failed.`);
}

void run();
