export interface StageDef {
  key: string;
  name: string;
  short: string;
}

export const STAGES: StageDef[] = [
  { key: "site_prep", name: "Site Preparation", short: "Site Prep" },
  { key: "foundation", name: "Foundation", short: "Foundation" },
  { key: "structural", name: "Structural Work", short: "Structural" },
  { key: "brickwork", name: "Brickwork", short: "Brickwork" },
  { key: "electrical", name: "Electrical", short: "Electrical" },
  { key: "plumbing", name: "Plumbing", short: "Plumbing" },
  { key: "roofing", name: "Roofing", short: "Roofing" },
  { key: "interior", name: "Interior", short: "Interior" },
  { key: "painting", name: "Painting", short: "Painting" },
  { key: "elevation", name: "Elevation", short: "Elevation" },
  { key: "inspection", name: "Inspection", short: "Inspection" },
  { key: "handover", name: "Handover", short: "Handover" },
];
