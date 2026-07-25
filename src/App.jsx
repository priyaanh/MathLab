import { HashRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './theme/ThemeContext'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import ScientificPage from './pages/ScientificPage'
import GraphPage from './pages/GraphPage'
import LinesPage from './pages/LinesPage'
import ShapesPage from './pages/ShapesPage'
import InequalitiesPage from './pages/InequalitiesPage'
import ThemesPage from './pages/ThemesPage'
import TransformPage from './pages/TransformPage'
import GuidePage from './pages/GuidePage'
import LevelPage from './pages/LevelPage'
import './styles/site.css'

/**
 * MathLab — a multi-page math site.
 * HashRouter keeps deep links working on static hosts like GitHub Pages
 * (matches the #/route style, e.g. #/scientific).
 */
function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="scientific" element={<ScientificPage />} />
            <Route path="graph" element={<GraphPage />} />
            <Route path="lines" element={<LinesPage />} />
            <Route path="shapes" element={<ShapesPage />} />
            <Route path="transformations" element={<TransformPage />} />
            <Route path="inequalities" element={<InequalitiesPage />} />
            <Route path="themes" element={<ThemesPage />} />
            <Route path="guide" element={<GuidePage />} />
            <Route path="learn/:level" element={<LevelPage />} />
            <Route path="*" element={<HomePage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  )
}

export default App
