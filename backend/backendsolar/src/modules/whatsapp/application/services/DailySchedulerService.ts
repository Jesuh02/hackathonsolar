import cron from 'node-cron';
import { SendDailyToAllUsersUseCase } from '../use-cases/SendDailyToAllUsersUseCase';

/**
 * DailySchedulerService - fires WhatsApp recommendations every morning at 7:00 AM Bogotá time.
 * Loads all users from Supabase and sends personalised recommendations to each.
 * Cron expression runs in UTC → Colombia is UTC-5, so 7:00 CO = 12:00 UTC
 */
export class DailySchedulerService {
  private task: cron.ScheduledTask | null = null;

  constructor(private readonly sendDailyToAll: SendDailyToAllUsersUseCase) {}

  start(): void {
    // Every day at 12:00 UTC = 07:00 Colombia time
    this.task = cron.schedule('0 12 * * *', async () => {
      console.log('[DailyScheduler] Sending daily energy recommendations to all users...');
      const result = await this.sendDailyToAll.execute();
      if (result.isFailure) {
        console.error('[DailyScheduler] Failed:', result.error);
      } else {
        console.log('[DailyScheduler] Daily recommendations sent successfully.');
      }
    });
    console.log('[DailyScheduler] WhatsApp daily scheduler started (07:00 Colombia time).');
  }

  stop(): void {
    this.task?.stop();
    console.log('[DailyScheduler] Stopped.');
  }
}
