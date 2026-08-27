import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateMonitor,
  getListMonitorsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL (e.g. https://example.com)"),
  intervalMinutes: z.coerce.number().min(1).max(1440),
});

type FormValues = z.infer<typeof formSchema>;

const INTERVALS = [
  { value: "1", label: "Every 1 minute" },
  { value: "5", label: "Every 5 minutes" },
  { value: "10", label: "Every 10 minutes" },
  { value: "14", label: "Every 14 minutes (Render safe)" },
  { value: "15", label: "Every 15 minutes" },
  { value: "30", label: "Every 30 minutes" },
  { value: "60", label: "Every 60 minutes" },
];

export function MonitorFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMonitor = useCreateMonitor();
  const [limitReached, setLimitReached] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", url: "https://", intervalMinutes: 15 },
  });

  // Reset the form each time the dialog is opened.
  useEffect(() => {
    if (open) {
      form.reset({ name: "", url: "https://", intervalMinutes: 15 });
      setLimitReached(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function onSubmit(values: FormValues) {
    setLimitReached(false);
    createMonitor.mutate(
      { data: { ...values, active: true } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMonitorsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({ title: "Monitor created", description: `Now watching ${values.name}.` });
          onOpenChange(false);
          onCreated?.();
        },
        onError: (err: unknown) => {
          const body = (err as { response?: { data?: { limitReached?: boolean } } }).response?.data;
          if (body?.limitReached) {
            setLimitReached(true);
          } else {
            const msg = err instanceof Error ? err.message : "An error occurred.";
            toast({ variant: "destructive", title: "Could not create monitor", description: msg });
          }
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide text-foreground">
            Add monitor
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-muted-foreground">
            Configure an endpoint to watch. GuardiX pings it immediately, then on your interval.
          </DialogDescription>
        </DialogHeader>

        {limitReached && (
          <div className="border border-primary/40 bg-primary/5 rounded-md p-4 flex items-center justify-between gap-4">
            <div>
              <div className="font-mono text-sm text-primary font-bold mb-0.5">Free plan limit reached</div>
              <p className="font-mono text-[11px] text-muted-foreground">
                Upgrade to Pro for unlimited monitors.
              </p>
            </div>
            <Link href="/upgrade">
              <button className="flex items-center gap-1.5 font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-3 py-2 rounded-md font-bold whitespace-nowrap">
                <Crown className="w-3.5 h-3.5" /> Upgrade
              </button>
            </Link>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Name
                  </FormLabel>
                  <FormControl>
                    <Input
                      autoFocus
                      placeholder="Main API server"
                      className="bg-background border-border font-mono focus:border-primary/50 transition-colors"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="font-mono text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    URL
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://my-app.onrender.com"
                      className="bg-background border-border font-mono focus:border-primary/50 transition-colors"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="font-mono text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="intervalMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Ping interval
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value.toString()}>
                    <FormControl>
                      <SelectTrigger className="bg-background border-border font-mono">
                        <SelectValue placeholder="Select interval" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-card border-border font-mono">
                      {INTERVALS.map((i) => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="font-mono text-[11px] text-muted-foreground">
                    Use 14 minutes or less for Render — it sleeps after 15 min idle.
                  </FormDescription>
                  <FormMessage className="font-mono text-xs" />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMonitor.isPending}
                className="flex items-center gap-2 font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-5 py-2 rounded-md font-bold tracking-wide group"
              >
                {createMonitor.isPending ? "Saving…" : "Add monitor"}
                {!createMonitor.isPending && (
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                )}
              </button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
