'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, Pencil, Plus, RefreshCcw, RefreshCw, Save, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type DiningTableRow = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export function TablesModule() {
  const [rows, setRows] = useState<DiningTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DiningTableRow | null>(null);
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DiningTableRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<{ data: DiningTableRow[] }>('/api/restaurant/tables');
      setRows(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      toast.error('Could not load tables');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setName('');
    setSortOrder(String(rows.length));
    setDialogOpen(true);
  }

  function openEdit(row: DiningTableRow) {
    setEditing(row);
    setName(row.name);
    setSortOrder(String(row.sortOrder));
    setDialogOpen(true);
  }

  async function handleSave() {
    const nameTrim = name.trim();
    if (!nameTrim) {
      toast.error('Name is required');
      return;
    }
    const sort = Math.min(9999, Math.max(0, Math.floor(Number(sortOrder) || 0)));

    setSaving(true);
    try {
      if (editing) {
        await axios.patch(`/api/restaurant/tables/${editing.id}`, {
          name: nameTrim,
          sortOrder: sort,
        });
        toast.success('Table updated');
      } else {
        await axios.post('/api/restaurant/tables', {
          name: nameTrim,
          sortOrder: sort,
        });
        toast.success('Table added');
      }
      setDialogOpen(false);
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: unknown } } };
      const msg =
        typeof err.response?.data?.error === 'string'
          ? err.response.data.error
          : 'Save failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/restaurant/tables/${deleteTarget.id}`);
      toast.success('Table removed');
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error('Could not delete table');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dining tables</CardTitle>
        <CardDescription>
          Managed separately from the menu catalog. Tables appear in POS when &quot;Tables&quot;
          mode is selected. Names must be unique per restaurant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add table
          </Button>
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> <span>Refreshing...</span></> : <><RefreshCcw className="mr-2 h-4 w-4" /> <span>Refresh</span></>}
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground"><Loader2 className="animate-spin text-primary text-center mx-auto" /></p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tables yet. Add one so staff can select it on the POS screen.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-28 text-right">Sort</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.sortOrder}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Edit ${row.name}`}
                          onClick={() => openEdit(row)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          aria-label={`Delete ${row.name}`}
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit table' : 'Add table'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="table-name">Name</Label>
                <Input
                  id="table-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. T1, Window 4, Patio A"
                  maxLength={120}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="table-sort">Sort order</Label>
                <Input
                  id="table-sort"
                  type="number"
                  min={0}
                  max={9999}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Lower numbers appear first in POS.</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={saving} onClick={() => void handleSave()}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> <span>Creating...</span></> : <><Plus className="h-4 w-4 mr-2" /> <span>Create Table</span></>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete table?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget
                  ? `Remove “${deleteTarget.name}” from the list. Past orders keep the table name on record.`
                  : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                onClick={(e) => {
                  e.preventDefault();
                  void handleDelete();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
