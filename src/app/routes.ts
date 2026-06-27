export type AppRouteId = "salary" | "advances" | "time" | "calendar" | "config";

export type AppRoute = {
  id: AppRouteId;
  label: string;
};

export const appRoutes: AppRoute[] = [
  { id: "salary", label: "Salary" },
  { id: "advances", label: "Advances" },
  { id: "time", label: "Time" },
  { id: "calendar", label: "Calendar" },
  { id: "config", label: "Config" },
];
