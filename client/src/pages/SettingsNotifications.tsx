import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { ChevronLeft, Bell, MessageSquare, Calendar, Megaphone, UserPlus, CreditCard } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

type Channel = "inApp" | "sms" | "email";

type NotifType = {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  clientOnly?: boolean;
  techOnly?: boolean;
};

const NOTIF_TYPES: NotifType[] = [
  {
    key: "bookingConfirmation",
    label: "Booking Confirmations",
    description: "When a booking is confirmed or accepted",
    icon: <Calendar size={18} />,
  },
  {
    key: "bookingReminder",
    label: "Booking Reminders",
    description: "24 hours before your appointment",
    icon: <Bell size={18} />,
  },
  {
    key: "bookingCancellation",
    label: "Cancellations",
    description: "When a booking is cancelled by either party",
    icon: <Calendar size={18} />,
  },
  {
    key: "newMessage",
    label: "New Messages",
    description: "When you receive a new message",
    icon: <MessageSquare size={18} />,
  },
  {
    key: "newFollower",
    label: "New Subscribers",
    description: "When someone subscribes to your profile",
    icon: <UserPlus size={18} />,
    techOnly: true,
  },
  {
    key: "newBookingRequest",
    label: "Booking Requests",
    description: "When a client requests to book you",
    icon: <Calendar size={18} />,
    techOnly: true,
  },
  {
    key: "newPost",
    label: "New Posts from Followed Techs",
    description: "When a tech you follow posts new work",
    icon: <Bell size={18} />,
    clientOnly: true,
  },
  {
    key: "feeUpdate",
    label: "Fee & Payment Updates",
    description: "Cancellation fees and payment activity",
    icon: <CreditCard size={18} />,
  },
  {
    key: "promotions",
    label: "Promotions from Valisse",
    description: "Tips, features, and platform news",
    icon: <Megaphone size={18} />,
  },
];

type PrefsState = Record<string, Record<Channel, boolean>>;

function buildDefaultPrefs(): PrefsState {
  const prefs: PrefsState = {};
  for (const t of NOTIF_TYPES) {
    prefs[t.key] = { inApp: true, sms: false, email: false };
  }
  return prefs;
}

export default function SettingsNotifications() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [prefs, setPrefs] = useState<PrefsState>(buildDefaultPrefs());
  const [dirty, setDirty] = useState(false);

  const { data: savedPrefs, isLoading } = trpc.settings.getNotificationPreferences.useQuery();

  useEffect(() => {
    if (savedPrefs) {
      const merged = buildDefaultPrefs();
      for (const key of Object.keys(merged)) {
        const saved = (savedPrefs as any)[key];
        if (saved) {
          merged[key] = {
            inApp: saved.inApp ?? true,
            sms: saved.sms ?? false,
            email: saved.email ?? false,
          };
        }
      }
      setPrefs(merged);
    }
  }, [savedPrefs]);

  const updatePref = trpc.settings.updateNotificationPreference.useMutation();


  const toggle = (key: string, channel: Channel) => {
    const newVal = !prefs[key][channel];
    setPrefs((prev) => ({
      ...prev,
      [key]: { ...prev[key], [channel]: newVal },
    }));
    setDirty(true);
    updatePref.mutate({
      type: key,
      inApp: channel === "inApp" ? newVal : prefs[key].inApp,
      sms: channel === "sms" ? newVal : prefs[key].sms,
      email: channel === "email" ? newVal : prefs[key].email,
    });
  };

  const isTech = user?.userType === "nail_tech";
  const visibleTypes = NOTIF_TYPES.filter(
    (t) => (!t.clientOnly || !isTech) && (!t.techOnly || isTech)
  );

  const handleSave = async () => {
    for (const key of Object.keys(prefs)) {
      await updatePref.mutateAsync({ type: key, ...prefs[key] });
    }
    toast.success("Notification preferences saved");
    setDirty(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate("/settings")} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold flex-1">Notifications</h1>
        {dirty && (
          <Button size="sm" onClick={handleSave} disabled={updatePref.isPending}>
            {updatePref.isPending ? "Saving…" : "Save"}
          </Button>
        )}
      </div>

      <div className="px-4 py-4">
        {/* Channel legend */}
        <div className="flex items-center justify-end gap-4 mb-3 px-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-10 text-center">In-App</span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-10 text-center">SMS</span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-10 text-center">Email</span>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {visibleTypes.map((t, i) => (
            <div key={t.key}>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  {t.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
                <div className="flex items-center gap-4">
                  {(["inApp", "sms", "email"] as Channel[]).map((ch) => (
                    <div key={ch} className="w-10 flex justify-center">
                      <Switch
                        checked={prefs[t.key]?.[ch] ?? false}
                        onCheckedChange={() => toggle(t.key, ch)}
                        disabled={isLoading}
                      />
                    </div>
                  ))}
                </div>
              </div>
              {i < visibleTypes.length - 1 && <Separator className="ml-[68px]" />}
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4 px-4">
          SMS notifications require your phone number to be set in your profile. Email sending will be enabled in a future update.
        </p>
      </div>
    </div>
  );
}
