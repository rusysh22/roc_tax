import {
  ArrowLeftRight,
  BookOpen,
  Briefcase,
  Building2,
  ClipboardCheck,
  CreditCard,
  FileSpreadsheet,
  FileText,
  FileUp,
  Handshake,
  Gauge,
  LifeBuoy,
  ListChecks,
  ScanText,
  Scale,
  Send,
  Settings,
  ShieldCheck,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { shellMessages } from "@/i18n/shell";

export type MenuItemDef = { label: string; href: string; icon: LucideIcon };
export type ModuleDef = {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Home-tile colour classes (one semantic colour per module). */
  tile: string;
  /** Text colour for the module icon in the sidebar. */
  accent: string;
  href: string;
  items: MenuItemDef[];
  superadminOnly?: boolean;
};

/** Module registry: drives the home grid, sidebar and breadcrumbs. */
export function appModules(locale: Locale): ModuleDef[] {
  const t = shellMessages[locale];
  const app = `/${locale}/app`;
  const admin = `/${locale}/admin`;
  return [
    {
      id: "transactions",
      tile: "bg-info text-white",
      accent: "text-info",
      label: t.modTransactions,
      hint: t.modTransactionsHint,
      icon: FileText,
      href: `${app}/transactions`,
      items: [
        {
          label: t.menuTransactions,
          href: `${app}/transactions`,
          icon: FileText,
        },
        { label: t.menuImports, href: `${app}/imports`, icon: FileUp },
      ],
    },
    {
      id: "contacts",
      tile: "bg-violet text-white",
      accent: "text-violet",
      label: t.modContacts,
      hint: t.modContactsHint,
      icon: Building2,
      href: `${app}/companies`,
      items: [
        { label: t.menuCompanies, href: `${app}/companies`, icon: Briefcase },
        {
          label: t.menuCounterparties,
          href: `${app}/counterparties`,
          icon: Users,
        },
      ],
    },
    {
      id: "coretax",
      tile: "bg-success text-white",
      accent: "text-success",
      label: t.modCoretax,
      hint: t.modCoretaxHint,
      icon: Send,
      href: `${app}/exports`,
      items: [
        { label: t.menuExports, href: `${app}/exports`, icon: FileSpreadsheet },
        {
          label: t.menuReconciliation,
          href: `${app}/reconciliation`,
          icon: Scale,
        },
      ],
    },
    {
      id: "settings",
      tile: "bg-foreground text-background",
      accent: "text-muted-foreground",
      label: t.modSettings,
      hint: t.modSettingsHint,
      icon: Settings,
      href: `${app}/settings`,
      items: [
        { label: t.menuWorkspace, href: `${app}/settings`, icon: Users },
        { label: t.menuOcr, href: `${app}/settings/ocr`, icon: ScanText },
        {
          label: t.menuBilling,
          href: `${app}/settings/billing`,
          icon: CreditCard,
        },
      ],
    },
    {
      id: "help",
      tile: "bg-warning text-white",
      accent: "text-warning",
      label: t.modHelp,
      hint: t.modHelpHint,
      icon: LifeBuoy,
      href: `${app}/help`,
      items: [{ label: t.menuHelp, href: `${app}/help`, icon: BookOpen }],
    },
    {
      id: "admin",
      tile: "bg-danger text-white",
      accent: "text-danger",
      label: t.modAdmin,
      hint: t.modAdminHint,
      icon: ShieldCheck,
      href: admin,
      superadminOnly: true,
      items: [
        { label: t.menuAdminOverview, href: admin, icon: Gauge },
        { label: t.menuJobs, href: `${admin}/jobs`, icon: ListChecks },
        {
          label: t.menuTaxRules,
          href: `${admin}/tax-rules`,
          icon: ClipboardCheck,
        },
        {
          label: t.menuXmlTemplates,
          href: `${admin}/xml-templates`,
          icon: Workflow,
        },
        {
          label: t.menuOcrProviders,
          href: `${admin}/ocr-providers`,
          icon: ScanText,
        },
        {
          label: t.menuAdminBilling,
          href: `${admin}/billing`,
          icon: ArrowLeftRight,
        },
        {
          label: t.menuAdminSales,
          href: `${admin}/sales`,
          icon: Handshake,
        },
      ],
    },
  ];
}

/** Most specific menu item whose href prefixes the current path. */
export function activeMenu(modules: ModuleDef[], path: string) {
  let best: { module: ModuleDef; item: MenuItemDef } | null = null;
  for (const mod of modules)
    for (const item of mod.items) {
      const match = path === item.href || path.startsWith(`${item.href}/`);
      if (match && (!best || item.href.length > best.item.href.length))
        best = { module: mod, item };
    }
  return best;
}
