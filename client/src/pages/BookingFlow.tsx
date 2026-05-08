import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowLeft, Calendar, Clock, ChevronRight, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const SERVICES = ["Gel Manicure", "Acrylic Nails", "Nail Art", "Pedicure", "Nail Extensions", "Dip Powder", "Natural Nails"];
const TIME_SLOTS = ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];

interface Props { techId: number }

export default function BookingFlow({ techId }: Props) {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const postId = new URLSearchParams(search).get("postId");

  const [step, setStep] = useState(0);
  const [selectedService, setSelectedService] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [notes, setNotes] = useState("");

  const { data: profileData } = trpc.users.getProfile.useQuery({ userId: techId });
  const utils = trpc.useUtils();

  const createBooking = trpc.bookings.create.useMutation({
    onSuccess: () => {
      setStep(3);
      utils.bookings.clientBookings.invalidate();
    },
    onError: () => toast.error("Failed to create booking. Please try again."),
  });

  const tech = profileData?.user;

  // Generate next 14 days
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  });

  const handleConfirm = () => {
    if (!selectedDate || !selectedTime) return;
    const [month, day, year] = selectedDate.split("/").map(Number);
    const [time, period] = selectedTime.split(" ");
    const [hours, minutes] = time.split(":").map(Number);
    const h = period === "PM" && hours !== 12 ? hours + 12 : period === "AM" && hours === 12 ? 0 : hours;
    const scheduledAt = new Date(year, month - 1, day, h, minutes).getTime();

    createBooking.mutate({
      techId,
      postId: postId ? Number(postId) : undefined,
      serviceType: selectedService || undefined,
      scheduledAt,
      notes: notes || undefined,
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-8">
        <p className="text-muted-foreground text-center">Please sign in to book an appointment.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background page-enter">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-border">
        <button onClick={() => step > 0 && step < 3 ? setStep(step - 1) : navigate(-1 as any)}
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-foreground">Book Appointment</h1>
          {step < 3 && <p className="text-xs text-muted-foreground">Step {step + 1} of 3</p>}
        </div>
        {tech && (
          <Avatar className="w-9 h-9">
            <AvatarImage src={tech.avatarUrl ?? undefined} />
            <AvatarFallback className="bg-accent text-primary text-sm">{(tech.name ?? "N").charAt(0)}</AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Progress */}
      {step < 3 && (
        <div className="flex gap-1 px-4 py-3">
          {[0, 1, 2].map(i => (
            <div key={i} className={cn("flex-1 h-1 rounded-full transition-all", i <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      )}

      <div className="px-4 py-4 pb-32">
        <AnimatePresence mode="wait">
          {/* Step 0: Service */}
          {step === 0 && (
            <motion.div key="service" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-xl font-display font-light mb-1">Choose Service</h2>
              <p className="text-sm text-muted-foreground mb-5">What would you like done?</p>
              <div className="space-y-2">
                {(tech?.services as string[] | null ?? SERVICES).map(service => (
                  <button
                    key={service}
                    onClick={() => setSelectedService(service)}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                      selectedService === service ? "border-primary bg-accent" : "border-border bg-card"
                    )}
                  >
                    <span className="text-sm font-medium">{service}</span>
                    {selectedService === service && <Check size={16} className="text-primary" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 1: Date */}
          {step === 1 && (
            <motion.div key="date" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-xl font-display font-light mb-1">Pick a Date</h2>
              <p className="text-sm text-muted-foreground mb-5">Select your preferred date</p>
              <div className="grid grid-cols-4 gap-2 mb-6">
                {dates.map(d => {
                  const dateStr = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
                  const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
                  const dayNum = d.getDate();
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={cn(
                        "flex flex-col items-center py-3 rounded-2xl border transition-all",
                        selectedDate === dateStr ? "border-primary bg-primary text-white" : "border-border bg-card text-foreground"
                      )}
                    >
                      <span className="text-xs opacity-70">{dayName}</span>
                      <span className="text-lg font-semibold">{dayNum}</span>
                    </button>
                  );
                })}
              </div>

              {selectedDate && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider text-xs">Available Times</p>
                  <div className="grid grid-cols-3 gap-2">
                    {TIME_SLOTS.map(t => (
                      <button
                        key={t}
                        onClick={() => setSelectedTime(t)}
                        className={cn(
                          "py-2.5 rounded-xl border text-sm transition-all",
                          selectedTime === t ? "border-primary bg-primary text-white" : "border-border bg-card text-foreground"
                        )}
                      >{t}</button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 2: Notes & Confirm */}
          {step === 2 && (
            <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-xl font-display font-light mb-1">Confirm Booking</h2>
              <p className="text-sm text-muted-foreground mb-5">Review your appointment details</p>

              <div className="bg-card rounded-2xl border border-border p-4 mb-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={tech?.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-accent text-primary">{(tech?.name ?? "N").charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{tech?.businessName || tech?.name}</p>
                    <p className="text-xs text-muted-foreground">{tech?.location}</p>
                  </div>
                </div>
                <div className="h-px bg-border" />
                {selectedService && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Service</span>
                    <span className="font-medium">{selectedService}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{selectedDate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Time</span>
                  <span className="font-medium">{selectedTime}</span>
                </div>
              </div>

              <Textarea
                placeholder="Any special requests or notes for the nail tech..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="rounded-xl resize-none mb-4"
                rows={3}
              />
            </motion.div>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-16 gap-6"
            >
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Check size={36} className="text-primary" />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-display font-light mb-2">Booking Sent!</h2>
                <p className="text-muted-foreground text-sm">Your request has been sent to {tech?.businessName || tech?.name}. You'll be notified once confirmed.</p>
              </div>
              <button onClick={() => navigate("/bookings")} className="btn-valisse px-8 py-3">
                View My Bookings
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      {step < 3 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40">
          <button
            onClick={() => {
              if (step === 2) handleConfirm();
              else setStep(step + 1);
            }}
            disabled={(step === 1 && (!selectedDate || !selectedTime)) || createBooking.isPending}
            className="w-full btn-valisse py-4 text-base disabled:opacity-50"
          >
            {step === 2 ? (createBooking.isPending ? "Sending..." : "Confirm Booking") : "Continue"}
            {step < 2 && <ChevronRight size={18} className="inline ml-1" />}
          </button>
        </div>
      )}
    </div>
  );
}
