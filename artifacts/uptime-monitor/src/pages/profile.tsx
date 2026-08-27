import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Lock, Mail, Crown, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [notificationEmail, setNotificationEmail] = useState(user?.notificationEmail ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch(`${BASE}/api/me/profile`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, notificationEmail }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save profile");
      queryClient.setQueryData(["auth-me"], body);
      toast({ title: "Profile updated", description: "Your details have been saved." });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "New password and confirmation must match.", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch(`${BASE}/api/me/password`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to change password");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 3000);
      toast({ title: "Password changed", description: "Your new password is active." });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>Profile — GuardiX</title>
      </Helmet>

      <div className="max-w-2xl space-y-8">
        <div>
          <h1 className="font-display text-2xl tracking-wide text-foreground">
            My <span className="text-primary">Profile</span>
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Manage your account details and password.
          </p>
        </div>

        {/* Account info badge */}
        <div className="flex items-center gap-4 bg-card border border-border rounded-lg p-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
            {user?.isAdmin
              ? <ShieldCheck className="w-6 h-6 text-primary" />
              : <User className="w-6 h-6 text-primary" />}
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg tracking-wide text-foreground truncate">{user?.name}</div>
            <div className="font-mono text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>
          <div className="ml-auto shrink-0">
            {user?.plan === "pro" ? (
              <span className="flex items-center gap-1.5 font-mono text-xs text-primary bg-primary/10 border border-primary/30 rounded-full px-3 py-1">
                <Crown className="w-3 h-3" /> Pro
              </span>
            ) : (
              <span className="font-mono text-xs text-muted-foreground bg-muted/40 border border-border rounded-full px-3 py-1">
                Free
              </span>
            )}
          </div>
        </div>

        {/* Profile details */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-5">
          <div className="flex items-center gap-3 pb-2 border-b border-border">
            <User className="w-4 h-4 text-primary" />
            <span className="font-mono text-sm font-semibold text-foreground">Account Details</span>
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
              Display Name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
              Login Email
            </Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
              Alert Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                placeholder="alerts@example.com"
                type="email"
                className="font-mono text-sm pl-8"
              />
            </div>
            <p className="font-mono text-[11px] text-muted-foreground">
              Down and recovery emails are sent here. Defaults to your login email if left empty.
            </p>
          </div>

          <Button onClick={handleSaveProfile} disabled={savingProfile} className="font-mono text-sm w-full sm:w-auto">
            {savingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save profile
          </Button>
        </div>

        {/* Change password */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-5">
          <div className="flex items-center gap-3 pb-2 border-b border-border">
            <Lock className="w-4 h-4 text-primary" />
            <span className="font-mono text-sm font-semibold text-foreground">Change Password</span>
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
              Current Password
            </Label>
            <Input
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
              New Password
            </Label>
            <Input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              placeholder="Min 8 characters"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
              Confirm New Password
            </Label>
            <Input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              className={`font-mono text-sm ${confirmPassword && newPassword !== confirmPassword ? "border-destructive" : ""}`}
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="font-mono text-[11px] text-destructive">Passwords do not match</p>
            )}
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
            variant={passwordSaved ? "secondary" : "default"}
            className="font-mono text-sm w-full sm:w-auto"
          >
            {savingPassword ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : passwordSaved ? (
              <CheckCircle2 className="w-4 h-4 mr-2 text-primary" />
            ) : null}
            {passwordSaved ? "Password changed!" : "Change password"}
          </Button>
        </div>

        {/* Danger zone — account info */}
        <div className="bg-muted/20 border border-border rounded p-4 font-mono text-[11px] text-muted-foreground">
          Account created on{" "}
          <span className="text-foreground">GuardiX</span>.{" "}
          {user?.isAdmin && (
            <span className="text-primary">You are the platform admin.</span>
          )}{" "}
          To delete your account, contact the admin.
        </div>
      </div>
    </Layout>
  );
}
