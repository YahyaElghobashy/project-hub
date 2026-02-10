# ProjectHub — Perceptr Bug Zoo Test Application

## What This Is
A realistic SaaS project management app (like Linear/Asana) with **120 intentionally
injected bugs** (out of 125 planned) for testing the Perceptr AI bug detection SDK.
The app must look like a genuine, polished production product — bugs should appear to
be real production mistakes, not intentional sabotage.

**Full bug catalog:** `perceptr-bug-zoo.md` (in repo root, 125 bug specs)

## Tech Stack
- React 18 + TypeScript + Vite
- TailwindCSS for styling
- React Router v6 for routing
- Zustand for state management
- MSW (Mock Service Worker) for API mocking
- Lucide React for icons (recently added)
- No real backend — everything is mocked

## Architecture
```
project-hub/
  src/
    components/     # 12 shared UI components (already polished)
    pages/          # 11 route-level pages (NEED polishing — see Phase 3)
    store/          # Zustand stores
    mocks/          # MSW handlers + mock data
    hooks/          # Custom React hooks
    utils/          # iconMap.ts (Lucide icon mapper) + other helpers
    types/          # TypeScript types
```

## Pages
1. LoginPage / SignupPage
2. DashboardPage (summary cards, charts, recent activity)
3. ProjectsPage (table with filters, sort, pagination)
4. ProjectDetailPage (kanban board, settings) — largest file
5. TeamPage (invite, roles, permissions)
6. SettingsPage (profile, notifications, integrations)
7. SearchPage (command palette + full search)
8. PerformancePage / AsyncPage / FormsPage (additional test pages)

---

## CRITICAL CONSTRAINT — Bug Marker Preservation

**NEVER modify or remove any of these:**
- `data-bug-id="BZ-XXX"` attributes (current count: 119)
- `// BUG:BZ-XXX` code comments (current count: 394)
- `window.__PERCEPTR_TEST_BUGS__` logging code

After ANY changes, verify with:
```bash
grep -rc 'data-bug-id' src/ | awk -F: '{sum+=$2} END {print sum}'   # must be >= 119
grep -rc 'BUG:BZ-' src/ | awk -F: '{sum+=$2} END {print sum}'       # must be >= 394
npx tsc --noEmit --skipLibCheck                                       # must pass
```

---

## HOW TO WORK — Read This First

**Work one phase at a time.** After completing each phase:
1. Run the verification commands above
2. Commit the changes
3. Tell the user: "Phase X complete. Start a new context for the next phase."

The user will then start a fresh Claude Code session and say:
> "Read CLAUDE.md and continue from where we left off. Do the next pending phase only."

**Do NOT try to do multiple phases in one session.** Each phase is sized to fit
comfortably within a single context window.

---

## Design Polish — Current Status

We are making the app look like a real production SaaS product with a shadcn-inspired
aesthetic: Lucide vector icons, zinc color palette, subtle gradients.

### DONE — Phases 0, 1, 2 (committed as `fabe230`)

**Phase 0 — Foundation:**
- Installed `lucide-react` dependency
- Created `src/utils/iconMap.ts` — maps string names to Lucide components
- Added shadcn CSS custom properties to `src/index.css`

**Phase 1 — Data Layer:**
- `src/mocks/data.ts`: emoji strings → Lucide icon names (`'📊'` → `'bar-chart'`)
- `src/mocks/handlers.ts`: default icon updated
- `src/types/project.ts`: JSDoc added to `icon` field

**Phase 2 — All 12 Components:**
- Replaced ~97 inline SVGs with Lucide imports across:
  Button, Card, Dropdown, Layout, Modal, NotificationPanel,
  ProjectCard, Sidebar, Table, Toast, TopBar
- All bug markers preserved

### NEXT — Phase 3: Update Page Files (Chunks 6-11)

**None of the 11 page files have been touched yet.** This is the next phase to do.
It's large, so split into sub-chunks:

**Chunk 6 — `LoginPage.tsx` + `SignupPage.tsx`**
- Replace logo bolt, email, lock inline SVGs with Lucide components
- Keep Google/GitHub brand SVGs as inline SVG (no Lucide equivalent)
- Bugs to preserve: BZ-003, BZ-008, BZ-056, BZ-057, BZ-058, BZ-060, BZ-061, BZ-065, BZ-070

**Chunk 7 — `DashboardPage.tsx`**
- Replace ~10 inline SVGs with Lucide
- Render `project.icon` via `getProjectIcon()` from `src/utils/iconMap.ts`
- Bugs to preserve: BZ-036, BZ-037, BZ-040, BZ-050, BZ-051, BZ-053, BZ-055, BZ-086-088, BZ-119, BZ-120

**Chunk 8 — `ProjectsPage.tsx`**
- Replace inline SVGs with Lucide
- Render `project.icon` via `getProjectIcon()`
- Bugs to preserve: BZ-038-049, BZ-052, BZ-054, BZ-116

