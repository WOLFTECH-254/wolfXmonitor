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

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#5865F2]" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

interface ChannelSettings {
  telegramChatId: string | null;
  whatsappPhone: string | null;
  discordWebhookUrl: string | null;
}

async function fetchChannels(): Promise<ChannelSettings> {
  const res = await fetch(`${BASE}/api/me/channels`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch channel settings");
  return res.json();
}

async function saveChannels(data: { telegramChatId?: string; whatsappPhone?: string; discordWebhookUrl?: string }): Promise<void> {
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

async function testChannel(channel: "telegram" | "whatsapp" | "discord"): Promise<void> {
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
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<"telegram" | "whatsapp" | "discord" | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchChannels()
      .then((d) => {
        setTelegramChatId(d.telegramChatId ?? "");
        setWhatsappPhone(d.whatsappPhone ?? "");
        setDiscordWebhookUrl(d.discordWebhookUrl ?? "");
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
        discordWebhookUrl: discordWebhookUrl.trim() || undefined,
      });
      toast({ title: "Saved", description: "Notification channels updated." });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (channel: "telegram" | "whatsapp" | "discord") => {
    setTesting(channel);
    try {
      await testChannel(channel);
      const label = channel === "telegram" ? "Telegram" : channel === "whatsapp" ? "WhatsApp" : "Discord";
      toast({ title: "Test sent", description: `Check your ${label} for the test message.` });
    } catch (err) {
      toast({ title: "Test failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>Integrations & API — GuardiX</title>
      </Helmet>

      <div className="max-w-5xl space-y-8">
        <div>
          <h1 className="font-display text-2xl tracking-wide text-foreground">
            Integrations <span className="text-primary">&amp; API</span>
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Connect Telegram, WhatsApp, or Discord to receive site incident alerts on your platforms.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-xs">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  Then message the GuardiX bot to activate alerts.
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

            {/* Discord */}
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/30 flex items-center justify-center">
                  <DiscordIcon />
                </div>
                <div>
                  <div className="font-mono text-sm font-semibold text-foreground">Discord</div>
                  <div className="font-mono text-[10px] text-muted-foreground">Rich embeds via Discord webhook</div>
                </div>
                {discordWebhookUrl && (
                  <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                )}
              </div>

              <div className="space-y-2">
                <Label className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                  Discord Webhook URL
                </Label>
                <Input
                  value={discordWebhookUrl}
                  onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="font-mono text-sm"
                  type="url"
                />
              </div>

              <div className="bg-muted/30 border border-border rounded p-3 flex gap-2">
                <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                  In Discord: open your channel settings →{" "}
                  <span className="text-foreground">Integrations → Webhooks → New Webhook</span> → copy the URL and paste it above.
                  Alerts arrive as rich embeds with color-coded status.
                </div>
              </div>

              {discordWebhookUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs"
                  onClick={() => handleTest("discord")}
                  disabled={testing === "discord"}
                >
                  {testing === "discord" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                  ) : (
                    <DiscordIcon />
                  )}
                  <span className="ml-2">Send test message</span>
                </Button>
              )}
            </div>
            </div>{/* end grid */}

            {/* Account email note */}
            <div className="bg-muted/20 border border-border rounded p-4 font-mono text-[11px] text-muted-foreground">
              Email alerts are sent to{" "}
              <span className="text-foreground">{user?.notificationEmail ?? user?.email}</span>.
              Telegram, WhatsApp, and Discord alerts fire alongside email whenever a monitor goes down or recovers.
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
