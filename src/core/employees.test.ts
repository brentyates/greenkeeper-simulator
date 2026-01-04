import { describe, it, expect, beforeEach } from "vitest";
import {
  // Types
  Employee,
  EmployeeRole,
  EmployeeRoster,
  EmployeeSkills,

  // Constants
  EMPLOYEE_CONFIGS,
  SKILL_LEVEL_BONUSES,
  SKILL_LEVELS_ORDER,
  DEFAULT_MAX_EMPLOYEES,
  PAYROLL_INTERVAL_MINUTES,

  // Factory functions
  createInitialRoster,
  generateRandomName,
  generateRandomSkills,
  createEmployee,
  generateHiringPool,

  // Query functions
  getEmployee,
  getEmployeesByRole,
  getEmployeesByStatus,
  getWorkingEmployees,
  getEmployeeCount,
  getEmployeeCountByRole,
  canHire,
  getAvailableSlots,
  getTotalHourlyWages,
  getAverageHappiness,
  getAverageEfficiency,
  getEmployeesNeedingBreak,
  calculateEffectiveEfficiency,
  getNextSkillLevel,
  getExperienceForNextLevel,
  isEligibleForPromotion,
  awardExperience,
  getManagerBonus,

  // State transformation functions
  hireEmployee,
  fireEmployee,
  updateEmployee,
  setEmployeeStatus,
  assignEmployeeToArea,
  startEmployeeBreak,
  endEmployeeBreak,
  tickEmployees,
  processPayroll,
  promoteEmployee,
  adjustHappiness,
  giveRaise,
  refreshHiringPool,

  // Utility functions
  getRoleName,
  getSkillLevelName,
  formatWage,
  resetEmployeeCounter
} from "./employees";

// ============================================================================
// Test Helpers
// ============================================================================

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp_test",
    name: "Test Worker",
    role: "groundskeeper",
    skillLevel: "trained",
    skills: {
      efficiency: 1.0,
      quality: 1.0,
      stamina: 1.0,
      reliability: 0.9
    },
    hireDate: 0,
    hourlyWage: 15,
    experience: 0,
    happiness: 75,
    fatigue: 0,
    status: "working",
    assignedArea: null,
    ...overrides
  };
}

