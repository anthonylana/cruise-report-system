// Mirrors backend/app/schemas/clients.py (ClientOut).

export interface Client {
  id: number;
  name: string;
  /** Total events for this client, all time (can be 0). */
  event_count: number;
}
