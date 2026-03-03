"use client";

// const toolbarStyles = cva(["flex items-center flex-wrap gap-2 mb-4"]);
// const infoTextStyles = cva(["text-[0.85rem] text-(--foreground-muted)"]);
// const buttonGroupStyles = cva(["flex gap-2 ml-auto"]);
// const cropImageStyles = cva(["block max-w-full h-auto"]);

const data = [
  { id: 1, name: "Ada" },
  { id: 2, name: "Bob", submit: true },
];
const columns = [
  {
    accessorKey: "submit",
    header: "Action",
  },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "id", header: "ID" },
];

export default function DataTable(
  // { data, columns }
) {
  return <>test</>;
}
