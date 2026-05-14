import cron from 'node-cron';
import { SendDailyToAllUsersUseCase, TimeSlot } from '../use-cases/SendDailyToAllUsersUseCase';

/**
 * DailySchedulerService
 * Fires WhatsApp solar-radiation recommendations 3 times a day in Colombia time (UTC-5):
 *   - 06:00 CO  = 11:00 UTC  → morning slot
 *   - 12:00 CO  = 17:00 UTC  → noon slot
 *   - 18:00 CO  = 23:00 UTC  → evening slot
 */
export class DailySchedulerService {
  private tasks: cron.ScheduledTask[] = [];

  constructor(private readonly sendDailyToAll: SendDailyToAllUsersUseCase) {}

  start(): void {
    const schedule: Array<{ utcCron: string; slot: TimeSlot; label: string }> = [
      { utcCron: '0 11 * * *', slot: 'morning', label: '06:00 Colombia (mañana)' },
      { utcCron: '0 17 * * *', slot: 'noon',    label: '12:00 Colombia (mediodía)' },
      { utcCron: '0 23 * * *', slot: 'evening', label: '18:00 Colombia (tarde-noche)' },
    ];

    for (const { utcCron, slot, label } of schedule) {
      const task = cron.schedule(utcCron, async () => {
        console.log(`[DailyScheduler] ▶ Enviando recomendaciones [${label}] a todos los usuarios...`);
        const result = await this.sendDailyToAll.execute(slot);
        if (result.isFailure) {
          console.error(`[DailyScheduler] ✖ Error en slot ${slot}:`, result.error);
        } else {
          console.log(`[DailyScheduler] ✔ Recomendaciones [${label}] enviadas correctamente.`);
        }
      });
      this.tasks.push(task);
    }

    console.log('[DailyScheduler] ✅ Scheduler iniciado — envíos a las 6 AM, 12 PM y 6 PM hora Colombia.');
  }

  stop(): void {
    this.tasks.forEach((t) => t.stop());
    this.tasks = [];
    console.log('[DailyScheduler] Detenido.');
  }
}
