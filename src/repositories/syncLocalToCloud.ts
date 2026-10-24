import type { ProgressRepository } from './ProgressRepository';
import { SupabaseProgressRepository } from './SupabaseProgressRepository';
import { mergeAttemptsForSync } from './attemptMerge';
import { DEFAULT_UI_SETTINGS } from '../types/progress';

/**
 * Push guest IndexedDB progress into the signed-in user's cloud store.
 * Attempts are merged by id (richer wins). Settings: keep cloud if it
 * differs from defaults; otherwise upload local.
 */
export async function syncLocalToCloud(
  local: ProgressRepository,
  cloud: SupabaseProgressRepository,
): Promise<void> {
  const [localAttempts, cloudAttempts, localSettings, cloudSettings] =
    await Promise.all([
      local.getAllAttempts(),
      cloud.getAllAttempts(),
      local.getSettings(),
      cloud.getSettings(),
    ]);

  const merged = mergeAttemptsForSync(localAttempts, cloudAttempts);
  const cloudById = new Map(cloudAttempts.map((a) => [a.id, a]));
  const toUpsert = merged.filter((a) => {
    const existing = cloudById.get(a.id);
    if (!existing) return true;
    return JSON.stringify(existing) !== JSON.stringify(a);
  });

  if (toUpsert.length > 0) {
    await cloud.upsertAttempts(toUpsert);
  }

  const cloudIsDefault =
    cloudSettings.contentScale === DEFAULT_UI_SETTINGS.contentScale &&
    cloudSettings.textAlign === DEFAULT_UI_SETTINGS.textAlign &&
    cloudSettings.textPosition === DEFAULT_UI_SETTINGS.textPosition &&
    cloudSettings.highContrast === DEFAULT_UI_SETTINGS.highContrast;

  const localDiffers =
    localSettings.contentScale !== cloudSettings.contentScale ||
    localSettings.textAlign !== cloudSettings.textAlign ||
    localSettings.textPosition !== cloudSettings.textPosition ||
    localSettings.highContrast !== cloudSettings.highContrast;

  if (cloudIsDefault && localDiffers) {
    await cloud.saveSettings(localSettings);
  }
}
