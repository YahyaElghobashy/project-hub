# PERCEPTR BUG ZOO — Test Scenario Suite v1.0

## Master Prompt for Dev Agent (Cursor / Copilot / Claude Code)

```
You are building a test web application for Perceptr, an AI bug detection tool.
The app should be a realistic SaaS dashboard (e.g., project management tool,
analytics dashboard, or e-commerce admin panel) built with React + TypeScript.

For each scenario below, implement the bug AS DESCRIBED into the application.
The bugs should be realistic — the kind that ship to production unnoticed.
The app should LOOK normal on the surface. Bugs manifest through user interaction.

Tech stack: React 18, TypeScript, TailwindCSS, React Router, Zustand or Redux.
Use realistic mock data. Each bug should be triggerable by a specific user flow.

IMPORTANT: Track each bug with a data attribute `data-bug-id="BZ-XXX"` on the
nearest parent element so we can verify detection.
```

---

## TAXONOMY

| Difficulty | Description | Detection Challenge |
|------------|-------------|---------------------|
| 🟢 Easy | Visible errors, console errors, clear UI breakage | Should catch in <2s |
| 🟡 Medium | Requires interaction sequence, timing, or state awareness | Needs session replay context |
| 🔴 Hard | Subtle data corruption, race conditions, edge cases | Needs root cause analysis |
| ⚫ Stealth | No visible error, silent data loss or logic failure | Needs behavioral anomaly detection |

---

## CATEGORY 1: FORM & INPUT BUGS (BZ-001 → BZ-020)

### 🟢 Easy

**BZ-001 — Submit Button Does Nothing**
Build a signup form with email, password, and confirm password fields. The submit button has an `onClick` handler that calls `e.preventDefault()` but never actually submits. No error shown. User clicks, nothing happens.
- Trigger: Fill form → Click "Create Account"
- Expected: Form submits
- Actual: Nothing happens, no feedback

**BZ-002 — Form Clears on Validation Error**
Build a multi-field contact form. When one field fails validation, the entire form state resets instead of just showing the error on the failing field.
- Trigger: Fill 5 fields → Leave email blank → Submit
- Expected: Error on email, other fields preserved
- Actual: All fields cleared, error shows briefly

**BZ-003 — Password Field Doesn't Accept Special Characters**
Login form strips special characters from password input via an overly aggressive sanitizer regex. No error message — characters just don't appear.
- Trigger: Type `MyP@ss!word#123` in password field
- Expected: Full string accepted
- Actual: Renders as `MyPssword123`

**BZ-004 — Dropdown Selects Wrong Value**
A country selector dropdown where the displayed label and the stored value are off by one index. Shows "United States" but stores "United Kingdom."
- Trigger: Select any country from dropdown
- Expected: Selected value matches display
- Actual: Value is offset by 1

**BZ-005 — Date Picker Off by One Day**
Date input component that has a timezone conversion bug. Selecting Jan 15 stores Jan 14 (UTC conversion issue). Display shows correct date, but submitted data is wrong.
- Trigger: Pick any date → Submit → Check stored value
- Expected: Same date
- Actual: Previous day stored

### 🟡 Medium

**BZ-006 — Tab Key Skips Input Fields**
A checkout form where tabindex is incorrectly set. Tab goes from First Name to Zip Code, skipping Last Name, Address, City, and State.
- Trigger: Focus first field → Press Tab through form
- Expected: Sequential field navigation
- Actual: Jumps to field 5, skipping 2-4

**BZ-007 — Autofill Breaks Layout**
When browser autofill populates fields, the floating labels don't move up, causing overlapping text. Only happens with autofill, not manual typing.
- Trigger: Let Chrome autofill a form
- Expected: Labels animate up
- Actual: Labels overlap autofilled values

**BZ-008 — Form Submits Twice on Enter**
The form has both a `keydown` listener for Enter AND a submit button handler. Pressing Enter triggers both, creating duplicate submissions.
- Trigger: Fill form → Press Enter
- Expected: Single submission
- Actual: Two API calls, duplicate records

**BZ-009 — Textarea Doesn't Resize but Content Overflows**
A feedback textarea set to fixed height with `overflow: hidden`. Long text is accepted but the bottom portion is invisible and gets submitted without the user seeing it.
- Trigger: Type 500+ characters in textarea
- Expected: Scrollbar or auto-resize
- Actual: Text disappears below fold, silently submitted

**BZ-010 — Search Input Debounce Drops Last Character**
Search bar with debounce that fires the API call and then immediately clears the latest keystroke from the query. Searching "react hooks" sends "react hook" to the API.
- Trigger: Type quickly in search → Wait for results
- Expected: Results match full query
- Actual: Last character missing from API call

### 🔴 Hard

**BZ-011 — Multi-Step Form Loses Step 2 Data on Back Navigation**
A 4-step wizard form where going back from step 3 to step 2 clears step 2's data from state but still shows it in the UI (stale DOM). Moving forward again submits empty values for step 2.
- Trigger: Fill steps 1-3 → Go back to step 2 → Go forward → Submit
- Expected: All data preserved
- Actual: Step 2 data is empty in payload

**BZ-012 — File Upload Shows Success but File Is Empty**
File upload component that shows a success toast and filename, but the actual `FormData` sends a 0-byte file because the file reference was garbage collected before the async upload started.
- Trigger: Select large file → Wait 2s → Upload starts
- Expected: File uploaded correctly
- Actual: 0-byte file on server, UI shows success

**BZ-013 — Rich Text Editor Strips Formatting on Paste**
WYSIWYG editor that correctly handles typed formatting but strips all bold/italic/links when pasting from Google Docs or Word. No indication to user.
- Trigger: Copy formatted text from Google Docs → Paste into editor
- Expected: Formatting preserved
- Actual: Plain text only, no warning

**BZ-014 — Currency Input Allows Invalid States**
Price input field that accepts `$1,234.56.78` (multiple decimals) without validation. Saves the string as-is, breaking downstream calculations.
- Trigger: Type `1234.56.78` in price field → Save
- Expected: Validation error
- Actual: Saved successfully, breaks reports

