# Graph Report - oficina-fusion  (2026-09-28)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 367 nodes · 660 edges · 16 communities (11 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a076c98e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15

## God Nodes (most connected - your core abstractions)
1. `cn()` - 34 edges
2. `react` - 28 edges
3. `lucide-react` - 25 edges
4. `compilerOptions` - 16 edges
5. `useCaja()` - 14 edges
6. `scripts` - 9 edges
7. `ResumenTicket` - 8 edges
8. `OperationsBoard()` - 8 edges
9. `SearchBar` - 8 edges
10. `ETicketPanel()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Home()` --calls--> `useCaja()`  [EXTRACTED]
  frontend/app/page.tsx → frontend/lib/caja-store.tsx
- `SearchBar` --calls--> `cn()`  [EXTRACTED]
  frontend/components/ui/SearchBar.tsx → frontend/lib/utils.ts
- `AdminPage()` --calls--> `useCaja()`  [EXTRACTED]
  frontend/app/admin/page.tsx → frontend/lib/caja-store.tsx
- `ProfilePage()` --calls--> `useTheme()`  [EXTRACTED]
  frontend/app/cadete/profile/page.tsx → frontend/app/providers.tsx
- `CadeteOperationsPage()` --calls--> `ResumenTicket`  [EXTRACTED]
  frontend/app/cadete/operations/page.tsx → frontend/lib/caja-store.tsx

## Import Cycles
- 3-file cycle: `frontend/app/providers.tsx -> frontend/components/ui/index.ts -> frontend/components/ui/Toast.tsx -> frontend/app/providers.tsx`

## Communities (16 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (61): Avatar, AvatarProps, sizeClassMap, statusColors, Badge(), BadgeProps, Card, CardContent (+53 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (59): AdminPage(), CadeteOperationsPage(), fmt(), statusClass, digitsFor(), estadoPataClass, estadoPataLabel, ETicketPanel() (+51 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (42): ClosingPage(), DayOp, dayOps, money(), reconciliation, ReconItem, summary, Customer (+34 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (41): dependencies, decimal.js, lucide-react, next, @prisma/client, react, react-dom, sonner (+33 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (21): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+13 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (20): description, devDependencies, turbo, engines, node, pnpm, name, packageManager (+12 more)

### Community 6 - "Community 6"
Cohesion: 0.14
Nodes (13): info, ProfilePage(), stats, frontend_app_globals, metadata, viewport, Theme, ThemeContext (+5 more)

### Community 7 - "Community 7"
Cohesion: 0.17
Nodes (8): nav, nav, Home(), AppShell(), AppShellProps, isActive(), NavEntry, next

### Community 8 - "Community 8"
Cohesion: 0.16
Nodes (13): Panel, PanelBody, PanelBodyProps, PanelContext, PanelContextValue, PanelFooter, PanelFooterProps, PanelHeader (+5 more)

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (13): cache, dependsOn, outputs, cache, dependsOn, persistent, $schema, tasks (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.22
Nodes (8): monedaOptions, tipoOptions, Input, InputProps, Select, SelectProps, Textarea, TextareaProps

## Knowledge Gaps
- **154 isolated node(s):** `CardContextValue`, `TabsContextValue`, `CajaContextType`, `CajaState`, `Cliente` (+149 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 179 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`, `Community 6`, `Community 7`, `Community 8`, `Community 10`?**
  _High betweenness centrality (0.220) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`, `Community 6`, `Community 7`, `Community 8`, `Community 10`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **What connects `CardContextValue`, `TabsContextValue`, `CajaContextType` to the rest of the system?**
  _154 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06377151799687011 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06286748077792854 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05376972530683811 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._