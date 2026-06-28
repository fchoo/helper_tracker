export type AppRouteId = "salary" | "advances" | "calendar" | "config";

export type AppRoute = {
  id: AppRouteId;
  label: string;
};

export const appRoutes: AppRoute[] = [
  { id: "salary", label: "Salary" },
  { id: "advances", label: "Advances" },
  { id: "calendar", label: "Time & Calendar" },
  { id: "config", label: "Config" },
];
