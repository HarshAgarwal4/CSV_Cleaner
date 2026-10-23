import { useEffect } from 'react';
import Routes from './services/Routes';
import { RouterProvider } from 'react-router-dom';
import { useStore } from './zustand/store';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './toast.css';

function App() {
  const fetchUser = useStore((state) => state.fetchUser);

  useEffect(() => {
    fetchUser(true);
  }, []);

  return (
    <>
      <RouterProvider router={Routes} />
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </>
  );
}

export default App;
