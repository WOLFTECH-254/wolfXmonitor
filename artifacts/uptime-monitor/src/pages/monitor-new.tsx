import { Layout } from "@/components/layout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateMonitor, getListMonitorsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, ArrowRight, Crown } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL (e.g., https://example.com)"),
  intervalMinutes: z.coerce.number().min(1).max(1440),
});

export default function MonitorNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMonitor = useCreateMonitor();
  const [limitReached, setLimitReached] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      url: "https://",
      intervalMinutes: 15,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setLimitReached(false);
    createMonitor.mutate({ data: { ...values, active: true } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMonitorsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Monitor created", description: "Endpoint added to watch list." });
        setLocation("/dashboard");
      },
      onError: (err: unknown) => {
        const body = (err as { response?: { data?: { limitReached?: boolean; error?: string } } }).response?.data;
        if (body?.limitReached) {
          setLimitReached(true);
        } else {
          const msg = err instanceof Error ? err.message : "An error occurred.";
          toast({ variant: "destructive", title: "Error creating monitor", description: msg });
        }
      }
    });
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="pb-6 border-b border-border">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/dashboard">
              <button className="w-8 h-8 rounded border border-border bg-card hover:border-primary/50 flex items-center justify-center transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <p className="font-mono text-xs text-primary uppercase tracking-widest">New Monitor</p>
          </div>
          <h1 className="font-display text-5xl uppercase tracking-wide text-foreground leading-none">
            Add Endpoint
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-3">
            Configure a new service to monitor and keep alive.
          </p>
        </div>

        {/* Limit reached banner */}
        {limitReached && (
          <div className="border border-primary/40 bg-primary/5 rounded p-5 flex items-center justify-between gap-4">
            <div>
              <div className="font-display text-xl text-primary uppercase tracking-wide leading-none mb-1">Free Plan Limit Reached</div>
              <p className="font-mono text-xs text-muted-foreground">You've hit the maximum monitors on the Free plan. Upgrade to Pro for unlimited monitors.</p>
            </div>
            <Link href="/upgrade">
              <button className="flex items-center gap-2 font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-all px-4 py-2.5 rounded font-bold tracking-wider whitespace-nowrap">
                <Crown className="w-3.5 h-3.5" /> Upgrade to Pro
              </button>
            </Link>
          </div>
        )}

        {/* Form card */}
        <div className="border border-border bg-card rounded p-8 card-hover">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Endpoint Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Main API Server"
                        className="bg-background border-border font-mono focus:border-primary/50 transition-colors"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="font-mono text-xs text-muted-foreground">A recognizable name for this service.</FormDescription>
                    <FormMessage className="font-mono text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-widest text-muted-foreground">URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://my-app.onrender.com"
                        className="bg-background border-border font-mono focus:border-primary/50 transition-colors"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="font-mono text-xs text-muted-foreground">The full HTTP/HTTPS URL to ping.</FormDescription>
                    <FormMessage className="font-mono text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="intervalMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Ping Interval</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value.toString()}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-border font-mono">
                          <SelectValue placeholder="Select interval" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-card border-border font-mono">
                        <SelectItem value="1">Every 1 minute</SelectItem>
                        <SelectItem value="5">Every 5 minutes</SelectItem>
                        <SelectItem value="10">Every 10 minutes</SelectItem>
                        <SelectItem value="14">Every 14 minutes (Render safe)</SelectItem>
                        <SelectItem value="15">Every 15 minutes</SelectItem>
                        <SelectItem value="30">Every 30 minutes</SelectItem>
                        <SelectItem value="60">Every 60 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription className="font-mono text-xs text-muted-foreground">
                      Use 14 minutes or less for Render — it sleeps after 15 min of inactivity.
                    </FormDescription>
                    <FormMessage className="font-mono text-xs" />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Link href="/dashboard">
                  <Button variant="ghost" type="button" className="font-mono text-sm">
                    Cancel
                  </Button>
                </Link>
                <button
                  type="submit"
                  disabled={createMonitor.isPending}
                  className="flex items-center gap-2 font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all px-6 py-2.5 rounded font-bold tracking-wider group"
                >
                  {createMonitor.isPending ? "Saving..." : "Save Endpoint"}
                  {!createMonitor.isPending && <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
                </button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </Layout>
  );
}
