import { createFileRoute } from "@tanstack/react-router";
import { BandejaPage } from "@/components/bandeja-page";

export const Route = createFileRoute("/_authenticated/admin/bandeja")({ component: BandejaPage });