**BZ-015 — Conditional Fields Don't Clear When Hidden**
Toggle "I have a referral code" shows an input. Enter a code, toggle off, submit — the hidden referral code is still in the payload, potentially applying discounts.
- Trigger: Enable referral → Enter code → Disable referral → Submit
- Expected: Referral code removed from payload
- Actual: Code still submitted

### ⚫ Stealth

**BZ-016 — Locale-Specific Number Parsing Silently Fails**
For users with European locale (comma as decimal), input "1.234,56" is stored as "1.234" (truncated at first non-US decimal character). No error shown.
- Trigger: Set browser locale to de-DE → Enter European number format
- Expected: Correct float parsing
- Actual: Silent truncation

**BZ-017 — Form Data Encoding Mangles Unicode Names**
Form submission encodes names with diacritics (José, Müller, 日本語) incorrectly. Display shows right, but database stores garbled characters.
- Trigger: Submit form with non-ASCII name
- Expected: UTF-8 preserved
- Actual: Mojibake in database

**BZ-018 — Copy-Paste Invisible Characters Break Validation**
Pasting an email from a PDF introduces zero-width spaces (U+200B). Email looks valid visually but fails backend validation. Frontend says "valid email" but API returns 422.
- Trigger: Copy email from styled PDF → Paste into email field → Submit
- Expected: Email accepted
- Actual: API rejection, confusing error

**BZ-019 — Autocomplete Race Condition Selects Wrong Item**
Type-ahead search where fast typing + selecting a suggestion before results update means you select item N from the OLD results list, not the new one. User sees "Acme Corp" but selects "Alpha Inc."
- Trigger: Type "ac" → See results → Quickly type "me" → Click first result
- Expected: Selects "Acme Corp"
- Actual: Selects item from previous result set

**BZ-020 — Number Input Spinner Overflows Silently**
A quantity field with min=0 max=999. Holding the up arrow spinner goes 997, 998, 999, 000, 001… Wraps around with no cap, no error.
- Trigger: Hold up arrow on quantity spinner past max
- Expected: Stops at 999
- Actual: Wraps to 000

---

## CATEGORY 2: NAVIGATION & ROUTING BUGS (BZ-021 → BZ-035)

### 🟢 Easy

**BZ-021 — Broken Back Button After Modal**
Opening a modal pushes a history entry. Pressing browser back closes the modal AND navigates away from the page.
- Trigger: Open modal → Press browser back
- Expected: Modal closes, page stays
- Actual: Navigates to previous page

**BZ-022 — 404 Page Shows for Valid Route on Refresh**
SPA with client-side routing. Direct URL access or hard refresh on `/dashboard/settings` returns 404 because the server doesn't handle catch-all.
- Trigger: Navigate to /dashboard/settings → Hard refresh (F5)
- Expected: Page renders
- Actual: 404 error

**BZ-023 — Active Nav Highlight Stuck on Wrong Tab**
Sidebar navigation highlights "Dashboard" even when user is on "Settings". The active state is set on mount but never updates on route change.
- Trigger: Click Settings in sidebar
- Expected: Settings tab highlighted
- Actual: Dashboard remains highlighted

### 🟡 Medium

**BZ-024 — Deep Link Loses Query Parameters**
URL with query params `/search?q=react&sort=date` correctly loads, but any client-side navigation strips the query params. Sharing the URL loses context.
- Trigger: Load page with query params → Click any internal link → Press back
- Expected: Query params restored
- Actual: Params gone, shows unfiltered results

**BZ-025 — Infinite Redirect Loop on Expired Session**
Auth guard redirects to `/login`, login page checks auth status, finds expired token, redirects to `/login` again. Infinite loop. Browser eventually kills the tab.
- Trigger: Let session expire → Try to navigate
- Expected: Login page renders once
- Actual: Infinite redirect, tab crashes

**BZ-026 — Hash Fragment Navigation Scrolls Wrong**
Anchor links (`#section-3`) scroll to the position BEFORE dynamic content above loads. Content loads, pushes section down, user sees wrong section.
- Trigger: Click anchor link to section below dynamic content
- Expected: Scrolls to correct section
- Actual: Scrolls to wrong position

**BZ-027 — Route Guard Flashes Protected Content**
Protected route briefly renders the dashboard (200ms flash) before the auth check completes and redirects to login. Sensitive data visible in that flash.
- Trigger: Access /dashboard while logged out
- Expected: Redirect to login immediately
- Actual: Dashboard content flashes, then redirects

**BZ-028 — Breadcrumb Trail Doesn't Match Actual Path**
Breadcrumbs show `Home > Projects > Settings` but the actual URL is `/account/settings`. Breadcrumb is hardcoded, not derived from route.
- Trigger: Navigate to any nested page
- Expected: Breadcrumbs match URL hierarchy
- Actual: Breadcrumbs show incorrect path

### 🔴 Hard

**BZ-029 — Browser History Polluted by Filters**
Every filter change pushes a new history entry. User applying 10 filters has to press back 10 times to leave the page.
- Trigger: Apply 5 filters on a table → Press back button
- Expected: Navigate to previous page
- Actual: Undoes one filter at a time

**BZ-030 — Concurrent Route Transitions Cause White Screen**
Rapidly clicking between tabs triggers overlapping route transitions. React suspense boundary catches an error, shows fallback, never recovers.
- Trigger: Click rapidly between 3+ nav items in <1 second
- Expected: Last clicked page renders
- Actual: White screen or infinite spinner

**BZ-031 — URL State and App State Diverge After Popstate**
Filters in URL say `?status=active` but the UI shows "All" because the popstate listener doesn't sync URL params back to component state.
- Trigger: Set filters → Navigate away → Press back
- Expected: Filters restored from URL
- Actual: URL has filters, UI shows default

### ⚫ Stealth

