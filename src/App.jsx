import { lazy } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './theme/ThemeContext'
import Layout from './components/Layout'
import './styles/site.css'

// Home loads eagerly (it's the landing page); every other tool is a lazy chunk
// so the first paint ships only the shell + home instead of the whole site.
import HomePage from './pages/HomePage'

const ScientificPage = lazy(() => import('./pages/ScientificPage'))
const GraphPage = lazy(() => import('./pages/GraphPage'))
const LinesPage = lazy(() => import('./pages/LinesPage'))
const ShapesPage = lazy(() => import('./pages/ShapesPage'))
const InequalitiesPage = lazy(() => import('./pages/InequalitiesPage'))
const ThemesPage = lazy(() => import('./pages/ThemesPage'))
const TransformPage = lazy(() => import('./pages/TransformPage'))
const GuidePage = lazy(() => import('./pages/GuidePage'))
const LevelPage = lazy(() => import('./pages/LevelPage'))
const UnitsPage = lazy(() => import('./pages/UnitsPage'))
const BasePage = lazy(() => import('./pages/BasePage'))
const ConstantsPage = lazy(() => import('./pages/ConstantsPage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const DistributionPage = lazy(() => import('./pages/DistributionPage'))
const SolverPage = lazy(() => import('./pages/SolverPage'))
const MatrixPage = lazy(() => import('./pages/MatrixPage'))
const DerivativePage = lazy(() => import('./pages/DerivativePage'))
const ComplexPage = lazy(() => import('./pages/ComplexPage'))
const TrianglePage = lazy(() => import('./pages/TrianglePage'))
const ExercisesPage = lazy(() => import('./pages/ExercisesPage'))
const QuizPage = lazy(() => import('./pages/QuizPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))

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
            <Route path="quiz" element={<QuizPage />} />
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
            <Route path="distribution" element={<DistributionPage />} />
            <Route path="solve" element={<SolverPage />} />
            <Route path="derivative" element={<DerivativePage />} />
            <Route path="complex" element={<ComplexPage />} />
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
