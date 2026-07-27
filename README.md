# 🧮 MathLab

A stylish, multi-page React math site with switchable themes. Tools:

- **Home** (`#/`) — landing page; search and drag-to-reorder the tool cards.
- **Exercises** (`#/exercises`) — 118+ auto-generated practice problems from early math to college, with instant checks and mastery streaks.
- **Scientific Calculator** (`#/scientific`) — full expression editing, memory, DEG/RAD trig, keyboard accessibility.
- **Function Grapher** (`#/graph`) — plot y = f(x), zeros, intersections, trace, value tables.
- **Equation Solver** (`#/solve`) — linear, quadratic, 2×2 systems (exact steps) plus square roots and any higher power (numeric roots).
- **Derivative Calculator** (`#/derivative`) — symbolic differentiation, rules used, tangent line.
- **Lines & Segments** (`#/lines`) — slope, length, midpoint, equation.
- **Shapes** (`#/shapes`) — circles (area in π form), rectangles, polygons; drag handles to reshape.
- **Transformations** (`#/transformations`) — translate, dilate, rotate, reflect.
- **Inequalities** (`#/inequalities`) — shade regions like `y < 2x + 1` and see overlaps.
- **Triangle Solver** (`#/triangle`), **Unit Converter** (`#/units`), **Base Converter** (`#/bases`), **Statistics** (`#/statistics`), **Matrix Calculator** (`#/matrix`), **Constants Library** (`#/constants`).
- **Profile** (`#/profile`) — practice stats and progress backup (export/import); reachable via the 👤 nav icon.
- **Guide** (`#/guide`) — what every tool does. **Themes** (`#/themes`) — six looks; choice is saved.

Every graph supports **drag / pinch to pan and zoom**, wheel-zoom, and arrow-key panning once focused. An **on-screen keypad** pops up on math fields for keyboard-free input.