**BZ-032 — Analytics Pageview Fires Twice on Route Change**
React strict mode in dev or the router listener firing on both `popstate` and the programmatic navigation causes double pageview events. Inflates analytics by ~40%.
- Trigger: Navigate between any two pages
- Expected: 1 pageview event
- Actual: 2 pageview events per navigation

**BZ-033 — Scroll Position Not Restored on Back Navigation**
User scrolls down 3000px on a feed, clicks into a post, presses back. Page loads at top instead of restoring scroll position.
- Trigger: Scroll down long page → Click item → Press back
- Expected: Returns to previous scroll position
- Actual: Returns to top of page

**BZ-034 — Dynamic Route Segments Not Decoded**
Route `/projects/My%20Project` renders but displays "My%20Project" as the title instead of "My Project". `decodeURIComponent` missing.
- Trigger: Navigate to a URL with encoded characters
- Expected: Decoded text displayed
- Actual: Raw URL encoding shown

**BZ-035 — Navigation Cancel Doesn't Abort Pending Requests**
User starts navigation (triggering data fetch), then navigates elsewhere. The first fetch completes and overwrites the new page's data with stale data.
- Trigger: Click Page A → Immediately click Page B
- Expected: Page B data shown
- Actual: Page A data briefly overwrites Page B

---

## CATEGORY 3: DATA DISPLAY & TABLE BUGS (BZ-036 → BZ-055)

### 🟢 Easy

**BZ-036 — Table Pagination Shows Wrong Total**
Table says "Showing 1-10 of 156 results" but there are actually 312 results. The total count endpoint returns the count before a filter is applied.
- Trigger: Apply filter → Check pagination text
- Expected: Count matches filtered results
- Actual: Shows unfiltered total

**BZ-037 — Empty State Not Shown When Data Is Empty**
When a table has no data, it shows column headers with a blank body and no "No results found" message. Looks broken, not empty.
- Trigger: Filter to a state with 0 results
- Expected: Empty state illustration + message
- Actual: Empty table body, no feedback

**BZ-038 — Sort Arrow Points Wrong Direction**
Clicking sort on a column sorts descending but shows an up arrow (ascending indicator). Visual mismatch.
- Trigger: Click column header to sort
- Expected: Arrow matches sort direction
- Actual: Arrow inverted

**BZ-039 — Long Text Breaks Table Layout**
A cell with a 500-character description pushes the table width beyond the viewport with no ellipsis, no wrapping, no tooltip. Horizontal scroll appears.
- Trigger: View row with very long text
- Expected: Truncated with tooltip
- Actual: Table overflows horizontally

**BZ-040 — Currency Displayed Without Proper Formatting**
Dollar amounts shown as `1234567.8` instead of `$1,234,567.80`. Missing currency symbol, thousands separator, and decimal padding.
- Trigger: View any monetary value in table
- Expected: Properly formatted currency
- Actual: Raw float

### 🟡 Medium

**BZ-041 — Sort Doesn't Persist After Page Change**
Sort by "Created Date" desc → Go to page 2 → Sort resets to default (by Name asc). Page 2 shows data sorted differently than page 1.
- Trigger: Sort column → Navigate to page 2
- Expected: Sort persists
- Actual: Sort resets to default

**BZ-042 — Select All Checkbox Only Selects Visible Page**
"Select All" checkbox header says "47 items selected" but only selects the 10 visible rows. Bulk action affects only 10 rows.
- Trigger: Click "Select All" checkbox → Perform bulk action
- Expected: All 47 filtered items affected
- Actual: Only 10 visible rows affected

**BZ-043 — Table Filter AND/OR Logic Wrong**
Filter by "Status: Active" AND "Priority: High" should show items matching BOTH. Instead it shows items matching EITHER (OR logic).
- Trigger: Apply two filters
- Expected: Intersection of filters
- Actual: Union of filters

**BZ-044 — Stale Data After Inline Edit**
Edit a cell inline (e.g., change status from "Open" to "Closed"). The cell shows "Closed" but the row's other calculated fields (like "Days Open") don't update until full page refresh.
- Trigger: Inline edit a field that affects calculations
- Expected: Related fields update
- Actual: Related fields show stale values

**BZ-045 — Column Resize Resets on Re-render**
User drags a column to be wider. Any state change (sort, filter, page change) resets all columns to default width. User's customization lost.
- Trigger: Resize column → Change sort order
- Expected: Column widths preserved
- Actual: All columns reset to default width

### 🔴 Hard

**BZ-046 — Optimistic UI Update Shows Wrong Data on Rollback**
User updates a row, UI optimistically shows success. API fails (409 conflict). UI rolls back but shows a DIFFERENT previous state than the actual one (because the optimistic cache was stale).
- Trigger: Edit row → API returns 409 → Observe rollback
- Expected: Original data restored
- Actual: Different stale data shown

**BZ-047 — Virtual Scroll Duplicates Rows**
Table with 10,000 rows uses virtual scrolling. Scroll quickly to middle → some rows appear twice, other rows are missing. Row recycling has an off-by-one error.
- Trigger: Rapidly scroll through virtualized table
- Expected: Each row appears exactly once
- Actual: Duplicate rows, missing rows

**BZ-048 — CSV Export Doesn't Match Table View**
"Export to CSV" exports all data ignoring current filters and sorts. User sees 15 filtered rows but gets 500 unfiltered rows in the CSV.
- Trigger: Filter table → Sort → Click Export CSV
- Expected: CSV matches current view
- Actual: CSV has all unfiltered data in default order

**BZ-049 — Real-Time Update Causes Row Jump**
Table updates via WebSocket. New row inserts at top, pushing the row the user was reading down. User loses their place. No indication of new data.
- Trigger: Be reading mid-table when new data arrives
- Expected: New data badge, no scroll jump
- Actual: Content shifts, user loses position

