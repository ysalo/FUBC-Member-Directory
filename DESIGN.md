---
name: Church Directory native design
description: Native SwiftUI task surfaces for a private church directory
colors:
  icon-ground: "#005cc7"
  icon-foreground: "#ffffff"
typography:
  body:
    fontFamily: "SF Pro"
    fontSize: "17pt"
    fontWeight: 400
  secondary:
    fontFamily: "SF Pro"
    fontSize: "15pt"
    fontWeight: 400
spacing:
  row-content: "12pt"
  row-vertical: "4pt"
  detail-section: "16pt"
components:
  member-portrait:
    width: "44pt"
    height: "44pt"
---

## Overview

The implementation uses native Apple lists, forms, navigation stacks and system sheets. Directory search is the primary entry; role-specific care coordination stays in Visits and administration under Settings. This document describes source code, not a verified Simulator rendering. Mac build, screenshot and accessibility review remain release gates.

## Colors

Interface colors resolve through SwiftUI semantic values: blue tint, primary/secondary/tertiary content, red error text and green completion symbols. The operating system supplies light, dark and increased-contrast variants. The two fixed icon colors belong only to the new app icon, not interface backgrounds. State is also expressed in text or SF Symbols.

## Typography

Use system `.body`, `.subheadline`, `.headline`, `.caption`, `.title2` and large navigation titles. Font sizes above identify default Dynamic Type values; the SwiftUI text style, rather than a fixed point size, is authoritative. Person names may wrap. Ukrainian names are sorted with `uk_UA` independent of interface language. English and Ukrainian UI copy lives in `Localizable.xcstrings`.

## Layout

TabView contains Directory, Groups, conditional Visits and Settings; each has a NavigationStack. Reminders are reached through Directory and profiles. Lists retain platform insets, separators and disclosure indicators. Editors use Forms and Cancel/Save toolbars. Person rows use the spacing tokens above; the profile portrait grows to 112pt. System safe areas and back gestures are preserved.

## Elevation & Depth

Native sheets and navigation bars own depth. No custom shadows, decorative glass, transitions or animation are introduced. Platform motion follows system accessibility preferences.

## Shapes

Member portraits use circular cropping with an SF Symbol placeholder. Form and list containers follow the platform appearance. The app icon is an opaque original geometric church mark; iOS supplies its rounded mask.

## Components

MemberRow combines portrait, name and available phone. FailureNotice combines an error symbol and wrapping text; failures remain visible near the action that caused them. Empty states explain the next action. Forms disable duplicate submissions and surface backend failures. Consequential visit, account and group actions use system confirmation dialogs. Notification preferences are explicitly saved; operating-system permission is requested separately. Deletion acknowledgment says a request was received, not that the account is deleted.

## Do's and Don'ts

Do use standard controls, semantic colors, Dynamic Type, explicit state labels and SF Symbols. Do preserve native back navigation and generous touch targets. Do test English/Ukrainian, dark appearance and accessibility sizes on Simulator and hardware. Do not substitute browser screenshots for native evidence or treat preview data as a live service.