Routing uses `HashRouter` so deep links work on static hosts like GitHub Pages.
Pages are code-split (lazy-loaded) so first paint ships only the shell + home.
Themes are CSS-variable maps in `src/theme/themes.js` — add an object there and it
shows up everywhere automatically.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # math + solver + exercise self-consistency suite (node)
npm run build    # production build
```

Tests run in CI before every GitHub Pages deploy (`.github/workflows/deploy.yml`).

## Scientific Calculator features

## ✨ Features

### 🧠 Mathematical Capabilities
- **Scientific Functions**: sin, cos, tan, log, ln, sqrt, x², x³, 1/x, x!, 10^x
- **Mathematical Constants**: π (pi), e (Euler's number), φ (golden ratio)
- **Advanced Operations**: Power functions, modulo, parentheses grouping
- **Expression Evaluation**: Full PEMDAS/BODMAS order of operations
- **Memory Functions**: MC, MR, M+, M-, MS
- **Average Calculator**: Extract numbers from expressions and calculate mean

### ♿ Accessibility Features
- **Full Keyboard Navigation**: Tab through buttons, arrow key grid navigation
- **Direct Input**: Type numbers and operators without navigation
- **Screen Reader Support**: ARIA labels, live regions, semantic markup
- **Expression Editing**: Click-to-edit with cursor positioning and keyboard controls
- **High Contrast Themes**: Three themes optimized for visual accessibility
- **Focus Indicators**: Clear visual feedback for keyboard navigation

### 🎨 User Interface
- **Three Themes**: Black/Orange, Black/White, White/Black
- **Dual Display**: Expression history and current input
- **Scientific/Normal Modes**: Toggle complexity level
- **Responsive Design**: Works on desktop and mobile
- **Visual Feedback**: Hover effects, button animations, status banners

### 🚀 Performance & Optimization
- **Component Architecture**: Modular design with 8 focused components + 4 custom hooks
- **React Performance**: React.memo, useMemo, useCallback optimizations
- **Code Splitting**: Efficient bundle loading with Vite
- **PWA Support**: Installable app with offline functionality
- **Testing**: Comprehensive test suite with Vitest + React Testing Library
- **Type Safety**: Enhanced TypeScript support

### 🖱️ Input Methods
- **Mouse/Touch**: Click any button
- **Keyboard Navigation**: Tab + arrow keys + Enter/Space
- **Direct Typing**: Numbers, operators, equals, clear, backspace
- **Expression Editing**: Click expression area for advanced editing

## 🚀 Getting Started

### Prerequisites
- Node.js (version 14 or higher)
- npm or yarn

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd Calc

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Usage

#### Basic Operations
1. Click numbers and operators or type directly
2. Press `=` or `Enter` to calculate
3. Use `C` to clear everything

#### Keyboard Accessibility
1. Press `Tab` to enter keyboard navigation
2. Use arrow keys to navigate button grid
3. Press `Enter` or `Space` to activate buttons
4. Press `Escape` to exit navigation mode

#### Expression Editing
1. Click the top expression area
2. Use arrow keys to move cursor
3. Type to insert at cursor position
4. Press `Escape` to exit editing

## ⌨️ Keyboard Shortcuts

### Navigation
- `Tab` / `Shift+Tab`: Navigate buttons
- `Arrow Keys`: Move within button grid
- `Enter` / `Space`: Activate focused button
- `Escape`: Exit navigation mode

### Direct Input
- `0-9`: Numbers
- `+` `-` `*` `/` `%`: Operators  
- `=` `Enter`: Calculate
- `.`: Decimal point
- `C`: Clear
- `Backspace`: Delete

### Expression Editing
- `Arrow Keys`: Move cursor
- `Home` / `End`: Beginning/end
- `Backspace` / `Delete`: Remove characters
- `Escape`: Exit editing

## 🎯 Accessibility Standards

This calculator complies with:
- **WCAG 2.1 AA** guidelines
- **Section 508** accessibility requirements
- **WAI-ARIA** best practices
- **Keyboard accessibility** standards

### Screen Reader Support
- NVDA (Windows)
- JAWS (Windows)  
- VoiceOver (macOS/iOS)
- TalkBack (Android)
- Orca (Linux)

## 🔧 Technical Details

### Built With
- **React 18**: Modern React with hooks
- **Vite**: Fast build tool and dev server
- **CSS3**: Custom styling with theme support
- **JavaScript ES6+**: Modern language features

### Architecture
- **Component-based**: Single App component with hooks
- **State Management**: useState for all calculator state
- **Event Handling**: Unified keyboard and mouse input
- **Accessibility**: ARIA attributes and semantic HTML
- **Responsive**: CSS Grid and Flexbox layouts

### Browser Support
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 📁 Project Structure

```
Calc/
├── public/
│   └── vite.svg
├── src/
│   ├── App.jsx          # Main calculator component
│   ├── App.css          # Styling and themes
│   ├── index.css        # Global styles
│   ├── main.jsx         # React entry point
│   └── assets/
│       └── react.svg
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── vite.config.js       # Vite configuration
├── README.md           # This file
└── ACCESSIBILITY.md    # Detailed accessibility guide
```

## 🎨 Theme Customization

### Available Themes
1. **Black/Orange**: Default high-contrast theme
2. **Black/White**: Maximum contrast for accessibility
3. **White/Black**: Light theme option

### Theme Toggle
- Click the 🎨 theme button
- Cycles through all three themes
- Setting persists during session

## 🧪 Testing

### Manual Testing
- Test keyboard navigation with Tab and arrow keys
- Verify screen reader announcements
- Check mathematical operations accuracy
- Test expression editing functionality

### Accessibility Testing
- Use screen reader software
- Test with keyboard only
- Verify high contrast compliance
- Check focus visibility

## 📚 Additional Resources

- [ACCESSIBILITY.md](./ACCESSIBILITY.md) - Comprehensive accessibility guide
- [Mathematical Functions Documentation](#) - Detailed function reference
- [Keyboard Shortcuts Reference](#) - Complete shortcut list

## 🤝 Contributing

Contributions are welcome! Please ensure:
- Accessibility features remain intact
- New features include keyboard support
- ARIA labels are provided for UI elements
- Changes are tested with screen readers

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Accessibility guidelines from W3C WAI
- Mathematical function implementations
- React and Vite communities
- Accessibility testing tools and communities

---

*Making mathematics accessible to everyone, one calculation at a time.* ♿✨
