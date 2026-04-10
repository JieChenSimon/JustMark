# Design System: JustMark

## 1. Visual Theme & Atmosphere

JustMark is a writing-first desktop application for people who want the interface to disappear. The visual language should feel like a native macOS tool that happens to be exceptionally calm: light gray window chrome, soft translucent panels, paper-like editing surfaces, and a restrained blue reserved for moments of interaction. The product is not a dashboard and not a marketing site. It is a quiet writing room.

This system is primarily inspired by the reductive discipline of Apple's product UI, the reading warmth of Notion's content surfaces, and the structural clarity of Vercel's design-token thinking. From Apple, JustMark borrows optical restraint, low-noise chrome, and the idea that blue belongs to actions rather than decoration. From Notion, it borrows paper warmth and long-form readability. From Vercel, it borrows precise hierarchy and the idea that borders should often feel lighter than literal borders.

The app should feel physically composed from three layers:
- the **window shell**: soft neutral chrome with macOS translucency
- the **workspace panels**: sidebar and utility surfaces in frosted glass
- the **document surfaces**: editor and preview as calm paper planes

Key characteristics:
- Native-tool calm rather than web-app branding
- Blue is the only strong accent and appears only on interactive states
- Large areas of quiet negative space around text
- Subtle glass in chrome, solid paper in document surfaces
- Borders are whisper-light; shadows are soft and rare
- The preview panel should evoke an A4 sheet, not a generic card

## 2. Color Palette & Roles

### Core Light Theme
- **Window Mist** (`#f5f5f5`): main app window background
- **Paper White** (`#ffffff`): editor and preview surfaces
- **Primary Ink** (`#1a1a1a`): primary text on light surfaces
- **Muted Ink** (`#6b6b6b`): secondary labels, metadata, inactive controls
- **Panel Frost** (`rgba(255, 255, 255, 0.85)`): translucent sidebar and floating panel fill
- **Panel Frost Strong** (`rgba(255, 255, 255, 0.95)`): toolbar or emphasized frosted regions
- **Hairline Dark** (`rgba(0, 0, 0, 0.06)`): separators, quiet borders

### Core Dark Theme
- **Window Night** (`#1a1a1a`): main dark window background
- **Paper Charcoal** (`#262626`): editor and preview surfaces in dark mode
- **Primary Snow** (`#e5e5e5`): primary text on dark surfaces
- **Muted Snow** (`#a3a3a3`): secondary labels in dark mode
- **Panel Night Frost** (`rgba(38, 38, 38, 0.85)`): dark translucent panels
- **Panel Night Frost Strong** (`rgba(38, 38, 38, 0.95)`): emphasized dark chrome
- **Hairline Light** (`rgba(255, 255, 255, 0.10)`): separators in dark mode

### Accent
- **JustMark Blue** (`#007AFF`): primary interactive accent in light mode
- **JustMark Blue Dark** (`#0A84FF`): primary interactive accent in dark mode
- **Accent Soft Light** (`rgba(0, 122, 255, 0.08)`): focus halos and soft selected states
- **Accent Soft Dark** (`rgba(10, 132, 255, 0.12)`): dark-mode focus halos and soft selected states

### Document Preview Tones
- **Default Paper** (`#ffffff`): standard preview page fill
- **Warm Paper** (`#f7f4ee`): optional softer reading tone
- **Cool Paper** (`#f4f6f8`): optional neutral technical reading tone
- Preview background colors must always preserve strong text contrast and remain paper-like, never neon or decorative.

### Rules
- Use saturated color only for actions, focus, selection, sync progress, and explicit active states.
- Avoid purple, green, red, and gradient branding in core chrome unless the state is semantic and temporary.
- The editor and preview should remain visually quieter than the toolbar and sidebar controls.

## 3. Typography Rules

