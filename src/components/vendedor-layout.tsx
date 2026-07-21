import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ShoppingBag, ListChecks, User, LogOut, Plus, Package, Users, Inbox, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/flow/NotificationBell";

type Tab = { to: string; label: string; icon: typeof ShoppingBag; exact: boolean; center?: boolean };

export function VendedorLayout() {
  const { user, signOut, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isVendor = hasRole("vendedor") || hasRole("admin");
  const isOperativo = hasRole("bodega") || hasRole("conductor");

  // Construir tabs según TODOS los roles del usuario (admite combinaciones, p. ej. bodega+vendedor).
  const tabs: Tab[] = [{ to: "/vendedor", label: "Inicio", icon: ShoppingBag, exact: true }];
  if (isVendor) tabs.push({ to: "/vendedor/pedidos", label: "Pedidos", icon: ListChecks, exact: false });
  if (isOperativo) tabs.push({ to: "/vendedor/bandeja", label: "Bandeja", icon: Inbox, exact: false });
  if (isVendor) tabs.push({ to: "/vendedor/nuevo", label: "Nuevo", icon: Plus, exact: false, center: true });
  if (isVendor) tabs.push({ to: "/vendedor/clientes", label: "Clientes", icon: Users, exact: false });
  tabs.push({ to: "/vendedor/mapa", label: "Mapa", icon: MapPin, exact: false });
  if (isOperativo) tabs.push({ to: "/vendedor/productos", label: "Stock", icon: Package, exact: false });
  tabs.push({ to: "/vendedor/perfil", label: "Perfil", icon: User, exact: false });

  const roleLabels: string[] = [];
  if (hasRole("vendedor")) roleLabels.push("Vendedor");
  if (hasRole("bodega")) roleLabels.push("Bodega");
  if (hasRole("conductor")) roleLabels.push("Conductor");
  if (hasRole("facturacion")) roleLabels.push("Facturación");
  if (hasRole("cartera")) roleLabels.push("Cartera");
  if (hasRole("admin")) roleLabels.push("Admin");
  const roleLabel = roleLabels.join(" · ") || "Usuario";


  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{roleLabel}</div>
          <div className="font-semibold truncate max-w-[200px]">{user?.email}</div>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Salir">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-card border-t flex items-stretch z-10 h-16 shadow-[0_-2px_8px_-4px_rgba(0,0,0,0.1)]">
        {tabs.map((t) => {
          const active = t.exact
            ? location.pathname === t.to
            : location.pathname.startsWith(t.to);
          const Icon = t.icon;
          if (t.center) {
            return (
              <Link
                key={t.to}
                to={t.to}
                className="flex-1 relative flex items-end justify-center"
                aria-label={t.label}
              >
                <div className={cn(
                  "absolute -top-5 w-14 h-14 rounded-full grid place-items-center shadow-lg transition-all",
                  active
                    ? "bg-primary text-primary-foreground scale-105"
                    : "bg-primary text-primary-foreground hover:scale-105"
                )}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground pb-1.5">{t.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 text-xs transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-5 h-5" />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
