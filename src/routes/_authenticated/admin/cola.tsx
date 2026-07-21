import { createFileRoute } from "@tanstack/react-router";
import { ColaPage } from "@/components/cola-page";

export const Route = createFileRoute("/_authenticated/admin/cola")({ component: ColaPage });
