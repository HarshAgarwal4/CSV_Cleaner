import { createBrowserRouter} from 'react-router-dom'
import Home from '../pages/Home.jsx';
import SignUp from '../pages/signup.jsx';
import LoginPage from '../pages/login.jsx';
import { ProtectedRoute } from './Auth.jsx';
import { Dashboard } from '../pages/Dashboard.jsx';

const Routes = createBrowserRouter([
    {
        path: '/',
        element: <Home />
    },
    {
        path: '/signup',
        element: <SignUp />
    },
    {
        path: '/login',
        element: <LoginPage />
    },
    {
        path: '/dashboard',
        element: <ProtectedRoute> <Dashboard /> </ProtectedRoute>
    }
])

export default Routes;