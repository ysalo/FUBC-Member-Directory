import assert from "node:assert/strict";
import test from "node:test";

import { partitionGroups } from "../src/features/groups/groups-display.ts";

const group = (id, deacons = []) => ({ id, name: id, nameUk: id, description: "", descriptionUk: "", kind: "membership", responsibleDeaconIds: deacons, memberIds: [] });

test("the signed-in deacon's group is separated from the browse list", () => {
  const result = partitionGroups([group("one"), group("two", ["deacon"]), group("three")], "deacon");
  assert.equal(result.assigned?.id, "two");
  assert.deepEqual(result.others.map((item) => item.id), ["one", "three"]);
});
