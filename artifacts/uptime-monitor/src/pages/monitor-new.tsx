import { Layout } from "@/components/layout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateMonitor, getListMonitorsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { TerminalSquare, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      url: "https://",
      intervalMinutes: 15,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createMonitor.mutate({ data: { ...values, active: true } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMonitorsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({
          title: "Monitor created",
          description: "Endpoint added to watch list.",
        });
        setLocation("/");
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Error creating monitor",
          description: err.message || "An error occurred.",
        });
      }
    });
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4 border-b border-border pb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-mono tracking-tight text-foreground flex items-center gap-2">
              <TerminalSquare className="w-5 h-5 text-primary" />
              ADD_ENDPOINT
            </h1>
            <p className="text-muted-foreground font-mono text-sm mt-1">Configure a new service to monitor.</p>
          </div>
        </div>

        <Card className="p-6 bg-card border-border">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 font-mono">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endpoint Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Main API Server" className="bg-background" {...field} />
                    </FormControl>
                    <FormDescription>A recognizable name for this service.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." className="bg-background" {...field} />
                    </FormControl>
                    <FormDescription>The full HTTP/HTTPS URL to ping.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="intervalMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ping Interval</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value.toString()}>
                      <FormControl>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select interval" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">Every 1 minute</SelectItem>
                        <SelectItem value="5">Every 5 minutes</SelectItem>
                        <SelectItem value="10">Every 10 minutes</SelectItem>
                        <SelectItem value="15">Every 15 minutes</SelectItem>
                        <SelectItem value="30">Every 30 minutes</SelectItem>
                        <SelectItem value="60">Every 60 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>How often should we check this endpoint.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4 pt-4 border-t border-border">
                <Link href="/">
                  <Button variant="ghost" type="button">Cancel</Button>
                </Link>
                <Button type="submit" disabled={createMonitor.isPending} className="min-w-[120px]">
                  {createMonitor.isPending ? "SAVING..." : "SAVE_ENDPOINT"}
                </Button>
              </div>
            </form>
          </Form>
        </Card>
      </div>
    </Layout>
  );
}
