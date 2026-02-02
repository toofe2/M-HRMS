import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: any | null;
  session: any | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  signIn: async (email, password) => {
    try {
      const { error: signInError, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (signInError) throw signInError;

      // Try to create profile first - if it exists, this will fail gracefully
      const { error: createError } = await supabase
        .from('profiles')
        .upsert([{
          id: data.user.id,
          email: data.user.email,
          first_name: '',
          last_name: '',
          phone: '',
          employment_status: 'full-time',
          hire_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        }], {
          onConflict: 'id',
          ignoreDuplicates: true
        });

      if (createError && createError.code !== '23505') {
        throw createError;
      }

      // Check if user has admin role
      const { data: adminData, error: adminError } = await supabase
        .from('admin_roles')
        .select('user_id')
        .eq('user_id', data.user.id)
        .maybeSingle();
      
      if (adminError) {
        console.error('Error fetching admin status:', adminError);
      }
      
      set({ 
        user: data.user, 
        session: data.session,
        isAdmin: !!adminData
      });
    } catch (error) {
      throw error;
    }
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, isAdmin: false });
  },
  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Try to create profile first - if it exists, this will fail gracefully
        const { error: createError } = await supabase
          .from('profiles')
          .upsert([{
            id: session.user.id,
            email: session.user.email,
            first_name: '',
            last_name: '',
            phone: '',
            employment_status: 'full-time',
            hire_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          }], {
            onConflict: 'id',
            ignoreDuplicates: true
          });

        if (createError && createError.code !== '23505') {
          throw createError;
        }

        // Check admin status
        const { data: adminData, error: adminError } = await supabase
          .from('admin_roles')
          .select('user_id')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (adminError) {
          console.error('Error fetching admin status:', adminError);
        }
        
        set({ 
          user: session.user, 
          session, 
          loading: false,
          isAdmin: !!adminData
        });
      } else {
        set({ 
          user: null, 
          session: null, 
          loading: false,
          isAdmin: false
        });
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ 
        user: null, 
        session: null, 
        loading: false,
        isAdmin: false
      });
    }
  },
}));