**Chunk 9 — `ProjectDetailPage.tsx`** (largest file, ~1500+ lines)
- Replace ~12 inline SVGs
- Convert command palette emoji icons (settings, trash, back, bell) to Lucide JSX
- Render project icon via `getProjectIcon()`
- Bugs to preserve: BZ-011, BZ-019, BZ-101, BZ-102, BZ-104, BZ-106, BZ-107, BZ-109

**Chunk 10 — `SettingsPage.tsx` + `TeamPage.tsx`**
- Replace tab emojis (profile, bell, link, palette) with Lucide
- Update tab `icon` field to use `React.ReactNode` (Lucide JSX)
- Keep brand SVGs (Slack, GitHub, Jira) as inline SVG
- Bugs to preserve: BZ-004, BZ-005, BZ-009, BZ-015-017, BZ-059, BZ-062, BZ-063, BZ-066-069

**Chunk 11 — `SearchPage.tsx` + `PerformancePage.tsx` + `AsyncPage.tsx` + `FormsPage.tsx`**
- SearchPage: render project icons via `getProjectIcon()`
- PerformancePage: replace 8 service emojis with Lucide
- AsyncPage + FormsPage: replace inline SVGs
- Bugs to preserve: BZ-010, BZ-094, BZ-110, BZ-093, BZ-098, BZ-100, BZ-117, BZ-118, BZ-089-092, BZ-095-097, BZ-099

**TIP:** Phase 3 is big. You may want to do chunks 6-8 in one session and chunks 9-11
in another. Commit after each session.

### PENDING — Phase 4: Global Style Sweep

Unified shadcn aesthetic pass across ALL files (components + pages):

| Property | Before | After |
|----------|--------|-------|
| Gray scale | `gray-50` through `gray-900` | `zinc-50` through `zinc-950` |
| Border radius | Mixed `rounded-lg`/`rounded-xl` | `rounded-md` buttons/inputs, `rounded-lg` cards/modals |
| Shadows | `shadow-lg`, `shadow-xl` | `shadow-sm`, `shadow-md` max |
| Transitions | `duration-200`, `duration-300` | `duration-150` (snappier) |
| Headings | Default tracking | `tracking-tight` |
| Focus rings | `focus:ring-2` | `focus-visible:ring-2 focus-visible:ring-offset-2` |
| Body bg | `bg-gray-50 dark:bg-gray-900` | `bg-zinc-50 dark:bg-zinc-950` |

**BZ-080 preservation:** The global `*:focus { outline: none }` bug must stay. The
`focus-visible` additions on individual components use a different pseudo-class and
don't conflict.

### PENDING — Phase 5: Gradients

4 minimal gradient touches (additive only):
1. Auth pages background: `bg-gradient-to-br from-zinc-50 via-blue-50/30 to-zinc-50` (+ dark)
2. Dashboard summary card icons: `bg-gradient-to-br from-blue-50 to-indigo-50/50`
3. Sidebar active nav item: `bg-gradient-to-r from-blue-50 to-indigo-50/30`
4. Sidebar logo mark: `bg-gradient-to-br from-blue-600 to-indigo-600`

### PENDING — Phase 6: Final Verification

```bash
# Bug markers preserved
grep -rc 'data-bug-id' src/ | awk -F: '{sum+=$2} END {print sum}'   # >= 119
grep -rc 'BUG:BZ-' src/ | awk -F: '{sum+=$2} END {print sum}'       # >= 394

# No emojis remain in source
grep -rn '[📊🚀💼📱🔧📈🎯💡🔒⚡🌐🗄️🔍📬🌍👤🔔🔗🎨⚙🗑🔄]' src/   # expect 0

# TypeScript compiles
npx tsc --noEmit --skipLibCheck

# App runs
npm run dev  # browse and verify visually
```

### LATER — Phase 7: Inject 5 Missing Bugs

These bugs were not injected during the overnight automation:
- **BZ-022** — 404 Page Shows for Valid Route on Refresh
- **BZ-057** — Login Error Message Not Specific
- **BZ-058** — Password Reset Email Doesn't Arrive (No Error)
- **BZ-060** — OAuth Callback Loses Return URL
- **BZ-061** — Remember Me Checkbox Does Nothing

### LATER — Phase 8: Perceptr Web SDK Integration

Investigate and integrate the Perceptr Web SDK into the app.

---

## Coding Standards
- Functional components with hooks only
- Use TailwindCSS utility classes
- TypeScript strict mode
- `lucide-react` for all icons (except brand logos: Google, GitHub, Slack, Jira)
- Use `getProjectIcon(iconName)` from `src/utils/iconMap.ts` to render project icons
- Realistic mock data (names, dates, amounts)
- All bugs must look like genuine production mistakes

## Useful Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npx tsc --noEmit --skipLibCheck   # Type check
```
