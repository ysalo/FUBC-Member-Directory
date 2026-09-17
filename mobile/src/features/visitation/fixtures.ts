import type { VisitActor, VisitDeacon, VisitPerson, VisitRecord } from "./types";

export const visitationActors: VisitActor[] = [
  { id: "pastor-olena", displayName: "Olena Kovalenko", designation: "pastor", role: "member", status: "active", revision: 1 },
  { id: "deacon-marko", displayName: "Marko Melnyk", designation: "deacon", role: "member", status: "active", revision: 1 },
  { id: "deacon-leah", displayName: "Leah Thompson", designation: "deacon", role: "editor", status: "active", revision: 1 },
];

export const visitationPeople: VisitPerson[] = [
  {
    id: "marta-kovalenko",
    name: "Marta Kovalenko",
    phone: "+1 (916) 555-0138",
    address: "2480 Fair Oaks Boulevard, Sacramento, CA",
    responsibilityGroupId: "responsibility-east",
  },
  {
    id: "daniel-brooks",
    name: "Daniel Brooks",
    phone: "+1 (916) 555-0182",
    address: "1017 48th Street, Sacramento, CA",
    responsibilityGroupId: "responsibility-central",
  },
  {
    id: "amelia-carter",
    name: "Amelia Carter",
    phone: null,
    address: "3900 J Street, Sacramento, CA",
    responsibilityGroupId: null,
  },
];

export const visitationDeacons: VisitDeacon[] = [
  { accountId: "deacon-marko", personId: "marko-melnyk", name: "Marko Melnyk", responsibilityGroupId: "responsibility-east" },
  { accountId: "deacon-leah", personId: "leah-thompson", name: "Leah Thompson", responsibilityGroupId: "responsibility-central" },
];

export const visitationVisits: VisitRecord[] = [
  {
    id: "visit-marta",
    pastorId: "pastor-olena",
    personId: "marta-kovalenko",
    pastorName: "Olena Kovalenko",
    memberName: "Marta Kovalenko",
    memberPhone: "+1 (916) 555-0138",
    scheduledAt: "2027-01-16T01:30:00.000Z",
    location: "2480 Fair Oaks Boulevard, Sacramento, CA",
    notes: "Meet at the front entrance.",
    status: "open",
    archivedAt: null,
    completedAt: null,
    revision: 2,
    submissionId: "fixture-marta",
    updatedFields: ["location"],
    recipients: [
      {
        accountId: "deacon-marko",
        deaconName: "Marko Melnyk",
        deaconPersonId: "marko-melnyk",
        response: "pending",
        reason: null,
        lastViewedRevision: 1,
      },
      {
        accountId: "deacon-leah",
        deaconName: "Leah Thompson",
        deaconPersonId: "leah-thompson",
        response: "accepted",
        reason: null,
        lastViewedRevision: 2,
      },
    ],
  },
  {
    id: "visit-daniel",
    pastorId: "pastor-olena",
    personId: "daniel-brooks",
    pastorName: "Olena Kovalenko",
    memberName: "Daniel Brooks",
    memberPhone: "+1 (916) 555-0182",
    scheduledAt: "2026-09-13T22:00:00.000Z",
    location: "Mercy General Hospital, main lobby",
    notes: "",
    status: "completed",
    archivedAt: null,
    completedAt: "2026-09-13T23:20:00.000Z",
    revision: 3,
    submissionId: "fixture-daniel",
    updatedFields: [],
    recipients: [
      {
        accountId: "deacon-marko",
        deaconName: "Marko Melnyk",
        deaconPersonId: "marko-melnyk",
        response: "accepted",
        reason: null,
        lastViewedRevision: 3,
      },
    ],
  },
  {
    id: "visit-amelia",
    pastorId: "pastor-olena",
    personId: "amelia-carter",
    pastorName: "Olena Kovalenko",
    memberName: "Amelia Carter",
    memberPhone: null,
    scheduledAt: "2026-09-08T17:00:00.000Z",
    location: "3900 J Street, Sacramento, CA",
    notes: "Reschedule when the family is available.",
    status: "cancelled",
    archivedAt: "2026-09-09T17:00:00.000Z",
    completedAt: null,
    revision: 3,
    submissionId: "fixture-amelia",
    updatedFields: [],
    recipients: [
      {
        accountId: "deacon-marko",
        deaconName: "Marko Melnyk",
        deaconPersonId: "marko-melnyk",
        response: "declined",
        reason: "Already committed to another visit.",
        lastViewedRevision: 2,
      },
    ],
  },
];
