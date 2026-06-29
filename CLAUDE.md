# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SprintRPC** is an Electron desktop app (macOS-first) that serves as a lightweight gRPC client. It supports proto file import, server reflection, dynamic form-based request building, and all four gRPC call types (unary, server streaming, client streaming, bidirectional streaming).

Stack: Electron + React 19 + TypeScript, bundled via `electron-vite`, styled with MUI v9, state managed with Zustand, gRPC via `@grpc/grpc-js`.

## Commands

```bash
npm run dev          # Start development (Electron + Vite HMR)
npm run build        # Typecheck + build for production
npm run typecheck    # Run both node and web typechecks
npm run lint         # ESLint with cache
npm run format       # Prettier write
npm run test         # Vitest run (unit tests only)
npm run test:watch   # Vitest watch mode

# Platform builds (output to /dist)
npm run build:mac
npm run build:win
npm run build:linux
```

Run a single test file:
```bash
npx vitest run src/renderer/src/__tests__/FormBuilder.test.ts
```

## Architecture

The app follows the standard Electron three-process model:

### Main Process (`src/main/`)
All gRPC work runs here — never in the renderer — because Node.js native modules are required.

- **`index.ts`** — Electron bootstrap; registers all `ipcMain.handle` endpoints: `select-proto-file`, `load-services-by-reflection`, `execute-rpc-call`, `write-stream-chunk`, `end-stream`
- **`protoParser.ts`** — Parses `.proto` files via `@grpc/proto-loader`. `parseProtoFile` loads a file and calls `parsePackageDefinition` to produce `ProtoPackage[]`. `getAncestorDirectories` walks up the directory tree to auto-resolve relative proto imports — this is what prevents manual `includeDirs` config.
- **`grpcReflection.ts`** — Uses `grpc-js-reflection-client` to discover services from a live server without a proto file. Calls `parsePackageDefinition` on the merged result and returns both the parsed tree and the raw `PackageDefinition` for caching.
- **`grpcExecutor.ts`** — Executes all four gRPC call types. Unary resolves via callback; streaming types push events to the renderer window via `webContents.send('stream-event', ...)`. Active streams are tracked in a `Map` so the renderer can write chunks or end streams later via `write-stream-chunk`/`end-stream` IPC calls. When `protoPath === 'reflection'`, uses a cached `PackageDefinition` from `reflectionCache` instead of loading a file.

### Preload (`src/preload/index.ts`)
Bridges IPC to the renderer via `contextBridge`. Exposes `window.api` with: `selectProtoFile`, `loadServicesByReflection`, `executeRpcCall`, `writeStreamChunk`, `endStream`, plus `onStreamEvent` / `onStreamActive` listeners that return cleanup functions.

### Renderer (`src/renderer/src/`)
Standard React SPA with no routing.

- **`store/useGrpcStore.ts`** — Single Zustand store. Holds connection config (host, metadata), loaded proto packages, selected method/service, request payload, response/stream logs, and history (capped at 50 items). All renderer state lives here.
- **`App.tsx`** — Root component. Three-column layout: Sidebar | Request Editor | Response Panel. Registers `onStreamEvent`/`onStreamActive` listeners on mount. Handles `Cmd+Enter` hotkey for invocation.
- **`components/Sidebar.tsx`** — Host input, proto import / reflection trigger, package→service→method tree navigation.
- **`components/FormBuilder.tsx`** — Dynamically renders MUI input fields from the `requestFields` descriptor on the selected method. Exported utilities (`getFieldInputType`, `getDeepValue`, `setDeepValue`, `deleteDeepValue`) are the unit-tested core of this component. `google.protobuf.Timestamp` fields render as timezone-aware datetime pickers. Repeated fields render as add/remove lists. Empty/cleared fields are pruned before the payload is serialized.
- **`components/MetadataTable.tsx`** — Key/value table for per-request gRPC metadata headers (e.g. `authorization`).

## Key Data Flow

1. User loads protos → main process parses them → IPC returns `ProtoPackage[]` → stored in Zustand
2. User selects a method → `selectMethod` populates `requestFields` on the store → FormBuilder renders inputs
3. User invokes → renderer sends payload JSON string via IPC → main process calls gRPC → response returned (unary) or streamed via `webContents.send` (streaming)
4. For client/bidi streams: main stores the active stream in `activeStreams` Map, sends `stream-active` with a `streamId`; subsequent `write-stream-chunk` IPC calls look up that Map entry

## Testing

Unit tests live alongside source in `__tests__` directories. The test suite covers `FormBuilder` helper utilities. Tests use Vitest with no special setup. The main and preload processes are not unit-tested — they require a running Electron context.
