import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Shaped like the real table — same columns, same two-line attendee cell — so a
 * search does not visibly reflow the page when results arrive.
 */
export function RosterTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-5 w-40 rounded-md" />
      <div className="overflow-hidden rounded-2xl border bg-background">
        <Table>
          <TableHeader className="bg-muted/50 text-xs text-muted-foreground">
            <TableRow>
              <TableHead scope="col">Attendee</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col">Ticket</TableHead>
              <TableHead scope="col">Registered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }, (_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Skeleton className="h-4 w-36 rounded-md" />
                  <Skeleton className="mt-2 h-3 w-48 rounded-md" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-28 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24 rounded-md" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20 rounded-md" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <span className="sr-only">Loading registrations</span>
    </div>
  );
}
