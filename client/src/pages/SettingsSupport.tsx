import { useLocation } from "wouter";
import { ChevronLeft, FileText, Shield, Mail, Star, Share2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type SupportItem = {
  icon: React.ReactNode;
  label: string;
  description: string;
  action: () => void;
  external?: boolean;
};

export default function SettingsSupport() {
  const [, navigate] = useLocation();

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Valisse — Find Your Nail Artist",
          text: "Discover and book talented nail artists near you on Valisse.",
          url: window.location.origin,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(window.location.origin);
      toast.success("Link copied to clipboard");
    }
  };

  const sections: { title: string; items: SupportItem[] }[] = [
    {
      title: "Legal",
      items: [
        {
          icon: <FileText size={18} />,
          label: "Terms of Service",
          description: "Read our terms and conditions",
          action: () => navigate("/terms"),
        },
        {
          icon: <Shield size={18} />,
          label: "Privacy Policy",
          description: "How we handle your data",
          action: () => navigate("/privacy"),
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          icon: <Mail size={18} />,
          label: "Contact Support",
          description: "Get help from the Valisse team",
          action: () => {
            window.open("mailto:info@valisseco.com?subject=Valisse Support", "_blank");
          },
          external: true,
        },
        {
          icon: <Star size={18} />,
          label: "Rate the App",
          description: "Leave a review on the App Store",
          action: () => toast.info("App Store listing coming soon!"),
        },
        {
          icon: <Share2 size={18} />,
          label: "Share Valisse",
          description: "Invite friends to discover nail artists",
          action: handleShare,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate("/settings")} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold flex-1">Support & Legal</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {sections.map((section) => (
          <div key={section.title} className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{section.title}</p>
            </div>
            {section.items.map((item, i) => (
              <div key={item.label}>
                <button
                  onClick={item.action}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  {item.external ? (
                    <ExternalLink size={14} className="text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronLeft size={14} className="text-muted-foreground flex-shrink-0 rotate-180" />
                  )}
                </button>
                {i < section.items.length - 1 && <div className="ml-[68px] border-b border-border" />}
              </div>
            ))}
          </div>
        ))}

        {/* App version */}
        <p className="text-xs text-muted-foreground text-center mt-2">
          Valisse v1.0.0 · Made with care
        </p>
      </div>
    </div>
  );
}
