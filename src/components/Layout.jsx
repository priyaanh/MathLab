import { Outlet } from 'react-router-dom'
import NavBar from './NavBar'

const Layout = () => (
    <div className="site">
        <NavBar />
        <Outlet />
        <footer className="footer">
            MathLab · built with React · a stylish home for calculators &amp; graphing tools
        </footer>
    </div>
)

export default Layout
