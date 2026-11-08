/**
 * Authentication seam.
 *
 * The backend currently exposes owner auth only:
 *   POST /api/auth/register  { name, email, mobile, password }
 *   POST /api/auth/login     { email, password }
 * Both return `ApiResponse<T> = { success, message, data, timestamp }`.
 * The login response does not yet return a token, tenant id or role, so the
 * frontend cannot build a real session from it. Until it does, the demo uses
 * the role switcher below.
 */
import { useSession } from "../store/session";
import type { DemoSession } from "../types";

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  timestamp: string;
}

export const authService = {
  signInDemo(session: DemoSession) {
    useSession.getState().signIn(session);
  },
  signOut() {
    useSession.getState().signOut();
  },
};