**BZ-050 — Aggregation Row Shows Null After Filter**
Table footer shows SUM, AVG of columns. Applying a filter that returns results still shows `null` or `NaN` in the aggregation row because the aggregate query doesn't include the WHERE clause.
- Trigger: Apply filter → Check footer aggregations
- Expected: Aggregations recalculated for filtered data
- Actual: Shows null/NaN

### ⚫ Stealth

**BZ-051 — Floating Point Display Rounding Inconsistency**
Three rows show $10.10, $10.20, $10.30. Total shows $30.59 instead of $30.60. Classic IEEE 754 floating point issue. No error, just silently wrong math.
- Trigger: View any column with decimal totals
- Expected: Mathematically correct total
- Actual: Off by pennies

**BZ-052 — Timezone-Dependent Sorting**
"Created" column sorts by UTC timestamp but displays in local time. A record created at 11pm EST (4am UTC next day) appears in the wrong position when sorted by date.
- Trigger: Sort by date with records near midnight UTC
- Expected: Sort matches displayed dates
- Actual: Some records appear out of display order

**BZ-053 — Deleted Items Still Counted in Summary Cards**
Dashboard shows "127 Active Projects" but the table only shows 124. Three soft-deleted items are counted in the summary query but excluded from the list query.
- Trigger: Compare dashboard card count to table row count
- Expected: Numbers match
- Actual: Summary inflated by deleted items

**BZ-054 — Table Keyboard Navigation Fires Actions**
Pressing Enter/Space while navigating a table with keyboard triggers the action button in the focused row. User navigating for accessibility accidentally deletes/archives items.
- Trigger: Tab through table rows → Press Enter while focus is near action button
- Expected: No action without explicit intent
- Actual: Accidental action triggered

**BZ-055 — Percentage Calculation Uses Wrong Base**
Growth column shows "150% increase" but the actual change is from 100 to 150 (50% increase). The formula computes `new_value / old_value * 100` instead of `(new - old) / old * 100`.
- Trigger: View any growth percentage
- Expected: Correct percentage change
- Actual: Inflated by 100 percentage points

---

## CATEGORY 4: AUTHENTICATION & SESSION BUGS (BZ-056 → BZ-070)

### 🟢 Easy

**BZ-056 — Logout Doesn't Clear Local Storage**
Clicking "Logout" redirects to login page but doesn't clear localStorage. Refreshing the login page auto-redirects to dashboard with stale token.
- Trigger: Logout → Refresh login page
- Expected: Stay on login page
- Actual: Redirected to dashboard with expired/stale session

**BZ-057 — Login Error Message Not Specific**
Wrong password shows "An error occurred." No indication whether it's wrong email, wrong password, or account locked.
- Trigger: Enter wrong credentials
- Expected: Specific error (e.g., "Incorrect password")
- Actual: Generic "An error occurred"

**BZ-058 — Password Reset Email Doesn't Arrive (No Error)**
"Reset password" form shows "Check your email!" for any email, even non-existent ones. No actual email sent for valid accounts due to SMTP config error. No error in UI.
- Trigger: Request password reset for valid email
- Expected: Email arrives
- Actual: Success message shown, no email sent

### 🟡 Medium

**BZ-059 — Session Expires Without Warning**
Token expires after 30 minutes. No refresh mechanism, no warning. User fills out a long form, clicks submit, gets redirected to login. Form data lost.
- Trigger: Stay idle for 30+ minutes → Try to submit
- Expected: Session refresh or warning
- Actual: Silent redirect, data lost

**BZ-060 — OAuth Callback Loses Return URL**
User tries to access `/dashboard/reports` while logged out. Redirected to OAuth login. After successful auth, redirected to `/dashboard` instead of `/dashboard/reports`.
- Trigger: Access protected deep link → Log in via OAuth
- Expected: Return to original deep link
- Actual: Redirected to default route

**BZ-061 — Remember Me Checkbox Does Nothing**
Login form has "Remember me" checkbox. Whether checked or not, the session duration is the same (30min). The checkbox is purely decorative.
- Trigger: Check "Remember me" → Login → Check session duration
- Expected: Extended session
- Actual: Same 30-minute session

**BZ-062 — Multi-Tab Session Conflict**
User logs in as Admin in Tab A, logs in as Regular User in Tab B. Tab A still shows admin UI but API calls use Regular User token. Actions may silently fail or affect wrong account.
- Trigger: Open two tabs → Login as different users
- Expected: Consistent session or warning
- Actual: UI shows one user, API uses another

### 🔴 Hard

**BZ-063 — Token Refresh Race Condition**
Two concurrent API calls both detect expired token, both trigger refresh. First refresh succeeds, second refresh fails (token already rotated). Second API call fails with 401.
- Trigger: Open dashboard that makes 5+ simultaneous API calls near token expiry
- Expected: Single refresh, all calls succeed
- Actual: Some calls fail with 401

**BZ-064 — CSRF Token Mismatch After Idle**
CSRF token in the page expires after the session refreshes. Form submission fails with 403 but the error handler shows "Network Error" instead of the real issue.
- Trigger: Idle for period → Session auto-refreshes → Submit form
- Expected: CSRF token refreshed with session
- Actual: 403 on submit, misleading error

**BZ-065 — SSO User Has No Local Logout**
SSO users clicking "Logout" clears local session but doesn't trigger IdP logout. Closing and reopening the app auto-logs them back in via SSO cookie.
- Trigger: SSO user → Logout → Reopen app
- Expected: Logged out fully
- Actual: Auto-re-authenticated

### ⚫ Stealth

**BZ-066 — Permission Check Only on Frontend**
"Delete" button hidden for Viewer role via `{isAdmin && <DeleteButton />}`. But the API endpoint `/api/projects/:id` DELETE has no auth check. Anyone with the URL can delete.
- Trigger: Regular user sends DELETE request via curl/Postman
- Expected: 403 Forbidden
- Actual: 200 OK, project deleted

