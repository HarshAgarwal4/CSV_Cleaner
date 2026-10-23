import { create } from 'zustand';
import axios from '../services/axios';
import { toast } from 'react-toastify';

export const useStore = create((set, get) => ({
    user: null,
    isLoading: true,
    setIsLoading: (data) => set({ isLoading: data }),
    setUser: (data) => set({ user: data }),
    fetchUser: async (silent = true) => {
        try {
            let r = await axios.post('/me');
            if (r.status === 200 && r.data.status === 1) {
                set({ user: r.data.user });
                if (!silent) toast.success("Welcome back, " + (r.data.user.name || "User"));
                return r.data.user;
            } else {
                set({ user: null });
            }
        } catch (err) {
            set({ user: null });
            if (!silent) toast.error("Could not fetch user profile");
        } finally {
            set({ isLoading: false });
        }
    },
    logout: async () => {
        try {
            let r = await axios.post('/logout');
            if (r.data?.status === 1) {
                set({ user: null });
                toast.success("Logged out successfully");
            } else {
                set({ user: null });
            }
        } catch (err) {
            console.error(err);
            set({ user: null });
            toast.error("Error logging out");
        }
    }
}));
