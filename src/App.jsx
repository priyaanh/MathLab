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
import UnitsPage from './pages/UnitsPage'
import BasePage from './pages/BasePage'
import ConstantsPage from './pages/ConstantsPage'
import StatsPage from './pages/StatsPage'
import SolverPage from './pages/SolverPage'
import MatrixPage from './pages/MatrixPage'
import DerivativePage from './pages/DerivativePage'
import TrianglePage from './pages/TrianglePage'
import ExercisesPage from './pages/ExercisesPage'
import ProfilePage from './pages/ProfilePage'
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
            <Route path="exercises" element={<ExercisesPage />} />
            <Route path="exercises/:skillId" element={<ExercisesPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="scientific" element={<ScientificPage />} />
            <Route path="graph" element={<GraphPage />} />
            <Route path="lines" element={<LinesPage />} />
            <Route path="shapes" element={<ShapesPage />} />
            <Route path="transformations" element={<TransformPage />} />
            <Route path="inequalities" element={<InequalitiesPage />} />
            <Route path="units" element={<UnitsPage />} />
            <Route path="bases" element={<BasePage />} />
            <Route path="constants" element={<ConstantsPage />} />
            <Route path="statistics" element={<StatsPage />} />
            <Route path="solve" element={<SolverPage />} />
            <Route path="derivative" element={<DerivativePage />} />
            <Route path="triangle" element={<TrianglePage />} />
            <Route path="matrix" element={<MatrixPage />} />
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
