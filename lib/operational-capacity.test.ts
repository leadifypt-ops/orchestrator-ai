import assert from "node:assert/strict";
import { capacityDelta, hasActiveOverride, operationalNoteLabels } from "./operational-capacity";

assert.equal(capacityDelta(40, 28), -12);
assert.equal(capacityDelta(40, 55), 15);
assert.equal(capacityDelta(null, 20), null);
assert.equal(hasActiveOverride({ override_id: "override-1" }), true);
assert.equal(hasActiveOverride({ override_id: null }), false);
assert.equal(operationalNoteLabels.partial_kitchen, "Partial kitchen");

console.log("operational capacity tests passed");
