## 1. Install dependencies

- [x] 1.1 Run `pnpm add next-themes` to install the theme provider package

## 2. Add ThemeProvider to root layout

- [x] 2.1 Create `components/theme-provider.tsx` wrapping `next-themes` `ThemeProvider` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`
- [x] 2.2 Import and wrap `<ThemeProvider>` in `app/layout.tsx` around `<TooltipProvider>`, add `suppressHydrationWarning` to `<html>`

## 3. Add theme toggle to sidebar aux area

- [x] 3.1 Create a `ThemeToggle` component with a button that cycles light → dark → system using `useTheme()` from `next-themes`
- [x] 3.2 Render `Sun`/`Moon`/`Monitor` icons from `lucide-react` based on current theme
- [x] 3.3 Add the toggle as an item in the `auxiliary` section of `config/sidebar-menu.json`, or render it directly in the sidebar footer area

## 4. Verify

- [x] 4.1 Confirm system default applies on first visit (run `npm run dev` and check)
- [x] 4.2 Confirm choice persists across page reloads
- [x] 4.3 Confirm no flash of wrong theme on load
- [x] 4.4 Confirm toggle exists in sidebar aux area and cycles correctly
