import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateMonitor,
  getListMonitorsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Crown, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { allowedIntervals, monitorsLabel } from "@/lib/plan-format";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL (e.g. https://example.com)"),
  checkIntervalSeconds: z.coerce.number().min(10).max(86_400),
  sslCheckEnabled: z.boolean().default(false),
});
type FormValues = z.infer<typeof formSchema>;

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
  const { user } = useAuth();
  const createMonitor = useCreateMonitor();
  const [limitMsg, setLimitMsg] = useState<string | null>(null);

  const limits = user?.planLimits;
  const minInterval = limits?.checkIntervalSeconds ?? 300;
  const sslAvailable = !!limits?.sslMonitoring;
  const intervalOptions = useMemo(() => allowedIntervals(minInterval), [minInterval]);
  const defaultInterval = intervalOptions[0]?.value ?? 300;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", url: "https://", checkIntervalSeconds: defaultInterval, sslCheckEnabled: false },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: "", url: "https://", checkIntervalSeconds: defaultInterval, sslCheckEnabled: false });
      setLimitMsg(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function onSubmit(values: FormValues) {
    setLimitMsg(null);
    createMonitor.mutate(
      // extra fields (checkIntervalSeconds, sslCheckEnabled) are read by the API directly
      { data: { name: values.name, url: values.url, active: true, checkIntervalSeconds: values.checkIntervalSeconds, sslCheckEnabled: values.sslCheckEnabled } as never },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMonitorsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["auth-me"] });
          toast({ title: "Monitor created", description: `Now watching ${values.name}.` });
          onOpenChange(false);
          onCreated?.();
        },
        onError: (err: unknown) => {
          const body = (err as { data?: { limitReached?: boolean; upgrade?: boolean; error?: string } }).data ?? undefined;
          if (body?.limitReached || body?.upgrade) {
            setLimitMsg(body.error ?? "You've hit a plan limit.");
          } else {
            const msg = body?.error ?? (err instanceof Error ? err.message : "An error occurred.");
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
          <DialogTitle className="font-display text-2xl tracking-wide text-foreground">Add monitor</DialogTitle>
          <DialogDescription className="font-mono text-xs text-muted-foreground">
            {limits ? `Your plan allows ${monitorsLabel(limits.monitorLimit).toLowerCase()}.` : "Configure an endpoint to watch."}
          </DialogDescription>
        </DialogHeader>

        {limitMsg && (
          <div className="border border-primary/40 bg-primary/5 rounded-md p-4 flex items-center justify-between gap-4">
            <p className="font-mono text-[11px] text-foreground leading-relaxed">{limitMsg}</p>
            <Link href="/upgrade">
              <button className="flex items-center gap-1.5 font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-3 py-2 rounded-md font-bold whitespace-nowrap">
                <Crown className="w-3.5 h-3.5" /> Upgrade
              </button>
            </Link>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Name</FormLabel>
                <FormControl>
                  <Input autoFocus placeholder="Main API server" className="bg-background border-border font-mono focus:border-primary/50 transition-colors" {...field} />
                </FormControl>
                <FormMessage className="font-mono text-xs" />
              </FormItem>
            )} />

            <FormField control={form.control} name="url" render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://my-app.onrender.com" className="bg-background border-border font-mono focus:border-primary/50 transition-colors" {...field} />
                </FormControl>
                <FormMessage className="font-mono text-xs" />
              </FormItem>
            )} />

            <FormField control={form.control} name="checkIntervalSeconds" render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Check interval</FormLabel>
                <Select onValueChange={(v) => field.onChange(Number(v))} defaultValue={String(field.value)}>
                  <FormControl>
                    <SelectTrigger className="bg-background border-border font-mono">
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-card border-border font-mono">
                    {intervalOptions.map((i) => (
                      <SelectItem key={i.value} value={String(i.value)}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription className="font-mono text-[11px] text-muted-foreground">
                  Fastest on your plan: {intervalOptions[0]?.label.toLowerCase()}.{" "}
                  <Link href="/upgrade" className="text-primary hover:underline">Upgrade</Link> for quicker checks.
                </FormDescription>
                <FormMessage className="font-mono text-xs" />
              </FormItem>
            )} />

            {sslAvailable && (
              <FormField control={form.control} name="sslCheckEnabled" render={({ field }) => (
                <FormItem>
                  <button
                    type="button"
                    onClick={() => field.onChange(!field.value)}
                    className="w-full flex items-center gap-3 border border-border rounded-md p-3 hover:border-primary/40 transition-colors"
                  >
                    <ShieldCheck className={`w-4 h-4 shrink-0 ${field.value ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="flex-1 text-left">
                      <span className="font-mono text-xs text-foreground block">Monitor SSL certificate</span>
                      <span className="font-mono text-[10px] text-muted-foreground">Alert before the TLS cert expires (https only)</span>
                    </span>
                    <span className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${field.value ? "bg-primary" : "bg-muted"}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${field.value ? "translate-x-4" : "translate-x-0.5"}`} />
                    </span>
                  </button>
                </FormItem>
              )} />
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button type="button" onClick={() => onOpenChange(false)}
                className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-md">
                Cancel
              </button>
              <button type="submit" disabled={createMonitor.isPending}
                className="flex items-center gap-2 font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-5 py-2 rounded-md font-bold tracking-wide group">
                {createMonitor.isPending ? "Saving…" : "Add monitor"}
                {!createMonitor.isPending && <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
              </button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