### Font Family
- **Primary UI and reading font**: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "Helvetica Neue", sans-serif`
- **Display fallback**: `SF Pro Display` when available through the platform stack for large headings
- **Monospace**: `ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace`

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Window Title | SF Pro Text | 13px | 600 | 1.3 | normal | Sidebar folder label, compact headers |
| Toolbar Label | SF Pro Text | 13px | 500 | 1.35 | normal | Standard control text |
| Button Label | SF Pro Text | 13px | 500 | 1.3 | normal | Primary chrome action size |
| Sidebar Meta | SF Pro Text | 11px | 500 | 1.35 | normal | TOC, helper labels, compact metadata |
| Body Reading | SF Pro Text | 16px | 400 | 1.7-1.85 | normal | Markdown preview default rhythm |
| Editor Text | user-selected | app-configured | 400 | app-configured | normal | User preference must take precedence |
| Section Heading | SF Pro Display/Text | 24px | 600 | 1.2 | -0.01em | Used sparingly in preference dialogs or onboarding surfaces |
| Status Micro | SF Pro Text | 9px-10px | 500 | 1.2 | 0.01em | Status bar only |
| Code / Paths | Monospace | 12px-14px | 400-500 | 1.5 | normal | File paths, code snippets, technical labels |

### Principles
- Reading comfort outranks branding. Never compress body text for style.
- UI chrome uses compact, quiet typography; the document content should always feel more spacious.
- Do not introduce loud display typography into the writing workspace.
- The user-selected editor font and preview font size are part of the product identity and should be respected.

## 4. Component Stylings

### Window Shell
- Background: `Window Mist` / `Window Night`
- Padding-top should preserve the native title-bar drag region feel
- No ornamental borders around the app frame
- The shell exists to hold content, not to attract attention

### Toolbar
- Frosted glass surface with strong translucency
- Light mode: near-white translucent fill with hairline bottom border
- Dark mode: charcoal translucent fill with light hairline border
- Backdrop blur around `18px-20px`
- Height should feel compact and native, never oversized
- Group related controls inside subtly tinted capsules

### Toolbar Groups
- Rounded rectangle, around 10px-12px radius
- Light fill: soft black tint at very low opacity
- Dark fill: soft white tint at very low opacity
- Borders should be whisper-light or omitted if the fill already separates enough

### Buttons

**Ghost Button**
- Background: transparent
- Text: primary ink / primary snow
- Radius: 8px
- Hover: faint fill only
- Active: slightly denser fill and tiny scale reduction

**Primary Quiet Button**
- Background: faint neutral tint
- Border: optional 1px hairline
- Use for secondary chrome actions

**Accent Button**
- Fill may use a restrained blue gradient only when the button is the clearest primary action
- White text on blue
- Subtle inner highlight is acceptable
- Shadow should remain small and soft
- Do not use multiple competing accent buttons in one local region

**Icon Buttons**
- 28px-32px square feel
- Rounded 8px
- Hover fills should be subtle and immediate
- Focus ring must be visible

### Sidebar
- Use frosted panel treatment instead of a hard boxed card
- The sidebar is navigational chrome, not content paper
- Root container should feel slightly translucent and layered above the window background
- Internal sections can use lightly outlined or softly filled inset containers
- TOC and files should feel like modes of the same surface, not separate apps

### Editor Surface
- Solid paper plane with no visible border
- Default background: pure white in light mode, charcoal paper in dark mode
- Large inner padding, especially horizontally, to preserve calm writing rhythm
- Placeholder copy should be low-contrast and unobtrusive
- No decorative shadows inside the writing area

### Preview Surface
- Also a paper plane, but visually distinct from the editor through spacing and page framing
- In markdown preview mode, content should be centered and allowed to breathe inside a page-like column
- In PDF mode, the A4 proportion is sacred; never stretch the page to fill the panel unnaturally
- Optional preview paper colors should remain muted and realistic

### Status Bar
- Almost invisible
- Transparent background
- 9px-10px compact tabular metadata
- Low contrast text; it should inform without stealing attention

### Tabs
- Tabs should feel like thin paper labels, not browser tabs
- Selected tab gets a clearer fill or underline cue
- Unselected tabs recede quickly
- Close affordances remain subtle until hover

### Dialogs / Preferences / Search
- Use frosted or softly elevated panels above the workspace
- Prefer one soft shadow and a quiet border over large modal drama
- Preserve native-tool feeling rather than web-marketing polish

## 5. Layout Principles

### Spatial Model
- Left: navigation and utility
- Center: editor as the primary writing plane
- Right: preview as the secondary reading/export plane
- Bottom: low-priority status metadata

### Spacing Scale
- Base unit: 4px
- Practical rhythm: 4, 6, 8, 10, 12, 16, 24, 32
- Use 8px and 12px most often for chrome
- Use 24px and 32px to create breathing room inside content surfaces

### Whitespace Philosophy
- Empty space is part of the writing experience, not leftover room
- Controls can be compact; document areas cannot feel cramped
- The preview should mimic the calm margins of a printed page
- Avoid dense utility clusters unless they are actively being used

### Panel Balance
- Sidebar should feel narrow and assistive
- Editor is the primary workspace and should command the most width
- Preview must feel stable when visible; avoid twitchy resize behavior or over-animated layout changes

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Level 0 | No shadow, solid surface | Editor and preview paper planes |
| Level 1 | Frosted fill + backdrop blur | Toolbar, sidebar shell |
| Level 2 | Hairline border or ring only | Toolbar groups, inset sections |
| Level 3 | Very soft shadow (`0 1px 2px` to `0 4px 16px` low opacity) | Dialogs, pickers, transient panels |
| Focus | `2px solid` blue outline plus soft halo | All keyboard-focusable controls |

### Philosophy
- Use translucency for chrome and solidity for documents.
- Avoid stacking strong border + strong shadow + strong blur on the same element.
- If an element already has blur, the border and shadow should usually get quieter.
- Cards should feel placed, not floating.

## 7. Do's and Don'ts

### Do
- Keep the app visually quieter than the document content
- Preserve a native macOS feel in spacing, blur, and control sizing
- Use blue as a singular accent for actions and focus
- Let the A4 preview feel like paper, with generous margins and stable framing
- Prefer hairlines, soft fills, and subtle state changes over bold outlines
- Keep dark mode equally calm, not neon and not pure black unless there is a strong reason
- Use tabular numbers for compact counters and status metadata

### Don't
- Don't turn the app into a SaaS dashboard with heavy cards and loud metrics
- Don't introduce multiple brand colors into the persistent UI chrome
- Don't use big gradients, glass overload, or decorative glows in the workspace
- Don't make side panels louder than the editor
- Don't make the status bar or tab strip visually dominant
- Don't use aggressive shadows on paper surfaces
- Don't sacrifice readability for stylistic typography tricks

## 8. Responsive Behavior

### Desktop-First
JustMark is primarily a desktop writing tool. Layout decisions should prioritize medium and large desktop windows before narrow states.

### Width Behavior
- Sidebar may collapse or tighten first
- Preview may hide second
- Editor should be the last region to lose comfortable width
- Controls should remain reachable at compact widths without becoming oversized

### Resizing Rules
- Window resize should preserve document calm; avoid jarring component jumps
- Divider drag behavior should feel precise and immediate
- A4 preview should scale proportionally, not reflow into arbitrary card widths

### Touch / Pointer Expectations
- Pointer precision matters more than touch ergonomics, but controls should still maintain roughly 28px-36px comfortable hit targets
- Hover states may be subtle because the app is pointer-driven

## 9. Agent Prompt Guide

### Short Summary For Agents
Build interfaces that feel like a native macOS writing app: calm gray window chrome, soft frosted toolbar/sidebar, solid paper editor and preview surfaces, minimal blue accent, generous whitespace, and typography optimized for reading rather than branding.

### Quick Color Reference
- App background: `#f5f5f5`
- App background dark: `#1a1a1a`
- Primary text light: `#1a1a1a`
- Primary text dark: `#e5e5e5`
- Muted text light: `#6b6b6b`
- Muted text dark: `#a3a3a3`
- Accent light: `#007AFF`
- Accent dark: `#0A84FF`
- Panel light: `rgba(255, 255, 255, 0.85)`
- Panel dark: `rgba(38, 38, 38, 0.85)`
- Separator light: `rgba(0, 0, 0, 0.06)`
- Separator dark: `rgba(255, 255, 255, 0.10)`

### Component Prompt Examples
- "Design a toolbar for a native-feeling macOS writing app. Use translucent white glass, a faint bottom hairline, compact 13px labels, 8px-radius controls, and a single blue accent only for the primary action."
- "Create a sidebar for a markdown editor using frosted glass rather than a card. Keep file tree text compact, metadata muted, and selected states subtle with soft blue tint."
- "Design an editor surface as plain paper: white background, no border, no shadow, generous 32px-like inner padding, quiet placeholder text, and no decorative chrome."
- "Create an A4 markdown preview panel that feels like a printed page inside a calm desktop app. Preserve paper margins, center the page, and avoid dashboard-style cards."
- "Design a preferences panel for JustMark using soft translucency, one low-opacity shadow, whisper borders, compact SF-style typography, and minimal accent usage."

### Iteration Guide
1. Keep asking whether the change makes writing feel calmer.
2. If a component feels like a website widget, simplify it until it feels like desktop chrome.
3. If color is added, verify it serves interaction rather than decoration.
4. If a surface looks heavy, remove either the border, the shadow, or the blur.
5. Editor and preview should always remain the visual center of gravity.
