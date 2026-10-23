import FullScreenLoader from "../pages/Loading"
import { useStore } from "../zustand/store"
import { Navigate } from "react-router-dom"

const ProtectedRoute = ({children}) => {
    const user = useStore((state) => state.user)
    const isLoading = useStore((state) => state.isLoading)

    if(isLoading) return <FullScreenLoader />
    if(!user && !isLoading) return <Navigate to='/login' />;

    return children
}

export {ProtectedRoute}