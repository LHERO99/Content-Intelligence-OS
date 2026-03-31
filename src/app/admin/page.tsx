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
import { Loader2, UserPlus, Copy, Check, Edit2, Trash2, X, Users, Key } from "lucide-react";
import { ApiKeysManagement } from "./api-keys-management";

interface User {
  id: string;
  Name: string;
  Email: string;
  Role: string;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [inviteData, setInviteData] = useState({ name: "", email: "", role: "Editor" });
  const [inviteResult, setInviteResult] = useState<{ inviteLink: string; tempPassword: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Editing state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ name: string; role: string }>({ name: "", role: "" });
  const [updating, setUpdating] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (session?.user?.role !== "Admin" && status === "authenticated") {
      router.push("/");
    } else if (status === "authenticated") {
      fetchUsers();
    }
  }, [status, session, router]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Fehler beim Laden der Benutzer");
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError(null);
    setInviteResult(null);

    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler beim Einladen des Benutzers");

      setInviteResult(data);
      setInviteData({ name: "", email: "", role: "Editor" });
      fetchUsers(); // Refresh list
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInviting(false);
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

      if (!res.ok) throw new Error("Fehler beim Aktualisieren des Benutzers");
      
      setEditingUserId(null);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Sind Sie sicher, dass Sie diesen Benutzer löschen möchten?")) return;
    
    setDeletingUserId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Fehler beim Löschen des Benutzers");
      
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingUserId(null);
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
        <h1 className="text-3xl font-bold tracking-tight text-[#00463c]">Admin-Bereich</h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Nutzer
          </TabsTrigger>
          <TabsTrigger value="apikeys" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API-Keys
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Invite User Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Neuen Benutzer einladen
                </CardTitle>
                <CardDescription>
                  Erstellen Sie einen neuen Benutzer und generieren Sie einen Einladungslink.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInvite} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Vollständiger Name</label>
                    <Input 
                      placeholder="Max Mustermann" 
                      value={inviteData.name}
                      onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                      className="h-10"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">E-Mail-Adresse</label>
                    <Input 
                      type="email" 
                      placeholder="max@example.com" 
                      value={inviteData.email}
                      onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                      className="h-10"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Rolle</label>
                    <Select 
                      value={inviteData.role} 
                      onValueChange={(v) => setInviteData({ ...inviteData, role: v || "Editor" })}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Rolle auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Editor">Editor</SelectItem>
                        <SelectItem value="Viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full h-10 bg-[#00463c] hover:bg-[#00332c]" disabled={inviting}>
                    {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Einladung generieren"}
                  </Button>
                </form>

                {inviteResult && (
                  <div className="mt-6 space-y-4 rounded-lg border bg-muted p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Temporäres Passwort:</p>
                      <code className="block rounded bg-background p-2 text-xs font-mono">
                        {inviteResult.tempPassword}
                      </code>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Einladungslink:</p>
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
                      Teilen Sie diesen Link und das Passwort mit dem Benutzer. Er sollte sein Passwort nach dem ersten Login ändern.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* User List */}
            <Card>
              <CardHeader>
                <CardTitle>Benutzerliste</CardTitle>
                <CardDescription>
                  Alle aktuell im System registrierten Benutzer.
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
                          <TableHead>Name</TableHead>
                          <TableHead>E-Mail</TableHead>
                          <TableHead>Rolle</TableHead>
                          <TableHead className="text-right">Aktionen</TableHead>
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
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              Keine Benutzer gefunden.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="apikeys">
          <ApiKeysManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
