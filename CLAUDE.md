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

### DONE — Phase 3: Update Page Files (Chunks 6-11)

Chunks 6-8 committed as `54a7f88`, chunks 9-11 committed as `5499d5b`.

**Chunk 6** — LoginPage + SignupPage: Lucide icons (Zap, Mail, Lock, Eye, EyeOff, AlertCircle)
**Chunk 7** — DashboardPage: ~10 SVGs replaced, project icons via `getProjectIcon()`
**Chunk 8** — ProjectsPage: SVGs replaced, project icons via `getProjectIcon()`
**Chunk 9** — ProjectDetailPage: 15 SVG/emoji replacements (back, bell, search, copy, plus, undo, redo, X, check, command palette icons)
**Chunk 10** — SettingsPage (tab emojis → User, Bell, Link2, Palette) + TeamPage (UserPlus, Search, Trash2)
**Chunk 11** — SearchPage (empty states + task icon), PerformancePage (8 service emojis → Lucide, interface typed React.ReactNode), AsyncPage (trash, check, X), FormsPage (5 tab SVGs + upload/editor SVGs)

All 119 data-bug-id markers preserved. All 394 BUG:BZ- comments preserved. TypeScript compiles clean.

### DONE — Phase 4: Global Style Sweep (`b417c64` + `b192a15`)

- Gray→zinc: 618 occurrences across 27 files
- Page dark backgrounds: `zinc-950` (Layout, Login, Signup, Performance)
- Shadows: `shadow-lg`/`shadow-xl` → `shadow-md` (11 occurrences)
- Transitions: `duration-200`/`duration-300` → `duration-150` (11 occurrences)
- Focus rings: `focus:ring-2` → `focus-visible:ring-2 focus-visible:ring-offset-2` (29 occurrences)
- Headings: `tracking-tight` added to all 11 page h1 elements
- BZ-080 global `*:focus { outline: none }` bug preserved (uses different pseudo-class)

### DONE — Phase 5: Gradients (`f8a3ba9`)

4 subtle gradient touches applied:
1. Auth pages (Login/Signup): `bg-gradient-to-br from-zinc-50 via-blue-50/30 to-zinc-50` (+ dark)
2. Dashboard SummaryCard icons: `bg-gradient-to-br from-blue-50 to-indigo-50/50`
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
