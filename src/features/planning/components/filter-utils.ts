import { FilterFn } from "@tanstack/react-table";

export type TextFilterOp = "contains" | "equals";
export type DateFilterOp = "on" | "before" | "after";

export type TextFilterValue = {
  type: "text";
  op: TextFilterOp;
  value: string;
};

export type DateFilterValue = {
  type: "date";
  op: DateFilterOp;
  value: string;
};

function normalize(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((entry) => String(entry)).join(" ").trim().toLowerCase();
  return String(value).trim().toLowerCase();
}

function toDateOnly(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

export const textColumnFilterFn: FilterFn<any> = (row, columnId, filterValue) => {
  const rowValue = normalize(row.getValue(columnId));

  if (typeof filterValue === "string") {
    const needle = normalize(filterValue);
    if (!needle) return true;
    return rowValue.includes(needle);
  }

  if (filterValue && typeof filterValue === "object" && filterValue.type === "text") {
    const typedFilter = filterValue as TextFilterValue;
    const needle = normalize(typedFilter.value);
    if (!needle) return true;
    if (typedFilter.op === "equals") return rowValue === needle;
    return rowValue.includes(needle);
  }

  return true;
};

export const dateColumnFilterFn: FilterFn<any> = (row, columnId, filterValue) => {
  const rowDate = toDateOnly(row.getValue(columnId));
  if (!rowDate) return false;

  if (typeof filterValue === "string") {
    const filterDate = toDateOnly(filterValue);
    if (!filterDate) return true;
    return rowDate === filterDate;
  }

  if (filterValue && typeof filterValue === "object" && filterValue.type === "date") {
    const typedFilter = filterValue as DateFilterValue;
    const filterDate = toDateOnly(typedFilter.value);
    if (!filterDate) return true;
    if (typedFilter.op === "before") return rowDate < filterDate;
    if (typedFilter.op === "after") return rowDate > filterDate;
    return rowDate === filterDate;
  }

  return true;
};
