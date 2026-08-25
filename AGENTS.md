# AI Agent Workspace & Progress Handoff

## 1. Project Status Summary

This repository is a self-service photo booth terminal application built with Electron, React, TypeScript, Tailwind CSS, and Zustand.

The project is structured as a **pnpm monorepo**:
- `apps/booth`: Electron application containing both the Electron main/preload processes and the React + Vite renderer.
- `packages/types`: Shared TypeScript interfaces for core session, layout, and frames.
- `packages/ui`: Shared React/Tailwind UI component library.

---

## 2. Completed Foundation (Phase 0)

The following foundation setup tasks have been fully completed:

- [x] **TASK-001**: Initialize pnpm monorepo (`pnpm-workspace.yaml`, root `package.json`, `.npmrc` with approved builds for `electron` and `esbuild`).
- [x] **TASK-002**: Configure TypeScript strict mode (root `tsconfig.json`, `packages/types/tsconfig.json`, `packages/ui/tsconfig.json`, `apps/booth/electron/tsconfig.json`, and `apps/booth/renderer/tsconfig.json`).
- [x] **TASK-003**: Configure ESLint and Prettier (`.eslintrc.json`, `.prettierrc`, `.eslintignore`, `.prettierignore`).
- [x] **TASK-004**: Create Electron application shell (`apps/booth/electron/main.ts` loading dev server or production build).
- [x] **TASK-005**: Create React + Vite renderer (`apps/booth/renderer/index.html`, `src/main.tsx`, `src/App.tsx`, `vite.config.ts`).
- [x] **TASK-006**: Create secure Electron preload (`apps/booth/electron/preload.ts` and `apps/booth/renderer/src/global.d.ts`).
- [x] **TASK-007**: Configure Tailwind CSS (`apps/booth/tailwind.config.js`, `postcss.config.js`, `apps/booth/renderer/src/index.css`).
- [x] **TASK-008**: Configure shadcn/ui base (`packages/ui/src/utils.ts` classname merger).
- [x] **TASK-009**: Create shared design tokens (CSS variables defined in `index.css`).
- [x] **TASK-010**: Create shared UI package (`packages/ui` linked into the monorepo).
- [x] **TASK-011**: Create shared types package (`packages/types` with core interfaces).
- [x] **TASK-012**: Create basic Zustand store (`apps/booth/renderer/src/store/sessionStore.ts` with complete screen router and state transitions).

---

## 3. Next Tasks: Phase 1 — Static Customer UI

The next objective is to build the interactive customer UI flow screens.

- [ ] **TASK-013**: Create booth app shell and screen router (using `currentScreen` from `sessionStore`).
- [ ] **TASK-014**: Create mock layouts and frames data in renderer.
- [ ] **TASK-015**: Create manual payment screen (`SCREEN-01`).
- [ ] **TASK-016**: Create tutorial / start screen (`SCREEN-02`).
- [ ] **TASK-017**: Create layout selection screen (`SCREEN-03`).
- [ ] **TASK-018**: Create frame selection screen (`SCREEN-04`).
- [ ] **TASK-019**: Create ready / start screen (`SCREEN-05`).
- [ ] **TASK-020**: Create photo capture screen (`SCREEN-06`) with simulated camera view and countdown.
- [ ] **TASK-021**: Create countdown component.
- [ ] **TASK-022**: Create photo review screen (`SCREEN-07`).
- [ ] **TASK-023**: Create use-photo / retake interaction.
- [ ] **TASK-024**: Implement 3-attempt rule with disablement on the 3rd attempt.
- [ ] **TASK-025 - 027**: Implement photo 1, 2, and 3 flows.
- [ ] **TASK-028**: Create session progress UI.
- [ ] **TASK-029**: Create final preview screen (`SCREEN-08`).
- [ ] **TASK-030**: Create print + QR screen (`SCREEN-09`).
- [ ] **TASK-031**: Create completion screen (`SCREEN-10`).
- [ ] **TASK-032 - 034**: Add loading, error, and timeout/reset flows.

---

## 4. Run & Test Instructions

### Setup & Install
Ensure you use `corepack pnpm` to run all commands:
```bash
corepack pnpm install
```

### Dev Mode
Starts Vite dev server for the renderer and compiles/spawns Electron:
```bash
corepack pnpm --filter booth dev
```

### Build Check
Compiles the React application and compiling Electron's main process:
```bash
corepack pnpm --filter booth build
```
