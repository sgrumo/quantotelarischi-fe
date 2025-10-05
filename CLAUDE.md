# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run all commands from the project root:

| Command | Action |
| :------ | :----- |
| `npm run dev` | Start development server at `localhost:4321` |
| `npm run build` | Build production site to `./dist/` |
| `npm run preview` | Preview production build locally |
| `npm run astro ...` | Run Astro CLI commands (e.g., `astro check`) |

## Architecture

### Stack
- **Framework**: Astro 5 with Preact integration for interactive components
- **Styling**: TailwindCSS 4 (via Vite plugin)
- **Real-time**: Phoenix Channels (WebSocket) for multiplayer game state
- **Validation**: Zod schemas for runtime type safety
- **Pattern Matching**: ts-pattern for discriminated union handling

### Project Structure

```
src/
├── components/
│   ├── challenge/     # Game-specific components (BettingGame, NewRoom)
│   └── ui/           # Reusable UI components (Button, Card, Badge, etc.)
├── layouts/          # Astro layout templates
├── lib/
│   ├── models/       # Zod schemas and TypeScript types (rooms.ts)
│   └── utils/        # Utility functions (phoenix-connection, result handling)
├── pages/            # Astro pages (index.astro, room.astro)
└── styles/           # Global CSS
```

### Key Architectural Patterns

**Real-time Game Flow**:
The application uses Phoenix Channels for real-time multiplayer betting challenges:

1. **Connection**: `BettingGame.tsx` establishes WebSocket connection to Phoenix server via `new Socket(PUBLIC_WS_URL)`
2. **Channel Join**: Joins room channel (`room:${roomId}`) and receives initial `RoomInfo` state
3. **Event Handling**: Uses discriminated unions (`IncomingActionSchema`) for type-safe event handling:
   - `user_joined`, `challenge_received`, `challenge_accepted`, `challenge_declined`, `bet_completed`
4. **State Management**: Game state machine with states: `Idle`, `WaitingForChallenge`, `WaitingForBet`, `WaitingForCompletion`
5. **Pattern Matching**: Uses `ts-pattern`'s `match()` for exhaustive event handling and state transitions

**Type Safety with Zod**:
All Phoenix channel messages are validated at runtime using Zod schemas in `src/lib/models/rooms.ts`:
- Server responses use snake_case, automatically transformed to camelCase via `.transform()`
- Discriminated unions (`IncomingActionSchema`) ensure type-safe event handling
- Example: `NewRoomResponseSchema`, `JoinRoomResponseSchema`, `RoomInfoSchema`

**Component Architecture**:
- Astro pages (`.astro`) for static/server-rendered content
- Preact components (`.tsx`) for interactive UI with hooks
- UI components use class-variance-authority (`cva`) for variant-based styling
- Path alias `@/*` maps to `./src/*` (configured in `tsconfig.json`)

### Environment Variables

Required in `.env`:
- `PUBLIC_SERVER_URL`: Backend API URL (default: `http://localhost:4000`)
- `PUBLIC_WS_URL`: WebSocket URL for Phoenix (default: `ws://localhost:4000/socket`)

### Code Style

**Prettier** (via `.prettierrc`):
- Single quotes, no semicolons, 4-space tabs
- TailwindCSS class sorting enabled
- Astro import organization enabled

**ESLint** (via `eslint.config.js`):
- TypeScript strict mode
- Astro plugin with all rules
- JSX a11y strict accessibility checks

### Phoenix Channel Integration

When working with Phoenix channels:
- Always validate incoming messages with Zod schemas from `src/lib/models/rooms.ts`
- Handle all possible events in the `IncomingActionSchema` discriminated union
- Use refs (`useRef`) for socket/channel instances to prevent re-creation on re-renders
- Implement proper cleanup in `useEffect` return functions (disconnect socket/leave channel)
- Toast notifications use `sonner` library with incremental IDs for deduplication

### State Management

The game uses local state with Preact hooks:
- `useState` for UI state and game state machine
- `useRef` for socket/channel instances (avoid re-renders)
- `useCallback` for stable function references (e.g., `showToast`)
- `useMemo` for derived state (e.g., role determination from `userId` and `roomInfo`)
