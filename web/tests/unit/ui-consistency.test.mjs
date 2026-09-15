import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
async function load(path, overrides = {}) {
  const source = await readFile(
    new URL(`../../src/${path}`, import.meta.url),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", "document", code)(
    (name) => overrides[name] ?? require(name),
    compiled,
    compiled.exports,
    { body: {} },
  );
  return compiled.exports;
}
const link = {
  default: ({ children, ...props }) => createElement("a", props, children),
};
const i18n = await load("lib/i18n.ts");
const groups = await load("lib/group-copy.ts");
const photo = await load("components/member-photo.tsx");
const back = await load("components/back-button.tsx", {
  "@/components/navigation-link": link,
});
const person = {
  id: "60000000-0000-4000-8000-000000000001",
  firstName: "Test",
  lastName: "Member",
  name: "Test Member",
  photoPath: "/portrait.png",
  phone: "",
  address: "",
  dateOfBirth: "",
  membershipJoinedAt: "",
  maritalStatus: null,
  isOrphan: false,
  groupName: "",
  groupId: null,
};
const group = {
  id: "60000000-0000-4000-8000-000000000002",
  name: "Test group",
  memberIds: [person.id],
  deacons: [
    { id: "linked", name: person.name, personId: person.id, status: "active" },
    {
      id: "unlinked",
      name: "Unlinked Deacon",
      personId: null,
      status: "active",
    },
  ],
};

test("shared back control uses an accessible label for links and actions", () => {
  for (const props of [{ href: "/groups" }, { onClick() {} }]) {
    const html = renderToStaticMarkup(
      createElement(back.default, { ...props, label: "Back" }),
    );
    assert.match(html, /aria-label="Back"/);
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /size-11/);
    assert.doesNotMatch(html, /←/);
  }
});

test("group browser links deacons to member pages separately from group links", async () => {
  const browser = await load("components/groups-browser.tsx", {
    "@/components/navigation-link": link,
    "@/components/member-photo": photo,
    "@/lib/group-copy": groups,
  });
  const html = renderToStaticMarkup(
    createElement(browser.default, {
      groups: [group],
      deacons: [person],
      isDeacon: true,
      ledGroupId: group.id,
      locale: "en",
    }),
  );
  assert.match(html, new RegExp(`href="/groups/${group.id}"`));
  assert.match(
    html,
    new RegExp(`href="/members/${person.id}\\?group=${group.id}"`),
  );
  assert.match(html, /src="\/portrait.png"/);
  assert.match(html, /Profile not linked/);
  assert.doesNotMatch(html, /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/);
  assert.doesNotMatch(html, /href="[^"]*(?:null|undefined|unlinked)/);
});

test("member page preserves navigation and group back destination", async () => {
  const directory = await load("components/directory-client.tsx", {
    "next/navigation": { useRouter: () => ({ push() {} }) },
    "@/components/navigation-link": link,
    "@/components/back-button": back,
    "@/components/member-photo": photo,
    "@/components/bottom-navigation": {
      default: () => createElement("nav", {}, "Menu"),
    },
    "@/components/birthday-notification-demo": { default: () => null },
    "@/lib/group-copy": groups,
    "@/lib/i18n": i18n,
    "@/lib/birthdays": await load("lib/birthdays.ts"),
    "@/lib/visitation": await load("lib/visitation.ts"),
  });
  const html = renderToStaticMarkup(
    createElement(directory.default, {
      members: [person],
      initialMember: person,
      backHref: `/groups/${group.id}`,
      locale: "en",
      role: "member",
      isPastor: true,
      today: "2026-09-15",
      currentUser: {
        name: person.name,
        email: "",
        personId: person.id,
        photoPath: person.photoPath,
      },
    }),
  );
  assert.match(html, /<nav>Menu<\/nav>/);
  assert.match(html, new RegExp(`href="/groups/${group.id}"`));
  assert.match(
    html,
    new RegExp(`href="/visitation/new\\?person=${person.id}"`),
  );
  assert.doesNotMatch(html, /Request visit/);
  assert.match(html, /Test Member/);
});