**BZ-067 — JWT Payload Contains Stale Permissions**
User's role changed from Admin to Viewer in the admin panel. Until their token expires and refreshes, they retain Admin permissions encoded in the JWT payload.
- Trigger: Change user role → User continues using app
- Expected: Permissions update immediately
- Actual: Old permissions persist until token refresh

**BZ-068 — Invite Link Works After Revocation**
Team invite link `/join?token=abc123` is revoked by admin. The token is deleted from the database, but a cached validation layer still approves it for 24 hours.
- Trigger: Revoke invite → Use link within cache TTL
- Expected: Link invalid
- Actual: Can still join team

**BZ-069 — Password Change Doesn't Invalidate Other Sessions**
User changes password on desktop. Mobile app still logged in with old session. Potential security issue if password was changed due to compromise.
- Trigger: Change password on one device → Check other devices
- Expected: All other sessions invalidated
- Actual: Other sessions remain active

**BZ-070 — Rate Limiting Only Checks Successful Attempts**
Login rate limiter counts only successful logins, not failed attempts. Brute force attempts at 1000 req/s never trigger the rate limiter.
- Trigger: Rapid failed login attempts
- Expected: Account locked after N failures
- Actual: Unlimited attempts allowed

---

## CATEGORY 5: VISUAL & LAYOUT BUGS (BZ-071 → BZ-085)

### 🟢 Easy

**BZ-071 — Modal Overflow Hidden on Mobile**
Modal content extends below the viewport on mobile with no scroll. Confirm button unreachable. User can't complete the action or dismiss properly.
- Trigger: Open any modal on mobile viewport (375px)
- Expected: Modal scrollable
- Actual: Bottom content and buttons cut off

**BZ-072 — Z-Index War: Dropdown Behind Modal**
Opening a select dropdown inside a modal — the dropdown renders behind the modal overlay due to stacking context.
- Trigger: Open modal → Click dropdown inside modal
- Expected: Dropdown appears above modal
- Actual: Dropdown hidden behind modal overlay

**BZ-073 — Dark Mode Misses Components**
App supports dark mode toggle. Most components switch, but toasts, tooltips, and date picker remain light-themed. Jarring white elements on dark background.
- Trigger: Toggle dark mode → Trigger a toast notification
- Expected: Toast uses dark theme
- Actual: Bright white toast on dark UI

**BZ-074 — Text Truncation Hides Critical Info**
User name column truncates to 15 chars with ellipsis. "Jonathan Smith…" is fine, but "Total Revenue (…)" hides "(YTD)" which completely changes the metric's meaning.
- Trigger: View column header or value with meaningful suffix
- Expected: Full text visible or tooltip shows full text
- Actual: Important context truncated with no tooltip

**BZ-075 — Sticky Header Covers Content on Scroll**
Fixed header is 64px. Anchor link scroll-to doesn't account for header offset. Scrolled-to content is hidden under the sticky header.
- Trigger: Click in-page anchor link
- Expected: Content visible below header
- Actual: First 64px of target section hidden

### 🟡 Medium

**BZ-076 — Layout Shift When Images Load**
Product cards show title, then image loads and pushes the title down by 200px. Cumulative Layout Shift (CLS) is terrible. Users click wrong items.
- Trigger: Load a page with image cards on slow connection
- Expected: Space reserved for images
- Actual: Content jumps when images load

**BZ-077 — Print Stylesheet Missing**
User prints a report page. Browser print view shows navigation, sidebar, footer, cookie banners — everything except properly formatted content.
- Trigger: Press Ctrl+P on any page
- Expected: Clean print layout
- Actual: Full app chrome prints

**BZ-078 — Responsive Breakpoint Gap**
At exactly 768px (iPad portrait), neither the mobile layout nor the desktop layout applies. Navigation disappears, content has no padding, buttons overlap.
- Trigger: Resize window to exactly 768px
- Expected: Clean layout at all widths
- Actual: Broken layout at specific breakpoint

**BZ-079 — Animation Janks on Low-End Devices**
Smooth 60fps sidebar animation on desktop becomes 5fps slideshow on mobile. No `will-change`, no `transform3d`, JS-based animation instead of CSS.
- Trigger: Open/close sidebar on low-end device (or throttle CPU in DevTools)
- Expected: Smooth animation or instant toggle
- Actual: Choppy, janky animation

**BZ-080 — Focus Indicator Invisible**
Custom CSS removes default focus outlines (`outline: none`) for aesthetics but doesn't add a custom focus indicator. Keyboard users can't see which element is focused.
- Trigger: Tab through page with keyboard
- Expected: Visible focus indicator
- Actual: No visible focus

### 🔴 Hard

**BZ-081 — CSS Grid Gap Causes Pixel Overflow**
Grid with `grid-template-columns: repeat(3, 33.33%)` plus `gap: 16px`. Total width exceeds container, causing horizontal scroll on certain viewport widths.
- Trigger: Resize browser to specific widths
- Expected: Grid fits container
- Actual: Subtle horizontal overflow

**BZ-082 — SVG Icons Inherit Wrong Color in Context**
SVG icons using `currentColor` inside a button that changes color on hover. Icon color lags by one render frame, creating a flash of wrong color.
- Trigger: Rapidly hover/unhover buttons with SVG icons
- Expected: Smooth color transition
- Actual: Icon color flickers

**BZ-083 — Container Query Fallback Missing**
Layout uses CSS Container Queries for responsive cards. In Safari 15 and Firefox ESR, cards render at minimum size (100px) because container queries aren't supported.
- Trigger: View in older browser without Container Query support
- Expected: Graceful fallback layout
- Actual: Tiny unusable cards

### ⚫ Stealth

**BZ-084 — FOUC on Theme Toggle**
Switching between light and dark theme causes a single frame of un-styled content (white flash in dark mode). Happens because theme class applies after paint.
- Trigger: Toggle theme in dark room
- Expected: Smooth transition
- Actual: Brief white flash

**BZ-085 — Invisible Overlapping Clickable Areas**
A card's click handler area overlaps with a button's click area. Clicking near the button sometimes triggers the card action instead. No visual indication of click zones.
- Trigger: Click the edge of a button inside a clickable card
- Expected: Button action fires
- Actual: Card action fires instead

