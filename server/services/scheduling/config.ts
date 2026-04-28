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
  ACC: ['Mills 160'],
  ART: ['Jackson 114', 'Jackson 116', 'Lucas 103'],
  ASL: [],
  BIB: ['Sanderson 101', 'Sanderson 102', 'Sanderson 114', 'Sanderson 119B', 'Sanderson 201', 'Sanderson 202'],
  BIO: ['Mills 160', 'Mills 180', 'Mills 270', 'Mills 280', 'Mills 232', 'Mills 250'],
  BUS: ['Mills 150', 'Mills 180'],
  CDV: ['Brock 122', 'Brock 212', 'Brock 214'],
  CHE: ['Mills 180', 'Mills 280', 'Mills 380', 'Mills 330'],
  COR: [],
  COS: ['Mills 130', 'Mills 150'],
  ECO: ['Brock 118', 'Brock 120', 'Brock 122', 'Mills 180', 'Sanderson 114'],
  EDU: ['Brock 122', 'Brock 313'],
  ENG: ['Sanderson 101', 'Sanderson 102', 'Sanderson 114', 'Sanderson 119B', 'Sanderson 201', 'Sanderson 202'],
  ENT: [], // Entrepreneurship
  FIN: [], // Finance
  FRE: ['Brock 212'],
  GE: ['Brock 122'],
  GRE: ['Sanderson 119B'], // Greek

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
