import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ShoppingBag, ListChecks, User, LogOut, Plus, Package, Users, Inbox, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/flow/NotificationBell";

type Tab = { to: string; label: string; icon: typeof ShoppingBag; exact: boolean; center?: boolean };

export function VendedorLayout() {
  const { displayName, roleLabel, signOut, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isVendor = hasRole("vendedor") || hasRole("admin");
  const isBodega = hasRole("bodega");
  const isConductor = hasRole("conductor");
  const isOperativo = !isVendor && (isBodega || isConductor);

  // Sidebar del vendedor: exactamente 5 botones (Inicio, Pedidos, Nuevo, Clientes, Mapa).
  // Operativos (bodega/conductor puros) tienen sus propios accesos.
  const tabs: Tab[] = [];
  if (isVendor) {
    tabs.push({ to: "/vendedor", label: "Inicio", icon: ShoppingBag, exact: true });
    tabs.push({ to: "/vendedor/pedidos", label: "Pedidos", icon: ListChecks, exact: false });
    tabs.push({ to: "/vendedor/nuevo", label: "Nuevo", icon: Plus, exact: false, center: true });
    tabs.push({ to: "/vendedor/clientes", label: "Clientes", icon: Users, exact: false });
    tabs.push({ to: "/vendedor/mapa", label: "Mapa", icon: MapPin, exact: false });
  } else if (isOperativo) {
    tabs.push({ to: "/vendedor", label: "Inicio", icon: ShoppingBag, exact: true });
    tabs.push({ to: "/vendedor/bandeja", label: "Bandeja", icon: Inbox, exact: false });
    // Bodega ya NO ve el mapa (requisito nuevo). Conductor sí lo ve.
    if (isConductor) tabs.push({ to: "/vendedor/mapa", label: "Mapa", icon: MapPin, exact: false });
    if (isBodega) tabs.push({ to: "/vendedor/productos", label: "Stock", icon: Package, exact: false });
  }

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b px-4 py-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <Link to="/vendedor/perfil" className="flex items-center gap-3 min-w-0 group">
          <div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 text-primary grid place-items-center font-semibold">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate leading-tight text-sm group-hover:text-primary transition-colors">{displayName}</div>
            <div className="text-[11px] text-muted-foreground truncate">{roleLabel}</div>
          </div>
        </Link>
        <div className="flex items-center gap-0.5 shrink-0">
          <NotificationBell />
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/vendedor/perfil" })} aria-label="Perfil">
            <User className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Salir">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto pb-24">
        <Outlet />
      </main>

      {tabs.length > 0 && (
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
                    "absolute -top-5 w-14 h-14 rounded-full grid place-items-center shadow-lg transition-all bg-primary text-primary-foreground",
                    active ? "scale-105" : "hover:scale-105",
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
      )}
    </div>
  );
}
