export interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
  adp?: number;
  adpSource?: string;
  adpLastUpdated?: string;
  [key: string]: any; // For any additional properties
}
