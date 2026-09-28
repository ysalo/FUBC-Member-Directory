# Family relationships

Status: accepted by the requester on September 28, 2026. The design interview is complete; feature implementation is separate work.

## Confirmed requirements

- Family connections involve member records only. Accept gaps in extended-family inference when connecting relatives are not members.
- The member profile shows parents, children, spouse, and siblings who are members.
- A parent is selected from the member list. An administrator can create a member during selection and then use that record as the parent.
- The primary connections should support a future connected graph and derived relationships such as cousins and in-laws.
- Ended-marriage history is deferred for this scope; no historical marriage behavior has been agreed.
- Primary relationships are edited on the Manage screen.
- Parent connections have no subtype or fixed parent-count maximum. Their inverse child connection appears automatically. Reject self-links and ancestry cycles.
- Administrators may explicitly connect siblings even when no parent is a member. Also infer siblings, including half-siblings, from at least one shared recorded parent. Explicit sibling connections do not propagate parent assignments or additional sibling connections.
- Spouse is an optional reciprocal connection with at most one current spouse per member. A conflicting existing spouse must be corrected before a new connection is established. Administrators can remove connections for corrections; dates and marriage history are out of scope.
- The initial feature includes relationship editing and profile family display, including derived siblings. A graph view and cousin/in-law labels are deferred; the primary relationships must support later traversal.
- Both active Administrators and Member Administrators may manage relationships, following existing member-edit permissions. Directory readers may view family relationships.
- Inline member creation is available when selecting any parent, child, spouse, or sibling. Require the existing creation fields (first name, last name, gender), save the member, and return with that member selected while preserving the original edits. Canceling the relationship edit afterward does not delete the newly created member.
- Manage distinguishes explicit sibling connections from inferred siblings. An inferred sibling connection is corrected through its supporting parent connections; removing an explicit sibling connection does not suppress an inference still supported by a shared parent.
- Archived relatives are hidden from ordinary profile family display. Their connections remain stored and visible, clearly marked, in Manage; unarchiving restores display.
- Profiles have one Family section immediately below Contact with Parents, Spouse, Children, and Siblings categories. Use these category labels regardless of gender, with English and Ukrainian translations. Each relative has a photo and name linking to their profile. Hide empty categories and the entire section when empty.
- The Family editor has its own Save and Cancel actions. Save relationship changes atomically. If another administrator changes affected relationships, require a refresh instead of overwriting their work. Inline creation remains a separate member save.
- Permanent member deletion removes that member's family connections. Warn in the existing deletion confirmation that inferred relationships may disappear as a result. Archiving preserves connections.
- Inline member creation suggests existing members with matching names and allows selecting one instead. A matching name never blocks creation of a different member.

## Deferred validation

Checks for spouse connections between siblings or ancestors/descendants, and sibling connections between ancestors/descendants, are deferred. This does not remove the agreed self-link, ancestry-cycle, and single-current-spouse constraints.

## Domain references

See the [glossary](../../CONTEXT.md) and [member-only relationship decision](../adr/0001-member-only-family-relationships.md).

## Delivery

Documentation is delivered on `docs/family-relationships`, branched from `dev`, through a documentation PR into `dev`. Feature implementation and release have not been performed for this design interview. Follow the repository feature-to-dev PR, Preview validation, and review workflow for implementation; coordinate backend readiness and rollback compatibility before production release.