---

## CATEGORY 6: ASYNC & LOADING STATE BUGS (BZ-086 → BZ-100)

### 🟢 Easy

**BZ-086 — Loading Spinner Never Disappears**
API call succeeds but the loading state isn't set to false in the success handler. Spinner stays forever, covering the actual content.
- Trigger: Navigate to a page that loads data
- Expected: Spinner → Content
- Actual: Spinner forever (content loaded underneath)

**BZ-087 — Error State Not Shown on API Failure**
API returns 500. The loading spinner stops but no error message is shown. User sees an empty page with no way to retry or understand what happened.
- Trigger: API fails (simulate 500)
- Expected: Error message with retry button
- Actual: Empty page, no feedback

**BZ-088 — Skeleton Loader Doesn't Match Real Layout**
Skeleton screen shows 3 cards per row. Real content loads as 2 cards per row. Layout shifts when real content replaces skeleton.
- Trigger: Load any page with skeleton loading
- Expected: Skeleton matches real layout
- Actual: Layout jump when content loads

### 🟡 Medium

**BZ-089 — Stale Data After Background Tab**
User opens app, switches to another tab for 10 minutes. Returns to the app — data is still from 10 minutes ago. No refetch on visibility change.
- Trigger: Open app → Switch tabs → Wait → Return
- Expected: Data refreshes on tab focus
- Actual: Stale data displayed

**BZ-090 — Retry Logic Creates Duplicates**
"Submit order" fails with network error. Auto-retry triggers 3 times. First attempt actually succeeded but the client timed out. Result: 4 duplicate orders.
- Trigger: Submit on flaky network (simulate with DevTools throttle)
- Expected: Idempotent submission
- Actual: Multiple duplicate records

**BZ-091 — Infinite Scroll Stops Working After Error**
Infinite scroll page. API fails on page 5. Error is swallowed. `hasMore` is still true but the scroll listener is removed. User can't load more data even after network recovers.
- Trigger: Scroll to load page 5 → API fails → Scroll more
- Expected: Retry or error message
- Actual: Silently stops loading, no more pages

**BZ-092 — Debounced Save Loses Last Edit**
Auto-save debounced at 2 seconds. User edits → waits 1.5s → navigates away. Last edit wasn't saved because the debounce timer was cancelled by unmount.
- Trigger: Edit → Navigate away within debounce window
- Expected: Pending changes saved before navigation
- Actual: Last edit lost

**BZ-093 — Polling Interval Stacks**
Dashboard polls every 5 seconds. Component unmounts and remounts (e.g., tab switch) without clearing the interval. Now there are 2 intervals. Do it 5 times → 5 parallel polling loops.
- Trigger: Switch between tabs 5 times → Check network tab
- Expected: 1 poll per interval
- Actual: 5 concurrent polling intervals

### 🔴 Hard

**BZ-094 — Race Condition: Slow Request Overwrites Fast One**
User clicks "Category A" (slow API, 3s). Then clicks "Category B" (fast API, 200ms). Category B loads first. Then Category A response arrives and overwrites the display.
- Trigger: Click filter → Quickly click different filter
- Expected: Last clicked filter wins
- Actual: First filter's data overwrites

**BZ-095 — WebSocket Reconnect Loses Subscription**
WebSocket disconnects (network blip). Auto-reconnect establishes new connection but doesn't re-subscribe to the room/channel. User stops getting real-time updates silently.
- Trigger: Toggle airplane mode briefly → Reconnect
- Expected: Subscriptions restored
- Actual: Connection alive but no events received

**BZ-096 — Optimistic Delete Can't Undo**
User deletes item, UI removes it instantly (optimistic). User clicks "Undo" within 5 seconds. But the deletion already hit the API and "Undo" tries to recreate the item, failing because related records were cascade-deleted.
- Trigger: Delete item → Click Undo within grace period
- Expected: Item restored fully
- Actual: Partial restore, broken relations

**BZ-097 — Batch Operation Partial Failure Unclear**
"Delete 10 items" — 7 succeed, 3 fail (permission error). UI shows "Delete successful!" toast. User discovers the 3 surviving items later.
- Trigger: Bulk delete items where some lack permissions
- Expected: Report partial failure with details
- Actual: Full success message

### ⚫ Stealth

**BZ-098 — Memory Leak from Unmounted Component Subscription**
Component subscribes to a data stream on mount, doesn't unsubscribe on unmount. After navigating back and forth 50 times, the app has 50 active subscriptions. Performance degrades slowly.
- Trigger: Navigate between two pages 50 times → Check memory
- Expected: Constant memory usage
- Actual: Linearly increasing memory

**BZ-099 — Service Worker Serves Stale Assets**
Service worker caches JavaScript bundle aggressively. New deployment changes API response format. Stale JS expects old format, new API returns new format. Silent data parsing failures.
- Trigger: Deploy new version → User visits without hard refresh
- Expected: New code loads
- Actual: Old cached JS runs against new API

**BZ-100 — Event Listener Leak Causes Exponential Slowdown**
Each render adds a window resize listener without removing the previous one. After 100 re-renders, there are 100 listeners. Resizing the window triggers 100 layout recalculations.
- Trigger: Use app for extended period → Resize window
- Expected: Smooth resize behavior
- Actual: Browser hangs on resize

---

## CATEGORY 7: COMPLEX INTERACTION BUGS (BZ-101 → BZ-115)

### 🟡 Medium

**BZ-101 — Drag-and-Drop Doesn't Work on Touch Devices**
Kanban board uses HTML5 Drag and Drop API which doesn't work on mobile. No fallback provided. Cards can't be moved on iPad/phone.
- Trigger: Try to drag a card on iOS/Android
- Expected: Touch-friendly drag
- Actual: Nothing happens, or scrolls instead

