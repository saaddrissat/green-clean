"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  location: string;
  description: string;
  guests: string;
  reminder: string;
};
type CalendarViewMode = "days" | "hours";

const WEEK_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const EVENT_COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

const toDayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
const formatMonthTitle = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date);
const formatHour = (dateValue: string) =>
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(dateValue));

const toInputDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const toInputDateTime = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
};

const startOfWeek = (date: Date) => {
  const d = toDayStart(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};

const buildMonthDays = (monthDate: Date) => {
  const firstDayOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstWeekStart = startOfWeek(firstDayOfMonth);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstWeekStart);
    day.setDate(firstWeekStart.getDate() + index);
    return day;
  });
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const initialEvents: CalendarEvent[] = [
  {
    id: "ev-1",
    title: "Retrait client pro",
    start: "2026-05-05T10:00",
    end: "2026-05-05T11:00",
    allDay: false,
    color: "#0ea5e9",
    location: "Boutique principale",
    description: "Préparer les commandes pressing premium.",
    guests: "manager@greenclean.ma",
    reminder: "30 min",
  },
  {
    id: "ev-2",
    title: "Maintenance machine",
    start: "2026-05-08T08:30",
    end: "2026-05-08T10:30",
    allDay: false,
    color: "#f59e0b",
    location: "Atelier",
    description: "Contrôle hebdomadaire et nettoyage des filtres.",
    guests: "technique@greenclean.ma",
    reminder: "1 h",
  },
];

