import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureCurrentUserRole, type AppRole } from "@/lib/auth.functions";

export type { AppRole };

interface AuthState {
  session: Session | null;
  user: User | null;
  /** Rol "primario" para gates simples: admin si lo tiene, sino el primero */
  role: AppRole | null;
  roles: AppRole[];
  hasRole: (r: AppRole | AppRole[]) => boolean;
  /** Nombre real del usuario desde profiles.full_name (fallback email) */
  displayName: string;
  /** Etiquetas de roles en español, separadas por " · " */
  roleLabel: string;
  loading: boolean;
  refreshRole: () => Promise<void>;
  signOut: () => Promise<void>;
}

const ROLE_ES: Record<AppRole, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  facturacion: "Facturación",
  cartera: "Cartera",
  bodega: "Bodega",
  conductor: "Conductor",
};

const Ctx = createContext<AuthState | undefined>(undefined);

async function loadRoles(userId: string): Promise<AppRole[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as AppRole);
}

function primary(roles: AppRole[]): AppRole | null {
  if (roles.length === 0) return null;
  if (roles.includes("admin")) return "admin";
  return roles[0];
}

async function loadProfileName(userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return data?.full_name ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const ensureRole = useServerFn(ensureCurrentUserRole);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const resolve = async (userId: string): Promise<AppRole[]> => {
      const current = await loadRoles(userId);
      if (current.length > 0) return current;
      const ensured = await ensureRole({}).catch(() => ({ roles: ["vendedor" as AppRole] }));
      return ensured.roles;
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        setLoading(true);
        setTimeout(() => {
          Promise.all([resolve(newSession.user.id), loadProfileName(newSession.user.id)])
            .then(([rs, name]) => { if (active) { setRoles(rs); setProfileName(name); } })
            .catch(() => { if (active) { setRoles([]); setProfileName(null); } })
            .finally(() => { if (active) setLoading(false); });
        }, 0);
      } else {
        setRoles([]);
        setProfileName(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      try {
        if (!active) return;
        setSession(data.session);
        if (data.session?.user) {
          const [rs, name] = await Promise.all([resolve(data.session.user.id), loadProfileName(data.session.user.id)]);
          if (active) { setRoles(rs); setProfileName(name); }
        }
      } catch {
        if (active) setRoles([]);
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const email = session?.user?.email ?? "";
  const roleLabel = roles.map((r) => ROLE_ES[r]).filter(Boolean).join(" · ") || "Usuario";

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    role: primary(roles),
    roles,
    hasRole: (r) => {
      const need = Array.isArray(r) ? r : [r];
      return need.some((x) => roles.includes(x));
    },
    displayName: profileName || email || "Usuario",
    roleLabel,
    loading,
    refreshRole: async () => {
      if (session?.user) {
        const [rs, name] = await Promise.all([loadRoles(session.user.id), loadProfileName(session.user.id)]);
        setRoles(rs); setProfileName(name);
      }
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