**BZ-102 — Undo/Redo Stack Overflow**
Every keystroke in a text editor pushes to the undo stack. Document with 10,000 keystrokes has 10,000 undo entries. Ctrl+Z takes 10,000 steps to fully undo.
- Trigger: Type extensively → Ctrl+Z repeatedly
- Expected: Undo by logical chunks
- Actual: Undo one character at a time

**BZ-103 — Copy/Paste From App Loses Structure**
Copying a table from the app and pasting into Google Sheets/Excel gives a single cell with all text concatenated. Tab-delimited structure not preserved.
- Trigger: Select table → Copy → Paste into Sheets
- Expected: Table structure preserved
- Actual: All data in one cell

**BZ-104 — Multi-Select Dropdown Can't Deselect**
Select multiple tags from a dropdown. Click a selected tag to deselect — nothing happens. The remove (X) button exists but has no click handler.
- Trigger: Select 3 tags → Try to remove one
- Expected: Tag removed
- Actual: Can only add, never remove

**BZ-105 — Tooltip Blocks Click Target**
Hover over a button → Tooltip appears → Move mouse to click → Tooltip covers the button → Click triggers tooltip dismissal, not button action.
- Trigger: Hover then try to click a small button with a large tooltip
- Expected: Tooltip doesn't block interaction
- Actual: Have to double-click

### 🔴 Hard

**BZ-106 — Collaborative Edit Conflict Not Resolved**
Two users edit the same field simultaneously. Last write wins without warning. User A's 10-minute edit overwritten by User B's quick change. No conflict resolution or notification.
- Trigger: Two users edit same record at same time
- Expected: Conflict warning or merge
- Actual: Silent overwrite, data loss

**BZ-107 — Notification Marked Read on Fetch, Not View**
Notification badge shows "5 new." Opening the notifications panel fetches them and immediately marks all as read via API, even if the user didn't actually see/scroll through them.
- Trigger: Open notification panel → Close it → Reopen
- Expected: Unread notifications still marked new
- Actual: All marked read on panel open

**BZ-108 — Chart Tooltip Flickers at Data Point Boundaries**
Hovering near the intersection of two data points on a line chart. Tooltip rapidly alternates between the two points, flickering.
- Trigger: Hover between two close data points on chart
- Expected: Smooth tooltip transition
- Actual: Rapid flickering between tooltips

**BZ-109 — Command Palette Search Returns Inconsistent Results**
Cmd+K search returns "Settings" when you type "sett" but not when you type "settings" (full word). Fuzzy matching algorithm breaks on exact matches.
- Trigger: Open command palette → Type partial vs full term
- Expected: Consistent results
- Actual: Full word returns no results

**BZ-110 — Keyboard Shortcut Fires in Input Fields**
Global shortcut `D` opens dashboard. User typing "Download" in a text field triggers the shortcut on the first "D." Navigates away, input lost.
- Trigger: Type in any text field with a letter that matches a shortcut
- Expected: Shortcuts disabled when input focused
- Actual: Shortcut fires, user pulled away

### ⚫ Stealth

**BZ-111 — Clipboard API Fails Silently**
"Copy to clipboard" button uses `navigator.clipboard.writeText()` without checking permissions. In some contexts (HTTP, iframe), it silently fails. Toast says "Copied!" but clipboard is empty.
- Trigger: Click copy button in non-HTTPS or iframe context
- Expected: Error message or fallback
- Actual: "Copied!" toast, clipboard unchanged

**BZ-112 — Browser Extension Injects CSS That Breaks Layout**
Popular ad blocker / Grammarly extension injects CSS that conflicts with the app's grid system. 5% of users see broken layouts. No error in app code.
- Trigger: Use app with Grammarly or specific ad blocker
- Expected: App resilient to injected CSS
- Actual: Layout breaks for some users

**BZ-113 — Resize Observer Creates Layout Thrashing**
A resize observer triggers a DOM measurement, which triggers a resize, which triggers the observer again. Creates a tight layout thrashing loop that degrades to 10fps.
- Trigger: Resize panel that uses ResizeObserver for responsive layout
- Expected: Smooth resize
- Actual: Jank and CPU spike

**BZ-114 — Context Menu Not Disabled on Custom UI**
Right-clicking on a custom color picker shows the browser's default context menu instead of the app's custom context menu. Or worse, both menus appear.
- Trigger: Right-click on custom interactive component
- Expected: Custom context menu or none
- Actual: Browser default context menu

**BZ-115 — Selection Highlight Persists After Action**
User selects 5 rows, clicks "Archive." Items archived successfully. Selection state still shows 5 items selected (on now-different rows). Next bulk action affects wrong items.
- Trigger: Select items → Bulk action → Observe remaining selection state
- Expected: Selection cleared after action
- Actual: Selection persists on different items

---

## CATEGORY 8: PERFORMANCE BUGS (BZ-116 → BZ-125)

### 🟡 Medium

**BZ-116 — Unkeyed List Causes Full Re-render**
A list of 500 items uses array index as key. Prepending one item at the top causes all 500 items to re-render instead of adding 1.
- Trigger: Add item to top of long list → Check React DevTools renders
- Expected: 1 new component rendered
- Actual: 500 components re-rendered

**BZ-117 — Image Not Lazy Loaded Below Fold**
Page loads 50 high-res images eagerly. Only 3 are visible. Initial page load takes 12 seconds on 3G. No lazy loading, no progressive loading.
- Trigger: Load page on throttled network
- Expected: Only visible images load first
- Actual: All 50 images block render

**BZ-118 — Bundle Includes Unused Libraries**
A 2MB charting library imported for one small donut chart on the settings page. Every page load pays the cost even though 90% of pages don't use charts.
- Trigger: Check bundle size / network tab
- Expected: Code-split, lazy loaded
- Actual: Full library in main bundle

### 🔴 Hard

**BZ-119 — N+1 API Query on Dashboard**
Dashboard loads, makes 1 API call for project list (50 projects), then makes 50 individual API calls for each project's details. 51 requests on page load.
- Trigger: Open dashboard → Check network tab
- Expected: 1-2 API calls with batch/include
- Actual: 51 API calls