export default function CalendrierPage() {
  const today = useMemo(() => toDayStart(new Date()), []);
  const [visibleMonth, setVisibleMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("days");

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startDateTime, setStartDateTime] = useState(toInputDateTime(new Date()));
  const [endDateTime, setEndDateTime] = useState(toInputDateTime(new Date(Date.now() + 60 * 60 * 1000)));
  const [eventColor, setEventColor] = useState(EVENT_COLORS[0]);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [guests, setGuests] = useState("");
  const [reminder, setReminder] = useState("30 min");

  const monthDays = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);
  const periodLabel = useMemo(() => formatMonthTitle(visibleMonth), [visibleMonth]);

  const periodRangeLabel = useMemo(() => {
    const start = monthDays[0];
    const end = monthDays[monthDays.length - 1];
    return `${formatDate(start)} - ${formatDate(end)}`;
  }, [monthDays]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const key = toInputDate(new Date(event.start));
      const current = map.get(key) ?? [];
      current.push(event);
      map.set(key, current);
    });
    return map;
  }, [events]);

  const selectedDayEvents = useMemo(() => {
    return events
      .filter((event) => isSameDay(new Date(event.start), selectedDate))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [events, selectedDate]);

  const hourSlots = useMemo(() => Array.from({ length: 15 }, (_, index) => 7 + index), []);

  const resetForm = () => {
    const now = new Date();
    setTitle("");
    setAllDay(false);
    setStartDateTime(toInputDateTime(now));
    setEndDateTime(toInputDateTime(new Date(now.getTime() + 60 * 60 * 1000)));
    setEventColor(EVENT_COLORS[0]);
    setLocation("");
    setDescription("");
    setGuests("");
    setReminder("30 min");
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const openCreateDialogAt = (date: Date, hour: number) => {
    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(hour + 1, 0, 0, 0);
    setTitle("");
    setAllDay(false);
    setStartDateTime(toInputDateTime(start));
    setEndDateTime(toInputDateTime(end));
    setEventColor(EVENT_COLORS[0]);
    setLocation("");
    setDescription("");
    setGuests("");
    setReminder("30 min");
    setIsCreateDialogOpen(true);
  };

  const handleCreateEvent = () => {
    if (!title.trim()) return;
    const start = allDay ? `${startDateTime}T00:00` : startDateTime;
    const end = allDay ? `${endDateTime}T23:59` : endDateTime;
    const nextEvent: CalendarEvent = {
      id: `ev-${Date.now()}`,
      title: title.trim(),
      start,
      end,
      allDay,
      color: eventColor,
      location: location.trim(),
      description: description.trim(),
      guests: guests.trim(),
      reminder,
    };
    setEvents((prev) => [...prev, nextEvent]);
    setIsCreateDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">Calendrier</h1>
          <p className="text-sm text-slate-500">Planification des événements et activités de la blanchisserie.</p>
        </div>
        <Button type="button" onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Créer un événement
        </Button>
      </section>

      <section>
        <Card>
          <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg capitalize">
                <CalendarDays className="h-5 w-5 text-sky-600" />
                {periodLabel}
              </CardTitle>
              <CardDescription>Période affichée: {periodRangeLabel}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" onClick={() => setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>
                Aujourd&apos;hui
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("days")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    viewMode === "days" ? "bg-sky-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Jours
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("hours")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    viewMode === "hours" ? "bg-sky-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Heures
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Jour sélectionné: <span className="font-medium text-slate-700">{formatDate(selectedDate)}</span>
              </p>
            </div>

            {viewMode === "days" ? (
              <>
                <div className="grid grid-cols-7 gap-2 border-b border-slate-200 pb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {WEEK_DAYS.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-2">
                  {monthDays.map((day) => {
                    const key = toInputDate(day);
                    const dayEvents = eventsByDay.get(key) ?? [];
                    const inCurrentMonth = day.getMonth() === visibleMonth.getMonth();
                    const isToday = isSameDay(day, today);
                    const isSelectedDay = isSameDay(day, selectedDate);
                    return (
                      <div
                        key={key}
                        onClick={() => {
                          setSelectedDate(toDayStart(day));
                          setViewMode("hours");
                        }}
                        className={`min-h-28 cursor-pointer rounded-xl border p-2 transition ${
                          inCurrentMonth ? "border-slate-200 bg-white hover:bg-slate-50" : "border-slate-100 bg-slate-50"
                        } ${isSelectedDay ? "ring-2 ring-sky-500" : ""}`}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                              isToday ? "bg-sky-600 text-white" : "text-slate-600"
                            }`}
                          >
                            {day.getDate()}
                          </span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openCreateDialogAt(day, 9);
                            }}
                            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Ajouter un événement"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map((event) => (
                            <div
                              key={event.id}
                              className="truncate rounded-md px-2 py-1 text-xs font-medium text-white"
                              style={{ backgroundColor: event.color }}
                              title={`${event.title} (${event.allDay ? "Toute la journée" : `${event.start} - ${event.end}`})`}
                            >
                              {event.allDay ? event.title : `${formatHour(event.start)} ${event.title}`}
                            </div>
                          ))}
                          {dayEvents.length > 3 ? (
                            <p className="text-[11px] text-slate-500">+{dayEvents.length - 3} autres</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="space-y-2">
                {hourSlots.map((hour) => {
                  const slotEvents = selectedDayEvents.filter((event) => {
                    if (event.allDay) return false;
                    return new Date(event.start).getHours() === hour;
                  });
                  return (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => openCreateDialogAt(selectedDate, hour)}
                      className="flex w-full items-start gap-3 rounded-xl border border-slate-200 px-3 py-2 text-left transition hover:bg-slate-50"
                    >
                      <span className="w-14 shrink-0 text-sm font-semibold text-slate-700">
                        {String(hour).padStart(2, "0")}:00
                      </span>
                      <div className="min-h-8 flex-1">
                        {slotEvents.length === 0 ? (
                          <p className="text-sm text-slate-400">Ajouter un événement</p>
                        ) : (
                          <div className="space-y-1">
                            {slotEvents.map((event) => (
                              <div
                                key={event.id}
                                className="rounded-md px-2 py-1 text-xs font-medium text-white"
                                style={{ backgroundColor: event.color }}
                              >
                                {formatHour(event.start)} - {event.title}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Créer un événement</DialogTitle>
            <DialogDescription>Interface inspirée de Google Calendar pour planifier rapidement un événement.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Titre de l’événement"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Début</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  type={allDay ? "date" : "datetime-local"}
                  value={allDay ? startDateTime.split("T")[0] : startDateTime}
                  onChange={(event) => setStartDateTime(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Fin</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  type={allDay ? "date" : "datetime-local"}
                  value={allDay ? endDateTime.split("T")[0] : endDateTime}
                  onChange={(event) => setEndDateTime(event.target.value)}
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} />
              Toute la journée
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Lieu</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Ajouter un lieu"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Invités</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="emails séparés par virgule"
                  value={guests}
                  onChange={(event) => setGuests(event.target.value)}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Couleur</span>
                <div className="flex items-center gap-2">
                  {EVENT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEventColor(color)}
                      className={`h-7 w-7 rounded-full border-2 ${eventColor === color ? "border-slate-700" : "border-transparent"}`}
                      style={{ backgroundColor: color }}
                      aria-label={`Choisir la couleur ${color}`}
                    />
                  ))}
                </div>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-600">Rappel</span>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={reminder}
                  onChange={(event) => setReminder(event.target.value)}
                >
                  <option value="Aucun">Aucun</option>
                  <option value="10 min">10 min avant</option>
                  <option value="30 min">30 min avant</option>
                  <option value="1 h">1 heure avant</option>
                  <option value="1 jour">1 jour avant</option>
                </select>
              </label>
            </div>

            <label className="space-y-1 text-sm">
              <span className="text-slate-600">Description</span>
              <textarea
                className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ajouter une description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="button" onClick={handleCreateEvent}>
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
