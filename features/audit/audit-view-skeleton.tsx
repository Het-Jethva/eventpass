import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function AuditViewSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <Skeleton className="h-5 w-48 rounded-md" />
      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <Table className="text-xs">
          <TableHeader className="bg-muted/50 text-muted-foreground">
            <TableRow>
              <TableHead scope="col">Timestamp</TableHead>
              <TableHead scope="col">Actor</TableHead>
              <TableHead scope="col">Action</TableHead>
              <TableHead scope="col">Target</TableHead>
              <TableHead scope="col">Source</TableHead>
              <TableHead scope="col">Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }, (_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Skeleton className="h-3 w-28 rounded-md" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-24 rounded-md" />
                  <Skeleton className="mt-1.5 h-2.5 w-32 rounded-md" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-28 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-24 rounded-md" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-32 rounded-md" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <span className="sr-only">Loading audit entries</span>
    </div>
  );
}
