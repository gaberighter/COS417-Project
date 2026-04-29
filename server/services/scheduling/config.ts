const similarDepartments: Record<string, string[]> = {
  ACC: ['BUS', 'ECO', 'FIN'],
  BUS: ['ACC', 'FIN', 'MGT', 'MKT', 'SPM'],
  ECO: ['BUS', 'ACC', 'FIN'],
  FIN: ['BUS', 'ACC', 'ECO'],
  MGT: ['BUS', 'ACC'],
  MKT: ['BUS', 'ACC'],
  COS: ['MAT', 'STA'],
  MAT: ['COS', 'STA', 'PHY'],
  STA: ['MAT', 'COS'],
  BIO: ['CHE', 'PHY'],
  CHE: ['BIO', 'PHY'],
  PHY: ['MAT', 'CHE', 'BIO'],
  ENG: [],
  HIS: ['POL'],
  POL: ['HIS', 'ECO'],
  BIB: ['MIN'],
  MIN: ['BIB'],
  SPA: ['FRE', 'ASL'],
  FRE: ['SPA', 'ASL'],
  ASL: ['SPA', 'FRE'],
}


// Rooms typically used by each department
const departmentTypicalRooms: Record<string, string[]> = {
  ACC: ['MH 160'],
  ART: ['JH 114', 'JH 116', 'LA 103'],
  ASL: [],
  BIB: ['SN 101', 'SN 102', 'SN 114', 'SN 119B', 'SN 201', 'SN 202'],
  BIO: ['MH 160', 'MH 180', 'MH 270', 'MH 280', 'MH 232', 'MH 250'],
  BUS: ['MH 150', 'MH 180'],
  CDV: ['BH 122', 'BH 212', 'BH 214'], // Community Development
  CHE: ['MH 180', 'MH 280', 'MH 380', 'MH 330'],
  COR: [],
  COS: ['MH 130', 'MH 150'],
  ECO: ['BH 118', 'BH 120', 'BH 122', 'MH 180', 'SN 114'],
  EDU: ['BH 122', 'BH 313'],
  ENG: ['SN 101', 'SN 102', 'SN 114', 'SN 119B', 'SN 201', 'SN 202'],
  ENT: [], // Entrepreneurship
  FIN: [], // Finance
  FRE: ['BH 209', 'BH 212', 'BH 214'],
  GE: ['BH 122'], // General Ed (academic help classes)
  GRE: ['SN 119B', 'SN 201', 'SN 202'], // Greek
  HEB: ['SN 119B', 'SN 201', 'SN 202'], // Hebrew
  HIS: ['BH 114', 'BH 120', 'BH 212', 'BH 214', 'MH 160'],
  HSC: [], // Health Sciences
  HWC: ['BC 312'], // Health and Wellness Core (Fitness for Life: Likely not in use anymore)
  IDS: [], // Interdisciplinary Studies
  INS: ['BH 114', 'BH 214'], // International Studies
  LIN: ['SN 201', 'SN 202', 'BH 122'], // Linguistics
  MAT: ['MH 270', 'MH 280', 'MH 380'],
  MIN: ['SN 101', 'SN 102', 'SN 114', 'SN 119B', 'SN 201', 'SN 202'], // Ministry
  MIS: ['SN 201', 'SN 202', 'BH 114'], // Missions (contains world religions)
  MKT: [], // Marketing
  MSP: ['BH 212'], // Mac Scholars Program (and likely other leadership classes)
  MUS: ['CL 122', 'CL 113', 'CL 210'],
  NSC: ['MH 180', 'MH 280', 'MH 310'], // Natural Sciences
  PDV: ['BH 122', 'BH 212', 'BH 214'], // Poverty and Development
  PHI: ['SN 101', 'SN 102', 'SN 114', 'SN 119B'],
  PHY: ['MH 380', 'MH 310', 'MH 360'],
  POL: ['BH 114', 'BH 214'],
  PSY: ['MH 160', 'MH 214', 'MH 270'],
  SOC: ['BH 118'],
  SPA: ['BH 209', 'BH 212', 'BH 214'],
  SPM: [],
  STA: ['BH 120', 'MH 150'], // Stats
  THT: [] // Theater
}

export const schedulingConfig = {
  maxHistoryRuns: 24,
  maxHistoryPerCourse: 32,
  maxHistoryForProfile: 120,
  historyRecencyDecay: 0.85,
  // Rooms that should not be assigned classes unless they have been there before, or are explicitly requested
  guardedRoomIdsRequiringRealData: [
    'Jackson 114',
    'Jackson 115',
    'Jackson 116',
    'Jackson 117',
    'Andreas 108',
    'Kirk',
    'Kresge 212',
    'Barnes 312',
  ] as string[],
  similarity: {
    enrollmentDeltaAbsolute: 10,
    enrollmentDeltaPercent: 0.25,
  },
  abnormalPlacement: {
    penaltyScore: 800,
    requireHistoricalBuilding: true,
  },
  weights: {
    currentPreferredDays: 45,
    currentPreferredTimes: 45,
    currentAvoidTimes: -60,
    currentPreferredRoom: 40,
    currentPreferredBuilding: 30,
    officeBuilding: 10,
    capacityFit: 8,
    backToBack: 10,
    historyExactPlacement: 55,
    historyExactTime: 28,
    historyExactRoom: 20,
    historyBuilding: 12,
    historyFloor: 8,
    historyRoomType: 8,
    historyCapacityBand: 6,
    historicalPreferenceDays: 8,
    historicalPreferenceTimes: 8,
    professorHistory: 22,
    similarProfessorHistory: 14,
    similarCourseHistory: 20,
    departmentHistory: 12,
    similarDepartmentHistory: 10,
  },
  similarDepartments,
} as const