**BZ-120 — Redux Store Causes Cascading Re-renders**
Every state change in the Redux store (including unrelated chat messages) triggers re-renders on the heavy data table component because it subscribes to the root store.
- Trigger: Receive chat notification while viewing table
- Expected: Table doesn't re-render
- Actual: Entire table re-renders on every store change

### ⚫ Stealth

**BZ-121 — localStorage Parsed on Every Render**
Component reads from `JSON.parse(localStorage.getItem('preferences'))` on every render cycle. With complex preferences object and 60fps re-renders, this adds 40ms per frame.
- Trigger: Profile a page with preferences-heavy component
- Expected: Parsed once, cached
- Actual: Parsed every render cycle

**BZ-122 — Date Library Locale Import Bloats Bundle**
`moment.js` imported with ALL locales (500KB). App only uses English. Dead code not eliminated because of dynamic `require()` usage.
- Trigger: Analyze bundle composition
- Expected: Single locale loaded
- Actual: All 100+ locales in bundle

**BZ-123 — Console.log Left in Production**
Developers left `console.log(userData)` in the auth flow. Every page navigation logs the full user object (including tokens) to the browser console. Performance and security issue.
- Trigger: Open console → Navigate
- Expected: Clean console
- Actual: User data logged on every navigation

**BZ-124 — useEffect Runs on Every Render**
Missing dependency array in `useEffect(() => { fetchData() })`. API called on every render. Component re-renders on data change. Infinite API loop throttled only by React batching.
- Trigger: Open component → Check network tab
- Expected: One API call on mount
- Actual: Continuous API calls

**BZ-125 — Font Loading Causes Invisible Text**
Custom font loaded via `font-display: block`. On slow connections, all text is invisible for 3+ seconds until the font downloads. User sees a blank page with images but no text.
- Trigger: Load page on slow connection (throttle to slow 3G)
- Expected: Fallback font visible immediately
- Actual: Invisible text for 3+ seconds

---

## MASTER PROMPT: BUILD ALL SCENARIOS

```
SYSTEM PROMPT FOR DEV AGENT:

You are building a comprehensive test application called "ProjectHub" — a SaaS
project management tool similar to Linear or Asana. The application should be
realistic and functional, serving as a test bed for the Perceptr bug detection SDK.

ARCHITECTURE:
- React 18 + TypeScript + Vite
- TailwindCSS for styling
- React Router v6 for routing
- Zustand for state management
- Mock API layer (MSW or custom) simulating real network conditions
- WebSocket mock for real-time features

PAGES:
1. Login / Signup
2. Dashboard (summary cards, charts, recent activity)
3. Projects List (table with filtering, sorting, pagination)
4. Project Detail (kanban board, settings)
5. Team Members (invite, roles, permissions)
6. Settings (profile, notifications, integrations)
7. Search (command palette + full search page)
8. Notifications panel

Each page should contain multiple bugs from the BZ-001 to BZ-125 catalog.
Bugs should be REALISTIC — they should look like genuine production mistakes,
not intentional sabotage.

For each bug, add:
- data-bug-id="BZ-XXX" on the nearest parent element
- A comment in code: // BUG:BZ-XXX - [description]
- Log to a global __PERCEPTR_TEST_BUGS__ array when the bug condition triggers

Map bugs to pages:
- Login/Signup: BZ-001,002,003,008,056,057,058,060,061
- Dashboard: BZ-036,037,040,050,051,053,055,086,087,088,119,120
- Projects Table: BZ-038,039,041,042,043,044,045,046,047,048,049,052,054,116
- Project Detail: BZ-011,019,101,102,104,106,107,109
- Team: BZ-059,062,063,066,067,068,069
- Settings: BZ-004,005,009,015,016,017
- Search: BZ-010,019,094,109,110
- Navigation/Global: BZ-021,023,024,025,029,030,031,032,033,034,035
- Visual/Layout: BZ-071,072,073,074,075,076,078,080,081,084,085
- Performance: BZ-093,098,100,117,118,121,122,123,124,125
- Async: BZ-089,090,091,092,095,096,097,099

BUILD INSTRUCTION:
Implement the app page by page. For each page, integrate the assigned bugs
naturally into the code. The bugs should be the kind that would pass code review
if reviewers weren't specifically looking for them.

OUTPUT: A fully functional React app that is also a comprehensive bug test suite.
```

---

## USAGE GUIDE

### For Testing Perceptr
1. Deploy ProjectHub to a staging environment
2. Install Perceptr SDK
3. Run automated user flows (Playwright scripts) that trigger each bug
4. Score: What percentage of BZ scenarios does Perceptr detect?
5. Grade detection by category, difficulty, and time-to-detect

### For Demos
- Cherry-pick 5-10 impressive scenarios (mix of difficulties)
- Show live detection → root cause → fix suggestion pipeline
- Best demo bugs: BZ-005 (date off by one), BZ-011 (form data loss), BZ-046 (optimistic rollback), BZ-094 (race condition), BZ-051 (floating point math)

### For Competitive Benchmarking
- Deploy same app with competitor SDKs (FullStory, Sentry, LogRocket)
- Compare: detection rate, time-to-detect, root cause accuracy
- Publish results (great content marketing)

### Scoring Matrix
| Category | Easy 🟢 | Medium 🟡 | Hard 🔴 | Stealth ⚫ |
|----------|---------|-----------|---------|------------|
| Detected in <5s | 5pts | 10pts | 20pts | 40pts |
| Detected in <30s | 3pts | 7pts | 15pts | 30pts |
| Detected in <5min | 1pt | 3pts | 7pts | 15pts |
| Not detected | 0pts | 0pts | 0pts | 0pts |
| **Max per bug** | **5pts** | **10pts** | **20pts** | **40pts** |

**Total possible: 2,500 points across 125 bugs**
