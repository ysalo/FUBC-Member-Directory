import assert from "node:assert/strict";
import test from "node:test";
import { shareBrowserContact } from "../src/features/platform/browser-share.ts";
import { acceptsDateFieldValue, localDateValue } from "../src/features/forms/date-field.ts";
import { birthdayNotificationsSupported, disableBirthdayNotifications, syncBirthdayNotifications } from "../src/features/groups/birthday-notifications.web.ts";
import { Alert, dismissAllWebAlerts } from "../src/features/platform/alert.web.ts";

test("browser share sends only the requested contact and does not copy after cancellation", async () => {
  let copied = false;
  const data = [];
  assert.equal(await shareBrowserContact("Jane\n123", "Jane", { share: async (value) => { data.push(value); } }), "shared");
  assert.deepEqual(data, [{ title: "Jane", text: "Jane\n123" }]);
  assert.equal(await shareBrowserContact("Jane", "Jane", {
    share: async () => { throw new DOMException("Canceled", "AbortError"); },
    clipboard: { writeText: async () => { copied = true; } },
  }), "dismissed");
  assert.equal(copied, false);
});

test("unsupported browser share copies the complete contact and reports denied clipboard access", async () => {
  const copied = [];
  assert.equal(await shareBrowserContact("Jane\nPhone: 123", "Jane", {
    clipboard: { writeText: async (value) => { copied.push(value); } },
  }), "copied");
  assert.deepEqual(copied, ["Jane\nPhone: 123"]);
  await assert.rejects(shareBrowserContact("Jane", "Jane", {}), /unavailable/);
  await assert.rejects(shareBrowserContact("Jane", "Jane", {
    clipboard: { writeText: async () => { throw new Error("denied"); } },
  }), /denied/);
});

test("share failures remain errors rather than reporting false success", async () => {
  await assert.rejects(shareBrowserContact("Jane", "Jane", {
    share: async () => { throw new Error("blocked"); },
  }), /blocked/);
});

test("web dates honor the local calendar and birthday maximum without timezone conversion", () => {
  const maximum = localDateValue(new Date(2026, 8, 19, 23, 59));
  assert.equal(maximum, "2026-09-19");
  assert.equal(acceptsDateFieldValue(maximum, "date", maximum), true);
  assert.equal(acceptsDateFieldValue("2026-09-20", "date", maximum), false);
  assert.equal(acceptsDateFieldValue("2024-02-29", "date", maximum), true);
  for (const value of ["2026-02-29", "2026-13-01", "2026-04-31", "2026-1-01"]) {
    assert.equal(acceptsDateFieldValue(value, "date", maximum), false, value);
  }
  assert.equal(acceptsDateFieldValue("", "date", maximum), true);
});

test("web time accepts midnight and last minute but rejects overflow", () => {
  for (const value of ["00:00", "23:59", "09:30", ""]) assert.equal(acceptsDateFieldValue(value, "time"), true);
  for (const value of ["24:00", "09:60", "9:30", "12:30:01"]) assert.equal(acceptsDateFieldValue(value, "time"), false);
});

test("web reminders are unsupported and callable without native modules or permission APIs", async () => {
  assert.equal(birthdayNotificationsSupported, false);
  // Importing and invoking this adapter in Node also verifies that it never loads
  // Expo Notifications, a browser Notification object, or a Supabase client.
  await syncBirthdayNotifications("group", [], "en", true);
  await disableBirthdayNotifications("group");
});

test("dialog cleanup removes private content and disables stale actions without confirming or canceling", () => {
  // Minimal DOM host tests adapter lifecycle; browser QA verifies native focus trapping.
  const elements = [];
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.listeners = {}; this.isConnected = true; elements.push(this); }
    setAttribute() {}
    append(...children) { this.children.push(...children); }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    querySelector(selector) { return this.children.find((child) => selector.includes(":not") ? child.dataset.kind !== "destructive" : child.dataset.kind === "cancel"); }
    focus() {}
    showModal() { this.open = true; }
    close() { this.open = false; }
    remove() { this.isConnected = false; }
  }
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalElement = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
  Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: Element });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { activeElement: null, body: new Element("body"), createElement: (tag) => new Element(tag) } });
  let confirms = 0;
  let cancels = 0;
  let dismisses = 0;
  const openDialog = () => Alert.alert("Private group", "Delete this group?", [
    { text: "Cancel", style: "cancel", onPress: () => { cancels++; } },
    { text: "Delete", style: "destructive", onPress: () => { confirms++; } },
  ], { onDismiss: () => { dismisses++; } });
  try {
    openDialog();
    openDialog();
    const dialogs = elements.filter((element) => element.tag === "dialog");
    const staleActions = elements.filter((element) => element.tag === "button");
    dismissAllWebAlerts();
    dismissAllWebAlerts();
    for (const dialog of dialogs) assert.equal(dialog.isConnected || dialog.open, false);
    for (const action of staleActions) action.onclick();
    assert.deepEqual([confirms, cancels, dismisses], [0, 0, 0]);
    openDialog();
    const active = elements.filter((element) => element.tag === "dialog").at(-1);
    active.listeners.cancel({ preventDefault() {} });
    assert.deepEqual([confirms, cancels, dismisses], [0, 1, 1]);
    assert.equal(active.isConnected, false);
  } finally {
    dismissAllWebAlerts();
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument); else delete globalThis.document;
    if (originalElement) Object.defineProperty(globalThis, "HTMLElement", originalElement); else delete globalThis.HTMLElement;
  }
});
