import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, MessageCircle, Loader2, CheckCircle2, Info } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ChannelSettings {
  telegramChatId: string | null;
  whatsappPhone: string | null;
}

async function fetchChannels(): Promise<ChannelSettings> {
  const res = await fetch(`${BASE}/api/me/channels`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch channel settings");
  return res.json();
}

async function saveChannels(data: { telegramChatId?: string; whatsappPhone?: string }): Promise<void> {
  const res = await fetch(`${BASE}/api/me/channels`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Failed to save");
  }
}

async function testChannel(channel: "telegram" | "whatsapp"): Promise<void> {
  const res = await fetch(`${BASE}/api/me/channels/test`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ channel }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Test failed");
  }
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [telegramChatId, setTelegramChatId] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<"telegram" | "whatsapp" | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchChannels()
      .then((d) => {
        setTelegramChatId(d.telegramChatId ?? "");
        setWhatsappPhone(d.whatsappPhone ?? "");
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveChannels({
        telegramChatId: telegramChatId.trim() || undefined,
        whatsappPhone: whatsappPhone.trim() || undefined,
      });
      toast({ title: "Saved", description: "Notification channels updated." });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (channel: "telegram" | "whatsapp") => {
    setTesting(channel);
    try {
      await testChannel(channel);
      toast({ title: "Test sent", description: `Check your ${channel === "telegram" ? "Telegram" : "WhatsApp"} for the test message.` });
    } catch (err) {
      toast({ title: "Test failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>Integrations & API — wolfXmonitor</title>
      </Helmet>

      <div className="max-w-2xl space-y-8">
        <div>
          <h1 className="font-display text-2xl tracking-wide text-foreground">
            Integrations <span className="text-primary">&amp; API</span>
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Connect Telegram or WhatsApp to receive site incident alerts on your chat platforms.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-xs">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Telegram */}
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#2AABEE]/10 border border-[#2AABEE]/30 flex items-center justify-center">
                  <Send className="w-4 h-4 text-[#2AABEE]" />
                </div>
                <div>
                  <div className="font-mono text-sm font-semibold text-foreground">Telegram</div>
                  <div className="font-mono text-[10px] text-muted-foreground">Instant alerts via Telegram bot</div>
                </div>
                {telegramChatId && (
                  <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                )}
              </div>

              <div className="space-y-2">
                <Label className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                  Your Telegram Chat ID
                </Label>
                <Input
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="e.g. 123456789"
                  className="font-mono text-sm"
                />
              </div>

              <div className="bg-muted/30 border border-border rounded p-3 flex gap-2">
                <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                  To get your Chat ID: open Telegram, search for{" "}
                  <span className="text-foreground font-semibold">@userinfobot</span> and send it{" "}
                  <span className="text-foreground">/start</span>. It will reply with your numeric ID.
                  Then message the wolfXmonitor bot to activate alerts.
                </div>
              </div>

              {telegramChatId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs"
                  onClick={() => handleTest("telegram")}
                  disabled={testing === "telegram"}
                >
                  {testing === "telegram" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                  ) : (
                    <Send className="w-3.5 h-3.5 mr-2" />
                  )}
                  Send test message
                </Button>
              )}
            </div>

            {/* WhatsApp */}
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#25D366]/10 border border-[#25D366]/30 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-[#25D366]" />
                </div>
                <div>
                  <div className="font-mono text-sm font-semibold text-foreground">WhatsApp</div>
                  <div className="font-mono text-[10px] text-muted-foreground">Alerts via WhatsApp (Twilio)</div>
                </div>
                {whatsappPhone && (
                  <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                )}
              </div>

              <div className="space-y-2">
                <Label className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                  Your WhatsApp Phone Number
                </Label>
                <Input
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  placeholder="e.g. +254712345678"
                  className="font-mono text-sm"
                />
              </div>

              <div className="bg-muted/30 border border-border rounded p-3 flex gap-2">
                <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                  Enter your number in international format including the{" "}
                  <span className="text-foreground">+ country code</span> (e.g. +254 for Kenya).
                  WhatsApp alerts are sent via Twilio — admin must configure Twilio credentials.
                </div>
              </div>

              {whatsappPhone && (
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs"
                  onClick={() => handleTest("whatsapp")}
                  disabled={testing === "whatsapp"}
                >
                  {testing === "whatsapp" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                  ) : (
                    <MessageCircle className="w-3.5 h-3.5 mr-2" />
                  )}
                  Send test message
                </Button>
              )}
            </div>

            {/* Account email note */}
            <div className="bg-muted/20 border border-border rounded p-4 font-mono text-[11px] text-muted-foreground">
              Email alerts are sent to{" "}
              <span className="text-foreground">{user?.notificationEmail ?? user?.email}</span>.
              Telegram and WhatsApp alerts fire alongside email whenever a monitor goes down or recovers.
            </div>

            <Button onClick={handleSave} disabled={saving} className="font-mono text-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save channels
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
