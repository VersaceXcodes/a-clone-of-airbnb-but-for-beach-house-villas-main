import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserSession = {
  user_id: string | null;
  is_authenticated: boolean;
  is_host: boolean;
  token: string | null;
  display_name: string | null;
  profile_photo_url: string | null;
  superhost_status: boolean;
  unread_message_count: number;
  last_active_at: string | null;
  email: string | null;
};

type UserSessionStore = {
  user: UserSession;
  login: (userData: Partial<UserSession>) => void;
  logout: () => void;
  updateUser: (userData: Partial<UserSession>) => void;
  setUnreadCount: (count: number) => void;
};

const initialUserState: UserSession = {
  user_id: null,
  is_authenticated: false,
  is_host: false,
  token: null,
  display_name: null,
  profile_photo_url: null,
  superhost_status: false,
  unread_message_count: 0,
  last_active_at: null,
  email: null,
};

const useUserSession = create<UserSessionStore>()(
  persist(
    (set, get) => ({
      user: initialUserState,
      
      login: (userData) => {
        set({
          user: {
            ...get().user,
            ...userData,
            is_authenticated: true,
          }
        });
      },
      
      logout: () => {
        set({ user: initialUserState });
      },
      
      updateUser: (userData) => {
        set({
          user: {
            ...get().user,
            ...userData,
          }
        });
      },
      
      setUnreadCount: (count) => {
        set({
          user: {
            ...get().user,
            unread_message_count: count,
          }
        });
      },
    }),
    {
      name: 'user-session', // unique name for localStorage key
    }
  )
);

export default useUserSession; 