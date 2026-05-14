"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, UserPlus, Copy, Check, Edit2, Trash2, X, Users, Coins, Palette, SlidersHorizontal, PlugZap, Bot, RefreshCcw, Bell, Mail, MailCheck, Link } from "lucide-react";
import { CostManagement } from "./cost-management";
import { BrandingTab } from "@/features/admin/components/branding-tab";
import { OptimizationRulesTab } from "@/features/admin/components/optimization-rules-tab";
import { IntegrationsManagement } from "./integrations-management";
import { AgentSettingsTab } from "@/features/admin/components/agent-settings-tab";
import { SyncManagement } from "./sync-management";
import { AlertRulesTab } from "@/features/admin/components/alert-rules-tab";
import { useI18n } from "@/i18n/use-i18n";

interface User {
  id: string;
  Name: string;
  Email: string;
  Role: string;
  Password_Changed?: boolean;
  Is_Active?: boolean;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t, locale } = useI18n();
  const tr = (de: string, en: string) => (locale === "de" ? de : en);
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [inviteData, setInviteData] = useState({ name: "", email: "", role: "Editor" });
  const [inviteResult, setInviteResult] = useState<{ inviteLink: string; tempPassword: string; emailSent?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [inviteMode, setInviteMode] = useState<"email" | "copy" | null>(null);

  // Editing state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ name: string; role: string }>({ name: "", role: "" });
  const [updating, setUpdating] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [resendingUserId, setResendingUserId] = useState<string | null>(null);
  const [resendResult, setResendResult] = useState<{ userId: string; inviteLink: string; emailSent: boolean } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (session?.user?.role !== "Admin" && status === "authenticated") {
      router.push("/");
    } else if (status === "authenticated") {
      fetchUsers();
      fetch("/api/admin/smtp-status")
        .then((r) => r.json())
        .then((d) => setSmtpConfigured(d.configured === true))
        .catch(() => setSmtpConfigured(false));
    }
  }, [status, session, router]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error(t("admin.errorLoadingUsers"));
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (mode: "email" | "copy") => {
    setInviting(true);
    setInviteMode(mode);
    setError(null);
    setInviteResult(null);
    setLinkCopied(false);

    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("admin.errorInvitingUser"));

      if (mode === "copy") {
        navigator.clipboard.writeText(data.inviteLink);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2500);
      } else {
        setInviteResult(data);
      }

      setInviteData({ name: "", email: "", role: "Editor" });
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInviting(false);
      setInviteMode(null);
    }
  };

  const handleUpdateUser = async (id: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Name: editData.name, Role: editData.role }),
      });

      if (!res.ok) throw new Error(t("admin.errorUpdatingUser"));
      
      setEditingUserId(null);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm(t("admin.confirmDeleteUser"))) return;
    
    setDeletingUserId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error(t("admin.errorDeletingUser"));
      
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleResendInvite = async (id: string) => {
    setResendingUserId(id);
    setResendResult(null);
    try {
      const res = await fetch(`/api/admin/users/${id}/resend-invite`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr("Fehler beim Senden.", "Error sending invite."));
      setResendResult({ userId: id, inviteLink: data.inviteLink, emailSent: data.emailSent });
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResendingUserId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === "loading" || (status === "authenticated" && session?.user?.role !== "Admin")) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-primary">{t("admin.title")}</h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>{tr("Fehler", "Error")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t("admin.users")}
          </TabsTrigger>
          <TabsTrigger value="costs" className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            {t("admin.costs")}
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            {t("admin.branding")}
          </TabsTrigger>
          <TabsTrigger value="optimization-rules" className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            {t("admin.optimizationRules")}
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <PlugZap className="h-4 w-4" />
            {t("admin.integrations")}
          </TabsTrigger>
          <TabsTrigger value="agent" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            {tr("Agent", "Agent")}
          </TabsTrigger>
          <TabsTrigger value="sync" className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              {tr("Sync", "Sync")}
            </TabsTrigger>
            <TabsTrigger value="alert-rules" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              {tr("Alert-Regeln", "Alert Rules")}
            </TabsTrigger>
          </TabsList>

        <TabsContent value="users" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Invite User Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  {t("admin.inviteUser")}
                </CardTitle>
                <CardDescription>
                  {t("admin.inviteDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("admin.fullName")}</label>
                    <Input 
                      placeholder="Max Mustermann" 
                      value={inviteData.name}
                      onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("admin.email")}</label>
                    <Input 
                      type="email" 
                      placeholder="max@example.com" 
                      value={inviteData.email}
                      onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("admin.role")}</label>
                    <Select 
                      value={inviteData.role} 
                      onValueChange={(v) => setInviteData({ ...inviteData, role: v || "Editor" })}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder={t("admin.chooseRole")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Editor">Editor</SelectItem>
                        <SelectItem value="Viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-1">
                    {/* E-Mail senden */}
                    <Button
                      type="button"
                      className="flex-1 h-10 bg-primary hover:bg-primary/90 text-primary-foreground"
                      disabled={inviting || !smtpConfigured || !inviteData.name || !inviteData.email}
                      onClick={() => handleInvite("email")}
                      title={!smtpConfigured ? tr("SMTP nicht konfiguriert", "SMTP not configured") : undefined}
                    >
                      {inviting && inviteMode === "email" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="mr-2 h-4 w-4" />
                      )}
                      {tr("Per E-Mail einladen", "Send invite email")}
                    </Button>

                    {/* Invite-Link kopieren */}
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-10"
                      disabled={inviting || !inviteData.name || !inviteData.email}
                      onClick={() => handleInvite("copy")}
                    >
                      {inviting && inviteMode === "copy" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : linkCopied ? (
                        <Check className="mr-2 h-4 w-4 text-green-500" />
                      ) : (
                        <Link className="mr-2 h-4 w-4" />
                      )}
                      {linkCopied
                        ? tr("Invite-Link kopiert!", "Invite link copied!")
                        : tr("Invite-Link kopieren", "Copy invite link")}
                    </Button>
                  </div>

                  {!smtpConfigured && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      {tr(
                        "E-Mail-Versand nicht verfügbar – SMTP ist nicht konfiguriert.",
                        "Email sending unavailable – SMTP is not configured."
                      )}
                    </p>
                  )}
                </div>

                {inviteResult && (
                  <div className="mt-6 space-y-4 rounded-lg border bg-muted p-4">
                    {/* E-Mail-Status Badge */}
                    <div className="flex items-center gap-2">
                      {inviteResult.emailSent ? (
                        <>
                          <MailCheck className="h-4 w-4 text-green-600 shrink-0" />
                          <span className="text-sm font-medium text-green-700 dark:text-green-400">
                            {tr("Einladungsmail wurde gesendet.", "Invitation email sent.")}
                          </span>
                        </>
                      ) : (
                        <>
                          <Mail className="h-4 w-4 text-amber-600 shrink-0" />
                          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                            {tr(
                              "SMTP nicht konfiguriert – Link bitte manuell teilen.",
                              "SMTP not configured – please share link manually."
                            )}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{tr("Temporäres Passwort:", "Temporary password:")}</p>
                      <code className="block rounded bg-background p-2 text-xs font-mono">
                        {inviteResult.tempPassword}
                      </code>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{tr("Einladungslink:", "Invitation link:")}</p>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={inviteResult.inviteLink}
                          className="text-xs font-mono"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => copyToClipboard(inviteResult.inviteLink)}
                        >
                          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {inviteResult.emailSent
                        ? tr(
                            "Die Zugangsdaten wurden direkt an die E-Mail-Adresse des Benutzers gesendet. Der Link ist als Fallback hinterlegt.",
                            "Credentials were sent directly to the user's email address. The link is available as a fallback."
                          )
                        : tr(
                            "Teile diesen Link und das Passwort mit dem Benutzer. Er sollte sein Passwort nach dem ersten Login ändern.",
                            "Share this link and password with the user. They should change their password after first login."
                          )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* User List */}
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.userList")}</CardTitle>
                <CardDescription>
                  {t("admin.userListDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                           <TableHead>{tr("Name", "Name")}</TableHead>
                           <TableHead>{tr("E-Mail", "Email")}</TableHead>
                           <TableHead>{t("admin.role")}</TableHead>
                           <TableHead>{tr("Status", "Status")}</TableHead>
                           <TableHead className="text-right">{tr("Aktionen", "Actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {editingUserId === user.id ? (
                                <Input 
                                  value={editData.name} 
                                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                  className="h-8"
                                />
                              ) : (
                                user.Name
                              )}
                            </TableCell>
                            <TableCell>{user.Email}</TableCell>
                             <TableCell>
                               {editingUserId === user.id ? (
                                 <Select 
                                     value={editData.role} 
                                     onValueChange={(v) => setEditData({ ...editData, role: v || "Editor" })}
                                   >
                                     <SelectTrigger className="h-8">
                                       <SelectValue />
                                     </SelectTrigger>
                                     <SelectContent>
                                       <SelectItem value="Admin">Admin</SelectItem>
                                       <SelectItem value="Editor">Editor</SelectItem>
                                       <SelectItem value="Viewer">Viewer</SelectItem>
                                     </SelectContent>
                                   </Select>
                               ) : (
                                 <Badge variant={user.Role === "Admin" ? "default" : "secondary"}>
                                   {user.Role}
                                 </Badge>
                               )}
                             </TableCell>
                             <TableCell>
                               {user.Password_Changed === false ? (
                                 <Badge variant="outline" className="border-yellow-400 text-yellow-700 bg-yellow-50 whitespace-nowrap">
                                   {tr("Einladung ausstehend", "Invite pending")}
                                 </Badge>
                               ) : (
                                 <Badge variant="outline" className="border-green-400 text-green-700 bg-green-50">
                                   {tr("Aktiv", "Active")}
                                 </Badge>
                               )}
                             </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {editingUserId === user.id ? (
                                  <>
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      onClick={() => handleUpdateUser(user.id)}
                                      disabled={updating}
                                    >
                                      {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                                    </Button>
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      onClick={() => setEditingUserId(null)}
                                    >
                                      <X className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </>
                                ) : (
                                   <>
                                     <Button 
                                       size="icon" 
                                       variant="ghost" 
                                       onClick={() => {
                                         setEditingUserId(user.id);
                                         setEditData({ name: user.Name, role: user.Role });
                                       }}
                                     >
                                       <Edit2 className="h-4 w-4" />
                                     </Button>
                                     {user.Password_Changed === false && (
                                       <Button
                                         size="icon"
                                         variant="ghost"
                                         title={tr("Einladung erneut senden", "Resend invite")}
                                         onClick={() => handleResendInvite(user.id)}
                                         disabled={resendingUserId === user.id}
                                       >
                                         {resendingUserId === user.id
                                           ? <Loader2 className="h-4 w-4 animate-spin" />
                                           : <Mail className="h-4 w-4 text-blue-500" />}
                                       </Button>
                                     )}
                                     <Button 
                                       size="icon" 
                                       variant="ghost" 
                                       onClick={() => handleDeleteUser(user.id)}
                                       disabled={deletingUserId === user.id}
                                     >
                                       {deletingUserId === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
                                     </Button>
                                   </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                         {users.length === 0 && (
                           <TableRow>
                             <TableCell colSpan={5} className="text-center text-muted-foreground">
                               {tr("Keine Benutzer gefunden.", "No users found.")}
                             </TableCell>
                           </TableRow>
                         )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resend invite result */}
            {resendResult && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-blue-800">
                      {resendResult.emailSent
                        ? tr("Einladungsmail wurde erneut gesendet.", "Invitation email resent.")
                        : tr("Neues temporäres Passwort generiert (E-Mail konnte nicht gesendet werden).", "New temporary password generated (email could not be sent).")}
                    </p>
                    <Button size="icon" variant="ghost" onClick={() => setResendResult(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-blue-700">{tr("Einladungslink:", "Invite link:")}</p>
                    <div className="flex items-center gap-2">
                      <Input value={resendResult.inviteLink} readOnly className="h-8 text-xs bg-white" />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(resendResult.inviteLink);
                          setLinkCopied(true);
                          setTimeout(() => setLinkCopied(false), 2000);
                        }}
                      >
                        {linkCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="costs">
          <CostManagement />
        </TabsContent>
        <TabsContent value="branding">
          <BrandingTab />
        </TabsContent>
        <TabsContent value="optimization-rules">
          <OptimizationRulesTab />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsManagement />
        </TabsContent>
        <TabsContent value="agent">
          <AgentSettingsTab />
        </TabsContent>
        <TabsContent value="sync">
            <SyncManagement />
          </TabsContent>
          <TabsContent value="alert-rules">
            <AlertRulesTab />
          </TabsContent>
        </Tabs>
    </div>
  );
}
