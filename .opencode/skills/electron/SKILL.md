# Electron MCP Testing Skill

Electromcp tools for automating and testing Electron apps via Chrome DevTools Protocol (CDP).

## Quick Start

### 1. First Steps (Always)
```
# Check app health
electromcp_app_health

# If not connected, attach or launch
electromcp_app_attach_by_name { name: "YourAppName" }
# OR
electromcp_app_launch { appEntryPoint: "path/to/main.js" }
```

### 2. Essential Workflow
```
1. app_health → verify connection
2. ui_accessibility_snapshot → understand page structure
3. ui_screenshot → visual confirmation (use sparingly)
4. Interact (click, type, select)
5. Verify outcome
```

## Critical Pitfalls to Avoid

### ❌ Don't: Launch Without Rebuilding
**Problem**: `app_launch` starts from `dist-electron/main.js`. If you edit source files, the launched app uses stale code.

**Solution**: Always rebuild before testing:
```bash
npx vite build
```

### ❌ Don't: Rely on Screenshots for Everything
**Problem**: Screenshots are slow, timeout frequently, and don't show dynamic text.

**Solution**: Use `electromcp_app_evaluate_renderer` for batched DOM checks:
```javascript
// Fast DOM query
const result = await electromcp_app_evaluate_renderer({
  script: `JSON.stringify({
    hasHighlights: !!document.querySelector('.search-highlight'),
    highlightCount: document.querySelectorAll('.search-highlight').length,
    inputValue: document.querySelector('.search-input')?.value
  })`
});
```

### ❌ Don't: Use `app_stop` When App is Clean
**Problem**: `app_stop` triggers save dialog when tabs are dirty, and always throws error.

**Solution**: Use `app_stop` only when needed. For clean restarts, just `app_launch` again.

### ❌ Don't: Assume `searchService` is Persistent
**Problem**: `searchService` is a Vue `computed` in `EditorContainer.vue` — every `.value` access creates a new instance.

**Solution**: Use module-level state for persistence across instances.

## Tool Selection Guide

### For Visual Verification
- **Use `ui_screenshot`** sparingly - only when you need visual confirmation of layout/design
- **Use `ui_accessibility_snapshot`** first - cheaper, shows structure
- **Use `electromcp_app_evaluate_renderer`** for dynamic content - fastest

### For DOM Inspection
- **Use `electromcp_app_evaluate_renderer`** for batched checks
- **Use `ui_get_dom`** for specific element HTML
- **Use `ui_get_element`** for element details (text, value, attributes)

### For Interaction
- **Use `ui_click`** for buttons/links
- **Use `ui_type`** for text input (slower but visible)
- **Use `ui_fill`** for instant input (faster, no visibility)

### For State Inspection
- **Use `electromcp_app_evaluate_main`** for main process state (requires `ALLOW_MAIN_EVAL=1`)
- **Use `electron_main_state`** for structured snapshots (no eval needed)

## Common Patterns

### Pattern 1: Test Search Functionality
```
1. app_launch (with fresh build)
2. ui_type { selector: ".search-input", text: "test" }
3. ui_click { selector: ".search-next-btn" }
4. electromcp_app_evaluate_renderer {
    script: `JSON.stringify({
      highlightCount: document.querySelectorAll('.search-highlight').length,
      counterText: document.querySelector('.search-counter')?.textContent
    })`
  }
5. Verify results match expectations
```

### Pattern 2: Test Mode Switching
```
1. app_launch
2. Click mode switcher
3. Verify mode changed via accessibility snapshot
4. Test same functionality in new mode
```

### Pattern 3: Test Visual Rendering
```
1. app_launch
2. Perform action
3. ui_screenshot (only if visual confirmation needed)
4. Compare with baseline if available
```

## Known Gotchas

### 1. Scoped CSS Selectors
Vue scoped CSS adds `data-v-*` attributes. Use attribute selectors:
```javascript
// ❌ May not work
document.querySelector('.search-input')

// ✅ Works
document.querySelector('[data-v-da8a0732].search-input')
// OR use more specific selector
document.querySelector('.floating-search .search-input')
```

### 2. Accessibility Snapshots Miss Some Elements
- Shadow DOM content
- Dynamically rendered text (e.g., "2 / 8" counter)
- Elements inside nested components

**Solution**: Use `electromcp_app_evaluate_renderer` as fallback.

### 3. `app_stop` Always Throws Error
Even when successful, `app_stop` throws "Target page, context or browser has been closed". This is normal - just catch and continue.

### 4. Production Builds Strip console.log
`vite.config.ts` line 104: `drop: command === 'build' ? ['console', 'debugger'] : []`

**Impact**: `console.log` statements won't appear in production builds.

### 5. Module-Level State Persists
If you store state at module level (outside Vue components), it persists across `app_launch` calls until the process is killed.

**Solution**: Use `app_stop` + `app_launch` for clean state, or reset state explicitly.

## Debugging Tips

### 1. Check Console Logs
```javascript
electromcp_app_console_logs { processType: "renderer", limit: 50 }
```

### 2. Inspect Main Process State
```javascript
electromcp_app_evaluate_main {
  script: "JSON.stringify({ appState: globalThis.appState })"
}
```

### 3. Verify Plugin Registration
```javascript
electromcp_app_evaluate_renderer {
  script: `JSON.stringify({
    hasSearchPlugin: !!document.querySelector('[data-search-plugin]'),
    pluginCount: document.querySelectorAll('[data-plugin]').length
  })`
}
```

### 4. Check for Stale Builds
```javascript
electromcp_app_evaluate_renderer {
  script: "document.querySelector('meta[name=version]')?.content"
}
```

## Performance Tips

1. **Batch DOM checks** - One `evaluate_renderer` call with multiple queries
2. **Avoid frequent screenshots** - Use accessibility snapshots or DOM queries
3. **Use `ui_fill` over `ui_type`** - Faster for input fields
4. **Cache selectors** - Reuse selector strings across calls

## Reference Examples

### From Our Project (Alhagi/Crepe Editor)
- **Search testing**: Floating search bar vs GlobalSearch sidebar
- **Code block highlights**: Custom CodeMirror extensions
- **Mode switching**: WYSIWYG → Source → Split mode

### From Community (daytona-electron-test)
- Comprehensive skill at `.opencode/skills/daytona-electron-test/SKILL.md`
- Full testing workflow examples

## When to Use This Skill

Use when:
- Testing Electron app functionality
- Automating UI interactions
- Verifying visual rendering
- Debugging app behavior
- Creating test automation

Do NOT use for:
- Non-Electron web apps
- Native desktop apps (not Electron)
- Backend/API testing
