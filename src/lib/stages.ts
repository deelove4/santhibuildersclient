export interface StageDef {
  key: string;
  name: string;
  short: string;
  description: string;
}

// Professional construction stages — aligned with the DB seed trigger.
export const STAGES: StageDef[] = [
  {
    key: "site_prep",
    name: "Site Preparation & Survey",
    short: "Site Prep",
    description: "Land clearing, soil testing, boundary marking, and layout survey.",
  },
  {
    key: "foundation",
    name: "Foundation & Excavation",
    short: "Foundation",
    description: "Excavation, PCC, footings, plinth beams, and anti-termite treatment.",
  },
  {
    key: "structural",
    name: "RCC Structural Framework",
    short: "Structural",
    description: "Columns, beams, slabs, and reinforced concrete framework.",
  },
  {
    key: "brickwork",
    name: "Masonry & Blockwork",
    short: "Masonry",
    description: "Brick and block walls, internal partitions, and lintels.",
  },
  {
    key: "electrical",
    name: "Electrical Rough-In",
    short: "Electrical",
    description: "Conduit laying, DB positioning, and concealed wiring runs.",
  },
  {
    key: "plumbing",
    name: "Plumbing Rough-In",
    short: "Plumbing",
    description: "Water supply, drainage lines, and sanitary fixture rough-ins.",
  },
  {
    key: "roofing",
    name: "Roof Slab & Waterproofing",
    short: "Roofing",
    description: "Terrace slab, insulation, and waterproofing membranes.",
  },
  {
    key: "interior",
    name: "Interior Finishes",
    short: "Interior",
    description: "Plastering, flooring, tiling, false ceiling, and joinery.",
  },
  {
    key: "painting",
    name: "Painting & Polishing",
    short: "Painting",
    description: "Primer, putty, emulsion, and wood/metal polish work.",
  },
  {
    key: "elevation",
    name: "External Elevation",
    short: "Elevation",
    description: "Façade cladding, textures, and external paint finish.",
  },
  {
    key: "inspection",
    name: "Quality Inspection & Snagging",
    short: "Inspection",
    description: "Punch list, finishing touch-ups, and final QA walkthrough.",
  },
  {
    key: "handover",
    name: "Final Handover",
    short: "Handover",
    description: "Documentation, keys handover, and warranty briefing.",
  },
];