test("all loading layouts use localized accessible status and themed skeletons", async () => {
  for (const locale of ["en", "uk"]) {
    const loading = await load("components/app-loading.tsx", {
      "@/lib/locale": { getLocale: async () => locale },
    });
    for (const layout of [
      "directory",
      "groups",
      "group-detail",
      "member",
      "member-edit",
      "login",
      "visits",
      "visit-detail",
      "visit-form",
      "visit-edit",
      "management",
    ]) {
      const html = renderToStaticMarkup(await loading.default({ layout }));
      assert.match(html, /role="status"/);
      assert.match(html, /aria-busy="true"/);
      assert.match(html, /aria-hidden="true"/);
      assert.match(html, /motion-safe:animate-pulse/);
      assert.match(html, locale === "uk" ? /Завантаження…/ : /Loading…/);
    }
  }
});

test("menu identity prefers the linked member photo and falls back for unlinked accounts", async () => {
  const { loadNavigationUser } = await load("lib/navigation-user.ts", {
    "@/lib/visit-photos": {
      loadVisitPhotos: async () => new Map([[person.id, "/member-photo.png"]]),
    },
  });
  const profile = {
    person_id: person.id,
    display_name: "Account name",
    email: "member@example.invalid",
    avatar_url: "/provider-photo.png",
  };
  const client = (record) => ({
    from(table) {
      assert.equal(table, "people");
      return {
        select() {
          return this;
        },
        eq(field, value) {
          assert.equal(field, "id");
          assert.equal(value, person.id);
          return this;
        },
        is(field, value) {
          assert.equal(field, "archived_at");
          assert.equal(value, null);
          return this;
        },
        async maybeSingle() {
          return { data: record };
        },
      };
    },
  });
  const linked = await loadNavigationUser(
    client({
      id: person.id,
      first_name: person.firstName,
      last_name: person.lastName,
    }),
    profile,
  );
  assert.equal(linked.name, person.name);
  assert.equal(linked.personId, person.id);
  assert.equal(linked.photoPath, "/member-photo.png");
  const archived = await loadNavigationUser(client(null), profile);
  assert.equal(archived.personId, null);
  assert.equal(archived.name, profile.display_name);
  assert.equal(archived.photoPath, profile.avatar_url);
  const unlinked = await loadNavigationUser(
    {
      from() {
        assert.fail("Unlinked accounts should not query member records");
      },
    },
    { ...profile, person_id: null, avatar_url: null },
  );
  assert.equal(unlinked.personId, null);
  assert.equal(unlinked.photoPath, null);
});

test("Menu shows identity and photo and stays available on member-edit pages", async () => {
  const react = require("react");
  const navigation = await load("components/bottom-navigation.tsx", {
    react: {
      ...react,
      useState: (initial) => react.useState(initial === false ? true : initial),
    },
    "react-dom": { createPortal: (children) => children },
    "next/navigation": { usePathname: () => `/admin/${person.id}` },
    "@/components/navigation-link": link,
    "@/components/member-photo": photo,
    "@/components/language-switcher": { default: () => null },
    "@/components/appearance-settings": { default: () => null },
    "@/components/sign-out-button": {
      default: ({ label }) => createElement("button", {}, label),
    },
    "@/app/visitation/actions": { pendingVisitCount: async () => 0 },
    "@/lib/group-copy": groups,
    "@/lib/i18n": i18n,
    "@/lib/visitation": await load("lib/visitation.ts"),
  });
  for (const personId of [person.id, null]) {
    const html = renderToStaticMarkup(
      createElement(navigation.default, {
        role: "admin",
        isDeacon: false,
        locale: "en",
        currentUser: {
          personId,
          name: person.name,
          email: "member@example.invalid",
          photoPath: "/portrait.png",
        },
      }),
    );
    assert.match(html, /aria-label="Main navigation"/);
    assert.match(html, /role="dialog"/);
    assert.match(html, /aria-modal="true"/);
    assert.match(html, /Close menu/);
    assert.match(html, /Signed in as/);
    assert.match(html, /Test Member/);
    assert.match(html, /src="\/portrait.png"/);
    if (personId) assert.match(html, new RegExp(`href="/members/${personId}"`));
    else {
      assert.match(html, /Not linked/);
      assert.doesNotMatch(html, /href="\/members\//);
    }
  }
});
