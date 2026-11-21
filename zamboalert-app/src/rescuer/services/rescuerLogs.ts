import { API_BASE_URL } from '../../config';

export interface RescuerLogPayload {
  log_type: 'casualty_count' | 'victim_update';
  disaster_type?: string;
  casualty_count?: number;
  victim_label?: string;
  victim_status?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  message?: string;
}

/**
 * POST a rescuer field log so it appears in the web dashboard's Reports & Analytics.
 * Never throws: returns true when the backend stored it.
 */
export async function postRescuerLog(token: string, payload: RescuerLogPayload): Promise<boolean> {
  if (!token || token.startsWith('offline-')) return false;
  try {
    const response = await fetch(`${API_BASE_URL}/api/logs/rescuer`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) console.warn(`Rescuer log upload failed (${response.status}).`);
    return response.ok;
  } catch (error) {
    console.warn('Rescuer log upload failed', error);
    return false;
  }
}
