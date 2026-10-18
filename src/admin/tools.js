// Admin tools registry. To add a tool later, build its component and add an
// entry here; it shows up in the Admin section automatically.
import { lazy } from "react";

export const ADMIN_TOOLS = [
  {
    key: "households",
    icon: "🏘️",
    title: "Manage households",
    description: "Create households, copy their links, rename or delete them.",
    Component: lazy(() => import("./ManageHouseholds.jsx")),
  },
];
