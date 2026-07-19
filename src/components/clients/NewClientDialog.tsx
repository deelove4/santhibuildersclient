import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { UserPlus } from "lucide-react";
import { createClientAccount } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const clientSchema = z.object({
  email: z.string().trim().email(),
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional(),
  password: z.string().min(10, "At least 10 characters").max(128),
});

interface NewClientDialogProps {
  onCreated: () => void;
  label?: string;
}

export function NewClientDialog({ onCreated, label = "Add client" }: NewClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const createFn = useServerFn(createClientAccount);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = clientSchema.safeParse({
      email,
      full_name: fullName,
      phone: phone || undefined,
      password,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    try {
      await createFn({
        data: {
          email: parsed.data.email,
          full_name: parsed.data.full_name,
          phone: parsed.data.phone ?? null,
          password: parsed.data.password,
        },
      });
      toast.success("Client created");
      setEmail("");
      setFullName("");
      setPhone("");
      setPassword("");
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create client");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 size-4" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a new client</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="client-name">Full name</Label>
            <Input
              id="client-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-email">Email</Label>
            <Input
              id="client-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-phone">Phone (optional)</Label>
            <Input id="client-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-password">Temporary password</Label>
            <Input
              id="client-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min. 10 characters"
              required
            />
            <p className="text-xs text-muted-foreground">
              Share this with the client securely. They can change it after signing in.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}