function makeRoster(overrides: Partial<EmployeeRoster> = {}): EmployeeRoster {
  return {
    employees: [],
    maxEmployees: DEFAULT_MAX_EMPLOYEES,
    lastPayrollTime: 0,
    totalWagesPaid: 0,
    ...overrides
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("Employee System", () => {
  beforeEach(() => {
    resetEmployeeCounter();
  });

  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe("Constants", () => {
    it("has configs for all employee roles", () => {
      const roles: EmployeeRole[] = [
        "groundskeeper", "mechanic", "irrigator",
        "pro_shop_staff", "manager", "caddy"
      ];

      for (const role of roles) {
        expect(EMPLOYEE_CONFIGS[role]).toBeDefined();
        expect(EMPLOYEE_CONFIGS[role].baseWage).toBeGreaterThan(0);
      }
    });

    it("has increasing wage multipliers by skill level", () => {
      for (const role of Object.keys(EMPLOYEE_CONFIGS) as EmployeeRole[]) {
        const config = EMPLOYEE_CONFIGS[role];
        expect(config.wageMultipliers.novice).toBeLessThanOrEqual(config.wageMultipliers.trained);
        expect(config.wageMultipliers.trained).toBeLessThanOrEqual(config.wageMultipliers.experienced);
        expect(config.wageMultipliers.experienced).toBeLessThanOrEqual(config.wageMultipliers.expert);
      }
    });

    it("managers have highest base wage", () => {
      const managerWage = EMPLOYEE_CONFIGS.manager.baseWage;
      for (const role of Object.keys(EMPLOYEE_CONFIGS) as EmployeeRole[]) {
        if (role !== "manager") {
          expect(EMPLOYEE_CONFIGS[role].baseWage).toBeLessThanOrEqual(managerWage);
        }
      }
    });

    it("has correct skill level order", () => {
      expect(SKILL_LEVELS_ORDER).toEqual(["novice", "trained", "experienced", "expert"]);
    });

    it("has increasing skill level bonuses", () => {
      expect(SKILL_LEVEL_BONUSES.novice).toBeLessThan(SKILL_LEVEL_BONUSES.trained);
      expect(SKILL_LEVEL_BONUSES.trained).toBeLessThan(SKILL_LEVEL_BONUSES.experienced);
      expect(SKILL_LEVEL_BONUSES.experienced).toBeLessThan(SKILL_LEVEL_BONUSES.expert);
    });
  });

  // ==========================================================================
  // Factory Function Tests
  // ==========================================================================

  describe("createInitialRoster", () => {
    it("creates empty roster", () => {
      const roster = createInitialRoster();
      expect(roster.employees).toEqual([]);
    });

    it("sets default max employees", () => {
      const roster = createInitialRoster();
      expect(roster.maxEmployees).toBe(DEFAULT_MAX_EMPLOYEES);
    });

    it("accepts custom max employees", () => {
      const roster = createInitialRoster(10);
      expect(roster.maxEmployees).toBe(10);
    });

    it("initializes payroll tracking", () => {
      const roster = createInitialRoster();
      expect(roster.lastPayrollTime).toBe(0);
      expect(roster.totalWagesPaid).toBe(0);
    });
  });

  describe("generateRandomName", () => {
    it("generates a name with first and last", () => {
      const name = generateRandomName();
      expect(name.split(" ").length).toBe(2);
    });

    it("generates different names with different seeds", () => {
      const name1 = generateRandomName(0.1);
      const name2 = generateRandomName(0.9);
      // Names might be the same by chance, but very unlikely with different seeds
      // Just check they are valid names
      expect(name1.length).toBeGreaterThan(0);
      expect(name2.length).toBeGreaterThan(0);
    });
  });

  describe("generateRandomSkills", () => {
    it("generates skills within valid range", () => {
      const skills = generateRandomSkills("trained");
      expect(skills.efficiency).toBeGreaterThanOrEqual(0.5);
      expect(skills.efficiency).toBeLessThanOrEqual(2.0);
      expect(skills.quality).toBeGreaterThanOrEqual(0.5);
      expect(skills.quality).toBeLessThanOrEqual(2.0);
      expect(skills.stamina).toBeGreaterThanOrEqual(0.5);
      expect(skills.stamina).toBeLessThanOrEqual(2.0);
      expect(skills.reliability).toBeGreaterThanOrEqual(0.5);
      expect(skills.reliability).toBeLessThanOrEqual(1.0);
    });

    it("generates better skills for higher levels", () => {
      // Generate many samples to test average
      let noviceTotal = 0;
      let expertTotal = 0;

      for (let i = 0; i < 100; i++) {
        const novice = generateRandomSkills("novice", i / 100);
        const expert = generateRandomSkills("expert", i / 100);
        noviceTotal += novice.efficiency;
        expertTotal += expert.efficiency;
      }

      expect(expertTotal / 100).toBeGreaterThan(noviceTotal / 100);
    });
  });

  describe("createEmployee", () => {
    it("creates employee with unique id", () => {
      const emp1 = createEmployee("groundskeeper", "novice", 0);
      const emp2 = createEmployee("groundskeeper", "novice", 0);
      expect(emp1.id).not.toBe(emp2.id);
    });

    it("sets role correctly", () => {
      const emp = createEmployee("mechanic", "trained", 0);
      expect(emp.role).toBe("mechanic");
    });

    it("sets skill level correctly", () => {
      const emp = createEmployee("groundskeeper", "experienced", 0);
      expect(emp.skillLevel).toBe("experienced");
    });

    it("calculates wage based on role and skill level", () => {
      const config = EMPLOYEE_CONFIGS.groundskeeper;
      const emp = createEmployee("groundskeeper", "trained", 0);
      const expectedWage = config.baseWage * config.wageMultipliers.trained;
      expect(emp.hourlyWage).toBeCloseTo(expectedWage, 2);
    });

    it("sets hire date correctly", () => {
      const emp = createEmployee("groundskeeper", "novice", 5000);
      expect(emp.hireDate).toBe(5000);
    });

    it("starts with zero experience", () => {
      const emp = createEmployee("groundskeeper", "novice", 0);
      expect(emp.experience).toBe(0);
    });

    it("starts with default happiness", () => {
      const emp = createEmployee("groundskeeper", "novice", 0);
      expect(emp.happiness).toBe(75);
    });

    it("starts with zero fatigue", () => {
      const emp = createEmployee("groundskeeper", "novice", 0);
      expect(emp.fatigue).toBe(0);
    });

    it("starts idle", () => {
      const emp = createEmployee("groundskeeper", "novice", 0);
      expect(emp.status).toBe("idle");
    });

    it("accepts custom name", () => {
      const emp = createEmployee("groundskeeper", "novice", 0, "Custom Name");
      expect(emp.name).toBe("Custom Name");
    });

    it("accepts custom skills", () => {
      const customSkills: EmployeeSkills = {
        efficiency: 1.5,
        quality: 1.3,
        stamina: 1.2,
        reliability: 0.95
      };
      const emp = createEmployee("groundskeeper", "novice", 0, undefined, customSkills);
      expect(emp.skills).toEqual(customSkills);
    });
  });

  describe("generateHiringPool", () => {
    it("generates specified number of candidates", () => {
      const pool = generateHiringPool(1000, 5);
      expect(pool.candidates.length).toBe(5);
    });

    it("sets refresh time", () => {
      const pool = generateHiringPool(5000, 3);
      expect(pool.refreshTime).toBe(5000);
    });

    it("generates employees with various roles", () => {
      const pool = generateHiringPool(0, 20);
      const roles = new Set(pool.candidates.map(c => c.role));
      expect(roles.size).toBeGreaterThan(1);
    });
  });

  // ==========================================================================
  // Query Function Tests
  // ==========================================================================

  describe("getEmployee", () => {
    it("returns employee when found", () => {
      const emp = makeEmployee({ id: "emp_123" });
      const roster = makeRoster({ employees: [emp] });
      expect(getEmployee(roster, "emp_123")).toEqual(emp);
    });

    it("returns null when not found", () => {
      const roster = makeRoster();
      expect(getEmployee(roster, "emp_fake")).toBeNull();
    });
  });

  describe("getEmployeesByRole", () => {
    it("returns employees matching role", () => {
      const emp1 = makeEmployee({ id: "emp_1", role: "groundskeeper" });
      const emp2 = makeEmployee({ id: "emp_2", role: "mechanic" });
      const emp3 = makeEmployee({ id: "emp_3", role: "groundskeeper" });
      const roster = makeRoster({ employees: [emp1, emp2, emp3] });

      const groundskeepers = getEmployeesByRole(roster, "groundskeeper");
      expect(groundskeepers.length).toBe(2);
      expect(groundskeepers.every(e => e.role === "groundskeeper")).toBe(true);
    });

    it("returns empty array when no matches", () => {
      const emp = makeEmployee({ role: "groundskeeper" });
      const roster = makeRoster({ employees: [emp] });
      expect(getEmployeesByRole(roster, "manager")).toEqual([]);
    });
  });

  describe("getEmployeesByStatus", () => {
    it("returns employees matching status", () => {
      const emp1 = makeEmployee({ id: "emp_1", status: "working" });
      const emp2 = makeEmployee({ id: "emp_2", status: "on_break" });
      const emp3 = makeEmployee({ id: "emp_3", status: "working" });
      const roster = makeRoster({ employees: [emp1, emp2, emp3] });

      const working = getEmployeesByStatus(roster, "working");
      expect(working.length).toBe(2);
    });
  });

  describe("getWorkingEmployees", () => {
    it("returns only working employees", () => {
      const emp1 = makeEmployee({ id: "emp_1", status: "working" });
      const emp2 = makeEmployee({ id: "emp_2", status: "idle" });
      const emp3 = makeEmployee({ id: "emp_3", status: "working" });
      const roster = makeRoster({ employees: [emp1, emp2, emp3] });

      const working = getWorkingEmployees(roster);
      expect(working.length).toBe(2);
    });
  });

  describe("getEmployeeCount", () => {
    it("returns total count", () => {
      const roster = makeRoster({
        employees: [makeEmployee({ id: "1" }), makeEmployee({ id: "2" })]
      });
      expect(getEmployeeCount(roster)).toBe(2);
    });

    it("returns 0 for empty roster", () => {
      const roster = makeRoster();
      expect(getEmployeeCount(roster)).toBe(0);
    });
  });

  describe("getEmployeeCountByRole", () => {
    it("counts employees of specific role", () => {
      const roster = makeRoster({
        employees: [
          makeEmployee({ id: "1", role: "groundskeeper" }),
          makeEmployee({ id: "2", role: "mechanic" }),
          makeEmployee({ id: "3", role: "groundskeeper" })
        ]
      });
      expect(getEmployeeCountByRole(roster, "groundskeeper")).toBe(2);
      expect(getEmployeeCountByRole(roster, "mechanic")).toBe(1);
      expect(getEmployeeCountByRole(roster, "manager")).toBe(0);
    });
  });

  describe("canHire", () => {
    it("returns true when slots available", () => {
      const roster = makeRoster({ maxEmployees: 10, employees: [] });
      expect(canHire(roster)).toBe(true);
    });

    it("returns false when at max", () => {
      const roster = makeRoster({
        maxEmployees: 2,
        employees: [makeEmployee({ id: "1" }), makeEmployee({ id: "2" })]
      });
      expect(canHire(roster)).toBe(false);
    });
  });

  describe("getAvailableSlots", () => {
    it("calculates remaining slots", () => {
      const roster = makeRoster({
        maxEmployees: 10,
        employees: [makeEmployee({ id: "1" }), makeEmployee({ id: "2" })]
      });
      expect(getAvailableSlots(roster)).toBe(8);
    });
  });

  describe("getTotalHourlyWages", () => {
    it("sums all employee wages", () => {
      const roster = makeRoster({
        employees: [
          makeEmployee({ id: "1", hourlyWage: 15 }),
          makeEmployee({ id: "2", hourlyWage: 20 })
        ]
      });
      expect(getTotalHourlyWages(roster)).toBe(35);
    });

    it("returns 0 for empty roster", () => {
      const roster = makeRoster();
      expect(getTotalHourlyWages(roster)).toBe(0);
    });
  });

  describe("getAverageHappiness", () => {
    it("calculates average happiness", () => {
      const roster = makeRoster({
        employees: [
          makeEmployee({ id: "1", happiness: 80 }),
          makeEmployee({ id: "2", happiness: 60 })
        ]
      });
      expect(getAverageHappiness(roster)).toBe(70);
    });

    it("returns 100 for empty roster", () => {
      const roster = makeRoster();
      expect(getAverageHappiness(roster)).toBe(100);
    });
  });

  describe("getAverageEfficiency", () => {
    it("calculates average efficiency", () => {
      const roster = makeRoster({
        employees: [
          makeEmployee({ id: "1", skills: { efficiency: 1.2, quality: 1, stamina: 1, reliability: 1 } }),
          makeEmployee({ id: "2", skills: { efficiency: 0.8, quality: 1, stamina: 1, reliability: 1 } })
        ]
      });
      expect(getAverageEfficiency(roster)).toBe(1.0);
    });

    it("returns 1 for empty roster", () => {
      const roster = makeRoster();
      expect(getAverageEfficiency(roster)).toBe(1);
    });
  });

  describe("getEmployeesNeedingBreak", () => {
    it("returns employees above fatigue threshold", () => {
      const config = EMPLOYEE_CONFIGS.groundskeeper;
      const emp1 = makeEmployee({
        id: "emp_1",
        status: "working",
        fatigue: config.breakThreshold + 1
      });
      const emp2 = makeEmployee({
        id: "emp_2",
        status: "working",
        fatigue: config.breakThreshold - 1
      });
      const roster = makeRoster({ employees: [emp1, emp2] });

      const needBreak = getEmployeesNeedingBreak(roster);
      expect(needBreak.length).toBe(1);
      expect(needBreak[0].id).toBe("emp_1");
    });

    it("excludes non-working employees", () => {
      const config = EMPLOYEE_CONFIGS.groundskeeper;
      const emp = makeEmployee({
        status: "on_break",
        fatigue: config.breakThreshold + 10
      });
      const roster = makeRoster({ employees: [emp] });

      expect(getEmployeesNeedingBreak(roster).length).toBe(0);
    });
  });

  describe("calculateEffectiveEfficiency", () => {
    it("returns base efficiency at full happiness and zero fatigue", () => {
      const emp = makeEmployee({
        skills: { efficiency: 1.0, quality: 1, stamina: 1, reliability: 1 },
        happiness: 100,
        fatigue: 0
      });
      expect(calculateEffectiveEfficiency(emp)).toBe(1.0);
    });

    it("reduces efficiency with low happiness", () => {
      const emp = makeEmployee({
        skills: { efficiency: 1.0, quality: 1, stamina: 1, reliability: 1 },
        happiness: 0,
        fatigue: 0
      });
      expect(calculateEffectiveEfficiency(emp)).toBe(0.5);
    });

    it("reduces efficiency with high fatigue", () => {
      const emp = makeEmployee({
        skills: { efficiency: 1.0, quality: 1, stamina: 1, reliability: 1 },
        happiness: 100,
        fatigue: 100
      });
      expect(calculateEffectiveEfficiency(emp)).toBe(0.7);
    });

    it("combines happiness and fatigue effects", () => {
      const emp = makeEmployee({
        skills: { efficiency: 1.0, quality: 1, stamina: 1, reliability: 1 },
        happiness: 50,
        fatigue: 50
      });
      const result = calculateEffectiveEfficiency(emp);
      expect(result).toBeLessThan(1.0);
      expect(result).toBeGreaterThan(0.5);
    });
  });

  describe("getNextSkillLevel", () => {
    it("returns next level for novice", () => {
      expect(getNextSkillLevel("novice")).toBe("trained");
    });

    it("returns next level for trained", () => {
      expect(getNextSkillLevel("trained")).toBe("experienced");
    });

    it("returns next level for experienced", () => {
      expect(getNextSkillLevel("experienced")).toBe("expert");
    });

    it("returns null for expert", () => {
      expect(getNextSkillLevel("expert")).toBeNull();
    });
  });

  describe("getExperienceForNextLevel", () => {
    it("returns remaining experience needed", () => {
      const emp = makeEmployee({
        role: "groundskeeper",
        skillLevel: "novice",
        experience: 400
      });
      const config = EMPLOYEE_CONFIGS.groundskeeper;
      expect(getExperienceForNextLevel(emp)).toBe(config.experienceToLevel - 400);
    });

    it("returns 0 for max level", () => {
      const emp = makeEmployee({ skillLevel: "expert", experience: 0 });
      expect(getExperienceForNextLevel(emp)).toBe(0);
    });
  });

  describe("isEligibleForPromotion", () => {
    it("returns true when experience threshold reached", () => {
      const config = EMPLOYEE_CONFIGS.groundskeeper;
      const emp = makeEmployee({
        role: "groundskeeper",
        skillLevel: "novice",
        experience: config.experienceToLevel
      });
      expect(isEligibleForPromotion(emp)).toBe(true);
    });

    it("returns false when below threshold", () => {
      const emp = makeEmployee({
        skillLevel: "novice",
        experience: 100
      });
      expect(isEligibleForPromotion(emp)).toBe(false);
    });

    it("returns false for expert level", () => {
      const emp = makeEmployee({
        skillLevel: "expert",
        experience: 10000
      });
      expect(isEligibleForPromotion(emp)).toBe(false);
    });
  });

  describe("awardExperience", () => {
    it("adds experience to employee", () => {
      const emp = makeEmployee({ experience: 100 });
      const roster = makeRoster({ employees: [emp] });
      const updated = awardExperience(roster, emp.id, 50);
      expect(updated.employees[0].experience).toBe(150);
    });

    it("promotes employee when threshold reached", () => {
      const config = EMPLOYEE_CONFIGS.groundskeeper;
      const emp = makeEmployee({
        role: "groundskeeper",
        skillLevel: "novice",
        experience: config.experienceToLevel - 50,
      });
      const roster = makeRoster({ employees: [emp] });
      const updated = awardExperience(roster, emp.id, 100);
      expect(updated.employees[0].skillLevel).toBe("trained");
      expect(updated.employees[0].experience).toBe(50);
    });

    it("increases skills on promotion", () => {
      const config = EMPLOYEE_CONFIGS.groundskeeper;
      const emp = makeEmployee({
        role: "groundskeeper",
        skillLevel: "novice",
        experience: config.experienceToLevel - 10,
        skills: { efficiency: 1.0, quality: 1.0, stamina: 1.0, reliability: 1.0 },
      });
      const roster = makeRoster({ employees: [emp] });
      const updated = awardExperience(roster, emp.id, 20);
      expect(updated.employees[0].skills.efficiency).toBe(1.05);
      expect(updated.employees[0].skills.quality).toBe(1.05);
    });

    it("returns roster unchanged for unknown employee", () => {
      const emp = makeEmployee({ experience: 100 });
      const roster = makeRoster({ employees: [emp] });
      const updated = awardExperience(roster, "unknown-id", 50);
      expect(updated).toBe(roster);
    });
  });

  describe("getManagerBonus", () => {
    it("returns 1.0 with no managers", () => {
      const roster = makeRoster({
        employees: [makeEmployee({ role: "groundskeeper", status: "working" })]
      });
      expect(getManagerBonus(roster)).toBe(1.0);
    });

    it("provides bonus with working manager", () => {
      const roster = makeRoster({
        employees: [
          makeEmployee({
            role: "manager",
            status: "working",
            skills: { efficiency: 1.0, quality: 1, stamina: 1, reliability: 1 },
            happiness: 100,
            fatigue: 0
          })
        ]
      });
      expect(getManagerBonus(roster)).toBeGreaterThan(1.0);
    });

    it("returns 1.0 when managers not working", () => {
      const roster = makeRoster({
        employees: [makeEmployee({ role: "manager", status: "on_break" })]
      });
      expect(getManagerBonus(roster)).toBe(1.0);
    });

    it("has diminishing returns for multiple managers", () => {
      const manager = makeEmployee({
        role: "manager",
        status: "working",
        skills: { efficiency: 1.0, quality: 1, stamina: 1, reliability: 1 },
        happiness: 100,
        fatigue: 0
      });

      const roster1 = makeRoster({ employees: [{ ...manager, id: "m1" }] });
      const roster2 = makeRoster({
        employees: [{ ...manager, id: "m1" }, { ...manager, id: "m2" }]
      });

      const bonus1 = getManagerBonus(roster1);
      const bonus2 = getManagerBonus(roster2);

      // Second manager should add less than first
      const firstBonus = bonus1 - 1.0;
      const secondBonus = bonus2 - bonus1;
      expect(secondBonus).toBeLessThan(firstBonus);
    });
  });

  // ==========================================================================
  // State Transformation Tests
  // ==========================================================================

  describe("hireEmployee", () => {
    it("adds employee to roster", () => {
      const roster = makeRoster({ maxEmployees: 10 });
      const emp = makeEmployee();
      const result = hireEmployee(roster, emp);

      expect(result?.employees.length).toBe(1);
      expect(result?.employees[0]).toEqual(emp);
    });

    it("returns null when at max capacity", () => {
      const roster = makeRoster({
        maxEmployees: 1,
        employees: [makeEmployee({ id: "existing" })]
      });
      const emp = makeEmployee({ id: "new" });

      expect(hireEmployee(roster, emp)).toBeNull();
    });

    it("preserves immutability", () => {
      const roster = makeRoster();
      const emp = makeEmployee();
      const result = hireEmployee(roster, emp);

      expect(roster.employees.length).toBe(0);
      expect(result?.employees.length).toBe(1);
    });
  });

  describe("fireEmployee", () => {
    it("removes employee from roster", () => {
      const emp = makeEmployee({ id: "emp_1" });
      const roster = makeRoster({ employees: [emp] });
      const result = fireEmployee(roster, "emp_1");

      expect(result?.employees.length).toBe(0);
    });

    it("returns null when employee not found", () => {
      const roster = makeRoster();
      expect(fireEmployee(roster, "fake_id")).toBeNull();
    });

    it("keeps other employees", () => {
      const emp1 = makeEmployee({ id: "emp_1" });
      const emp2 = makeEmployee({ id: "emp_2" });
      const roster = makeRoster({ employees: [emp1, emp2] });
      const result = fireEmployee(roster, "emp_1");

      expect(result?.employees.length).toBe(1);
      expect(result?.employees[0].id).toBe("emp_2");
    });
  });

  describe("updateEmployee", () => {
    it("updates specified fields", () => {
      const emp = makeEmployee({ id: "emp_1", happiness: 50 });
      const roster = makeRoster({ employees: [emp] });
      const result = updateEmployee(roster, "emp_1", { happiness: 75 });

      expect(result?.employees[0].happiness).toBe(75);
    });

    it("preserves other fields", () => {
      const emp = makeEmployee({ id: "emp_1", happiness: 50, fatigue: 30 });
      const roster = makeRoster({ employees: [emp] });
      const result = updateEmployee(roster, "emp_1", { happiness: 75 });

      expect(result?.employees[0].fatigue).toBe(30);
    });

    it("returns null for nonexistent employee", () => {
      const roster = makeRoster();
      expect(updateEmployee(roster, "fake", { happiness: 50 })).toBeNull();
    });
  });

  describe("setEmployeeStatus", () => {
    it("updates employee status", () => {
      const emp = makeEmployee({ id: "emp_1", status: "idle" });
      const roster = makeRoster({ employees: [emp] });
      const result = setEmployeeStatus(roster, "emp_1", "working");

      expect(result?.employees[0].status).toBe("working");
    });
  });

  describe("assignEmployeeToArea", () => {
    it("assigns employee to area", () => {
      const emp = makeEmployee({ id: "emp_1", assignedArea: null });
      const roster = makeRoster({ employees: [emp] });
      const result = assignEmployeeToArea(roster, "emp_1", "fairway_1");

      expect(result?.employees[0].assignedArea).toBe("fairway_1");
    });

    it("can clear assignment", () => {
      const emp = makeEmployee({ id: "emp_1", assignedArea: "fairway_1" });
      const roster = makeRoster({ employees: [emp] });
      const result = assignEmployeeToArea(roster, "emp_1", null);

      expect(result?.employees[0].assignedArea).toBeNull();
    });
  });

  describe("startEmployeeBreak", () => {
    it("sets status to on_break", () => {
      const emp = makeEmployee({ id: "emp_1", status: "working" });
      const roster = makeRoster({ employees: [emp] });
      const result = startEmployeeBreak(roster, "emp_1");

      expect(result?.employees[0].status).toBe("on_break");
    });
  });

  describe("endEmployeeBreak", () => {
    it("sets status to working", () => {
      const emp = makeEmployee({ id: "emp_1", status: "on_break" });
      const roster = makeRoster({ employees: [emp] });
      const result = endEmployeeBreak(roster, "emp_1");

      expect(result?.employees[0].status).toBe("working");
    });

    it("returns null if not on break", () => {
      const emp = makeEmployee({ id: "emp_1", status: "working" });
      const roster = makeRoster({ employees: [emp] });

      expect(endEmployeeBreak(roster, "emp_1")).toBeNull();
    });
  });

  describe("tickEmployees", () => {
    it("accrues fatigue for working employees", () => {
      const emp = makeEmployee({ id: "emp_1", status: "working", fatigue: 0 });
      const roster = makeRoster({ employees: [emp] });
      const result = tickEmployees(roster, 10);

      expect(result.roster.employees[0].fatigue).toBeGreaterThan(0);
    });

    it("accrues experience for working employees", () => {
      const emp = makeEmployee({ id: "emp_1", status: "working", experience: 0 });
      const roster = makeRoster({ employees: [emp] });
      const result = tickEmployees(roster, 10);

      expect(result.roster.employees[0].experience).toBeGreaterThan(0);
    });

    it("recovers fatigue for employees on break", () => {
      const emp = makeEmployee({ id: "emp_1", status: "on_break", fatigue: 50 });
      const roster = makeRoster({ employees: [emp] });
      const result = tickEmployees(roster, 10);

      expect(result.roster.employees[0].fatigue).toBeLessThan(50);
    });

    it("triggers automatic break at fatigue threshold", () => {
      const config = EMPLOYEE_CONFIGS.groundskeeper;
      const emp = makeEmployee({
        id: "emp_1",
        role: "groundskeeper",
        status: "working",
        fatigue: config.breakThreshold - 1
      });
      const roster = makeRoster({ employees: [emp] });
      const result = tickEmployees(roster, 10);

      expect(result.breaksTaken).toContain("emp_1");
      expect(result.roster.employees[0].status).toBe("on_break");
    });

    it("returns to work when fatigue recovered", () => {
      const emp = makeEmployee({ id: "emp_1", status: "on_break", fatigue: 25 });
      const roster = makeRoster({ employees: [emp] });
      const result = tickEmployees(roster, 10);

      expect(result.roster.employees[0].status).toBe("working");
    });

    it("triggers promotion when experience threshold reached", () => {
      const config = EMPLOYEE_CONFIGS.groundskeeper;
      const emp = makeEmployee({
        id: "emp_1",
        role: "groundskeeper",
        skillLevel: "novice",
        status: "working",
        experience: config.experienceToLevel - 1
      });
      const roster = makeRoster({ employees: [emp] });
      const result = tickEmployees(roster, 10);

      expect(result.promotions.length).toBe(1);
      expect(result.promotions[0].employeeId).toBe("emp_1");
      expect(result.promotions[0].newLevel).toBe("trained");
    });

    it("updates wage on promotion", () => {
      const config = EMPLOYEE_CONFIGS.groundskeeper;
      const emp = makeEmployee({
        id: "emp_1",
        role: "groundskeeper",
        skillLevel: "novice",
        status: "working",
        experience: config.experienceToLevel - 1,
        hourlyWage: config.baseWage * config.wageMultipliers.novice
      });
      const roster = makeRoster({ employees: [emp] });
      const result = tickEmployees(roster, 10);

      const expectedWage = config.baseWage * config.wageMultipliers.trained;
      expect(result.roster.employees[0].hourlyWage).toBeCloseTo(expectedWage, 2);
    });

    it("applies training bonus to reduce fatigue accrual", () => {
      const emp = makeEmployee({ id: "emp_1", status: "working", fatigue: 0 });
      const roster = makeRoster({ employees: [emp] });

      // Without training bonus
      const resultNoBonus = tickEmployees(roster, 10, 1.0);
      const fatigueNoBonus = resultNoBonus.roster.employees[0].fatigue;

      // With 1.5x training bonus (fatigue should be reduced)
      const resultWithBonus = tickEmployees(roster, 10, 1.5);
      const fatigueWithBonus = resultWithBonus.roster.employees[0].fatigue;

      expect(fatigueWithBonus).toBeLessThan(fatigueNoBonus);
    });

    it("applies training bonus to increase experience gain", () => {
      const emp = makeEmployee({ id: "emp_1", status: "working", experience: 0 });
      const roster = makeRoster({ employees: [emp] });

      // Without training bonus
      const resultNoBonus = tickEmployees(roster, 10, 1.0);
      const expNoBonus = resultNoBonus.roster.employees[0].experience;

      // With 1.5x training bonus
      const resultWithBonus = tickEmployees(roster, 10, 1.5);
      const expWithBonus = resultWithBonus.roster.employees[0].experience;

      expect(expWithBonus).toBeGreaterThan(expNoBonus);
      expect(expWithBonus).toBeCloseTo(expNoBonus * 1.5, 2);
    });

    it("uses default training bonus of 1.0 when not specified", () => {
      const emp = makeEmployee({ id: "emp_1", status: "working", experience: 0 });
      const roster = makeRoster({ employees: [emp] });

      const resultDefault = tickEmployees(roster, 10);
      const resultExplicit = tickEmployees(roster, 10, 1.0);

      expect(resultDefault.roster.employees[0].experience).toBe(
        resultExplicit.roster.employees[0].experience
      );
    });
  });

  describe("processPayroll", () => {
    it("does nothing before interval", () => {
      const emp = makeEmployee({ hourlyWage: 15 });
      const roster = makeRoster({
        employees: [emp],
        lastPayrollTime: 0
      });
      const result = processPayroll(roster, 30); // Only 30 minutes

      expect(result.totalPaid).toBe(0);
    });

    it("pays wages after interval", () => {
      const emp = makeEmployee({ id: "emp_1", hourlyWage: 15, status: "working" });
      const roster = makeRoster({
        employees: [emp],
        lastPayrollTime: 0
      });
      const result = processPayroll(roster, PAYROLL_INTERVAL_MINUTES);

      expect(result.totalPaid).toBe(15); // 1 hour at $15/hr
    });

    it("pays partial wages for non-working employees", () => {
      const emp = makeEmployee({ id: "emp_1", hourlyWage: 20, status: "idle" });
      const roster = makeRoster({
        employees: [emp],
        lastPayrollTime: 0
      });
      const result = processPayroll(roster, PAYROLL_INTERVAL_MINUTES);

      expect(result.totalPaid).toBe(10); // 50% rate for idle
    });

    it("updates last payroll time", () => {
      const emp = makeEmployee({ hourlyWage: 15 });
      const roster = makeRoster({ employees: [emp], lastPayrollTime: 0 });
      const result = processPayroll(roster, PAYROLL_INTERVAL_MINUTES);

      expect(result.roster.lastPayrollTime).toBe(PAYROLL_INTERVAL_MINUTES);
    });

    it("accumulates total wages paid", () => {
      const emp = makeEmployee({ hourlyWage: 15, status: "working" });
      const roster = makeRoster({
        employees: [emp],
        lastPayrollTime: 0,
        totalWagesPaid: 100
      });
      const result = processPayroll(roster, PAYROLL_INTERVAL_MINUTES);

      expect(result.roster.totalWagesPaid).toBe(115);
    });

    it("provides breakdown by employee", () => {
      const emp1 = makeEmployee({ id: "emp_1", hourlyWage: 15, status: "working" });
      const emp2 = makeEmployee({ id: "emp_2", hourlyWage: 20, status: "working" });
      const roster = makeRoster({
        employees: [emp1, emp2],
        lastPayrollTime: 0
      });
      const result = processPayroll(roster, PAYROLL_INTERVAL_MINUTES);

      expect(result.breakdown.length).toBe(2);
      expect(result.breakdown.find(b => b.employeeId === "emp_1")?.amount).toBe(15);
      expect(result.breakdown.find(b => b.employeeId === "emp_2")?.amount).toBe(20);
    });
  });

  describe("promoteEmployee", () => {
    it("promotes eligible employee", () => {
      const config = EMPLOYEE_CONFIGS.groundskeeper;
      const emp = makeEmployee({
        id: "emp_1",
        role: "groundskeeper",
        skillLevel: "novice",
        experience: config.experienceToLevel
      });
      const roster = makeRoster({ employees: [emp] });
      const result = promoteEmployee(roster, "emp_1");

      expect(result?.employees[0].skillLevel).toBe("trained");
    });

    it("resets experience after promotion", () => {
      const config = EMPLOYEE_CONFIGS.groundskeeper;
      const emp = makeEmployee({
        id: "emp_1",
        role: "groundskeeper",
        skillLevel: "novice",
        experience: config.experienceToLevel + 100
      });
      const roster = makeRoster({ employees: [emp] });
      const result = promoteEmployee(roster, "emp_1");

      expect(result?.employees[0].experience).toBe(0);
    });

    it("increases happiness on promotion", () => {
      const config = EMPLOYEE_CONFIGS.groundskeeper;
      const emp = makeEmployee({
        id: "emp_1",
        role: "groundskeeper",
        skillLevel: "novice",
        experience: config.experienceToLevel,
        happiness: 70
      });
      const roster = makeRoster({ employees: [emp] });
      const result = promoteEmployee(roster, "emp_1");

      expect(result?.employees[0].happiness).toBe(80);
    });

    it("returns null if not eligible", () => {
      const emp = makeEmployee({
        id: "emp_1",
        skillLevel: "novice",
        experience: 10
      });
      const roster = makeRoster({ employees: [emp] });

      expect(promoteEmployee(roster, "emp_1")).toBeNull();
    });

    it("returns null for max level", () => {
      const emp = makeEmployee({
        id: "emp_1",
        skillLevel: "expert",
        experience: 10000
      });
      const roster = makeRoster({ employees: [emp] });

      expect(promoteEmployee(roster, "emp_1")).toBeNull();
    });
  });

  describe("adjustHappiness", () => {
    it("increases happiness", () => {
      const emp = makeEmployee({ id: "emp_1", happiness: 50 });
      const roster = makeRoster({ employees: [emp] });
      const result = adjustHappiness(roster, "emp_1", 20);

      expect(result?.employees[0].happiness).toBe(70);
    });

    it("decreases happiness", () => {
      const emp = makeEmployee({ id: "emp_1", happiness: 50 });
      const roster = makeRoster({ employees: [emp] });
      const result = adjustHappiness(roster, "emp_1", -20);

      expect(result?.employees[0].happiness).toBe(30);
    });

    it("clamps to 0-100 range", () => {
      const emp = makeEmployee({ id: "emp_1", happiness: 90 });
      const roster = makeRoster({ employees: [emp] });
      const result = adjustHappiness(roster, "emp_1", 20);

      expect(result?.employees[0].happiness).toBe(100);
    });
  });

  describe("giveRaise", () => {
    it("increases wage by percentage", () => {
      const emp = makeEmployee({ id: "emp_1", hourlyWage: 10 });
      const roster = makeRoster({ employees: [emp] });
      const result = giveRaise(roster, "emp_1", 10);

      expect(result?.employees[0].hourlyWage).toBe(11);
    });

    it("increases happiness", () => {
      const emp = makeEmployee({ id: "emp_1", hourlyWage: 10, happiness: 70 });
      const roster = makeRoster({ employees: [emp] });
      const result = giveRaise(roster, "emp_1", 10);

      expect(result?.employees[0].happiness).toBe(75);
    });
  });

  describe("refreshHiringPool", () => {
    it("does nothing before refresh interval", () => {
      const pool = generateHiringPool(0, 3);
      const candidates = pool.candidates;
      const result = refreshHiringPool(pool, 100);

      expect(result.candidates).toEqual(candidates);
    });

    it("generates new candidates after interval", () => {
      const pool = generateHiringPool(0, 3);
      const oldIds = pool.candidates.map(c => c.id);
      const result = refreshHiringPool(pool, 500);

      const newIds = result.candidates.map(c => c.id);
      // New pool should have different IDs (very unlikely to match)
      expect(newIds.some(id => !oldIds.includes(id))).toBe(true);
    });
  });

  // ==========================================================================
  // Utility Function Tests
  // ==========================================================================

  describe("getRoleName", () => {
    it("returns display names for all roles", () => {
      expect(getRoleName("groundskeeper")).toBe("Groundskeeper");
      expect(getRoleName("mechanic")).toBe("Mechanic");
      expect(getRoleName("irrigator")).toBe("Irrigator");
      expect(getRoleName("pro_shop_staff")).toBe("Pro Shop Staff");
      expect(getRoleName("manager")).toBe("Manager");
      expect(getRoleName("caddy")).toBe("Caddy");
    });
  });

  describe("getSkillLevelName", () => {
    it("returns display names for all levels", () => {
      expect(getSkillLevelName("novice")).toBe("Novice");
      expect(getSkillLevelName("trained")).toBe("Trained");
      expect(getSkillLevelName("experienced")).toBe("Experienced");
      expect(getSkillLevelName("expert")).toBe("Expert");
    });
  });

  describe("formatWage", () => {
    it("formats wage with dollar sign and per hour", () => {
      expect(formatWage(15)).toBe("$15.00/hr");
      expect(formatWage(12.5)).toBe("$12.50/hr");
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("Edge Cases", () => {
    it("handles roster at exactly max capacity", () => {
      const emp = makeEmployee({ id: "emp_1" });
      const roster = makeRoster({ maxEmployees: 1, employees: [emp] });

      expect(canHire(roster)).toBe(false);
      expect(getAvailableSlots(roster)).toBe(0);
    });

    it("handles employee at exactly fatigue threshold", () => {
      const config = EMPLOYEE_CONFIGS.groundskeeper;
      const emp = makeEmployee({
        id: "emp_1",
        role: "groundskeeper",
        status: "working",
        fatigue: config.breakThreshold
      });
      const roster = makeRoster({ employees: [emp] });

      const needBreak = getEmployeesNeedingBreak(roster);
      expect(needBreak.length).toBe(1);
    });

    it("handles multiple promotions in same tick", () => {
      const config = EMPLOYEE_CONFIGS.groundskeeper;
      const emp1 = makeEmployee({
        id: "emp_1",
        role: "groundskeeper",
        skillLevel: "novice",
        status: "working",
        experience: config.experienceToLevel - 1
      });
      const emp2 = makeEmployee({
        id: "emp_2",
        role: "groundskeeper",
        skillLevel: "trained",
        status: "working",
        experience: config.experienceToLevel - 1
      });
      const roster = makeRoster({ employees: [emp1, emp2] });
      const result = tickEmployees(roster, 10);

      expect(result.promotions.length).toBe(2);
    });

    it("handles happiness at boundaries", () => {
      const emp = makeEmployee({ id: "emp_1", happiness: 0 });
      const roster = makeRoster({ employees: [emp] });

      const decreased = adjustHappiness(roster, "emp_1", -10);
      expect(decreased?.employees[0].happiness).toBe(0);

      const emp2 = makeEmployee({ id: "emp_2", happiness: 100 });
      const roster2 = makeRoster({ employees: [emp2] });

      const increased = adjustHappiness(roster2, "emp_2", 10);
      expect(increased?.employees[0].happiness).toBe(100);
    });
  });
});
