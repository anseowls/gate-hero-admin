import { createContext, useContext } from 'react';
import type { Api } from './api/client.ts';
import type { Me } from '@shared';
export const ApiCtx = createContext<Api>(null as any);
export const useApi = () => useContext(ApiCtx);
export interface AuthState { me: Me | null; setMe: (m: Me | null) => void; logout: () => void }
export const AuthCtx = createContext<AuthState>(null as any);
export const useAuth = () => useContext(AuthCtx);
