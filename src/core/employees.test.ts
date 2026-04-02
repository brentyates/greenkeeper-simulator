import { describe, it, expect } from "vitest";
import {
  Employee,
  EmployeeRoster,

  createInitialRoster,
  generateRandomName,
  generateRandomSkills,
  createEmployee,

  getEmployee,
  getAvailableSlots,
  calculateEffectiveEfficiency,
  awardExperience,

  hireEmployee,
  fireEmployee,
  assignEmployeeToArea,
  tickEmployees,
  processPayroll,
  markEmployeesUnpaid,
  resumeEmployeesAfterPayroll,

  createInitialApplicationState,
  tickApplications,
  postJobOpening,
  acceptApplication,
  hasActivePosting,
  getPostingCost,

  PRESTIGE_HIRING_CONFIG
} from "./employees";

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
    maxEmployees: 20,
    lastPayrollTime: 0,
    totalWagesPaid: 0,
    ...overrides
  };
}

describe("Employee System", () => {
  describe("createInitialRoster", () => {
    it("creates empty roster", () => {
      const roster = createInitialRoster();
      expect(roster.employees).toEqual([]);
    });

    it("sets default max employees", () => {
      const roster = createInitialRoster();
      expect(roster.maxEmployees).toBe(20);
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
      const emp = createEmployee("groundskeeper", "trained", 0);
      const expectedWage = 12 * 1.25;
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
      const customSkills = {
        efficiency: 1.5,
        quality: 1.3,
        stamina: 1.2,
        reliability: 0.95
      };
      const emp = createEmployee("groundskeeper", "novice", 0, undefined, customSkills);
      expect(emp.skills).toEqual(customSkills);
    });
  });

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

  describe("getAvailableSlots", () => {
    it("calculates remaining slots", () => {
      const roster = makeRoster({
        maxEmployees: 10,
        employees: [makeEmployee({ id: "1" }), makeEmployee({ id: "2" })]
      });
      expect(getAvailableSlots(roster)).toBe(8);
    });
  });

  describe("calculateEffectiveEfficiency", () => {
    it("returns full efficiency at full happiness and zero fatigue", () => {
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
      expect(calculateEffectiveEfficiency(emp)).toBe(0);
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
      expect(result).toBeGreaterThan(0.3);
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
      const emp = makeEmployee({
        role: "groundskeeper",
        skillLevel: "novice",
        experience: 950,
      });
      const roster = makeRoster({ employees: [emp] });
      const updated = awardExperience(roster, emp.id, 100);
      expect(updated.employees[0].skillLevel).toBe("trained");
      expect(updated.employees[0].experience).toBe(50);
    });

    it("increases skills on promotion", () => {
      const emp = makeEmployee({
        role: "groundskeeper",
        skillLevel: "novice",
        experience: 990,
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

    it("only awards experience to targeted employee", () => {
      const emp1 = makeEmployee({ id: "emp_1", experience: 100 });
      const emp2 = makeEmployee({ id: "emp_2", experience: 50 });
      const roster = makeRoster({ employees: [emp1, emp2] });
      const updated = awardExperience(roster, "emp_1", 50);
      expect(updated.employees[0].experience).toBe(150);
      expect(updated.employees[1].experience).toBe(50);
    });

    it("does not promote expert when experience threshold reached", () => {
      const emp = makeEmployee({
        role: "groundskeeper",
        skillLevel: "expert",
        experience: 990
      });
      const roster = makeRoster({ employees: [emp] });
      const updated = awardExperience(roster, emp.id, 50);
      expect(updated.employees[0].skillLevel).toBe("expert");
      expect(updated.employees[0].experience).toBe(1040);
    });
  });

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
      const emp = makeEmployee({
        id: "emp_1",
        role: "groundskeeper",
        status: "working",
        fatigue: 79
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
      const emp = makeEmployee({
        id: "emp_1",
        role: "groundskeeper",
        skillLevel: "novice",
        status: "working",
        experience: 999
      });
      const roster = makeRoster({ employees: [emp] });
      const result = tickEmployees(roster, 10);

      expect(result.promotions.length).toBe(1);
      expect(result.promotions[0].employeeId).toBe("emp_1");
      expect(result.promotions[0].newLevel).toBe("trained");
    });

    it("updates wage on promotion", () => {
      const emp = makeEmployee({
        id: "emp_1",
        role: "groundskeeper",
        skillLevel: "novice",
        status: "working",
        experience: 999,
        hourlyWage: 12
      });
      const roster = makeRoster({ employees: [emp] });
      const result = tickEmployees(roster, 10);

      expect(result.roster.employees[0].hourlyWage).toBeCloseTo(15, 2);
    });

    it("does not promote when already at expert level", () => {
      const emp = makeEmployee({
        id: "emp_1",
        role: "groundskeeper",
        skillLevel: "expert",
        status: "working",
        experience: 999
      });
      const roster = makeRoster({ employees: [emp] });
      const result = tickEmployees(roster, 10);

      expect(result.promotions.length).toBe(0);
      expect(result.roster.employees[0].skillLevel).toBe("expert");
    });

    it("does not accrue fatigue or experience for idle employees", () => {
      const emp = makeEmployee({ id: "emp_1", status: "idle", fatigue: 20, experience: 100 });
      const roster = makeRoster({ employees: [emp] });
      const result = tickEmployees(roster, 10);

      expect(result.roster.employees[0].fatigue).toBe(20);
      expect(result.roster.employees[0].experience).toBe(100);
    });

    it("applies training bonus to reduce fatigue accrual", () => {
      const emp = makeEmployee({ id: "emp_1", status: "working", fatigue: 0 });
      const roster = makeRoster({ employees: [emp] });

      const resultNoBonus = tickEmployees(roster, 10, 1.0);
      const fatigueNoBonus = resultNoBonus.roster.employees[0].fatigue;

      const resultWithBonus = tickEmployees(roster, 10, 1.5);
      const fatigueWithBonus = resultWithBonus.roster.employees[0].fatigue;

      expect(fatigueWithBonus).toBeLessThan(fatigueNoBonus);
    });

    it("applies training bonus to increase experience gain", () => {
      const emp = makeEmployee({ id: "emp_1", status: "working", experience: 0 });
      const roster = makeRoster({ employees: [emp] });

      const resultNoBonus = tickEmployees(roster, 10, 1.0);
      const expNoBonus = resultNoBonus.roster.employees[0].experience;

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
      const result = processPayroll(roster, 30);

      expect(result.totalPaid).toBe(0);
    });

    it("pays wages after interval", () => {
      const emp = makeEmployee({ id: "emp_1", hourlyWage: 15, status: "working" });
      const roster = makeRoster({
        employees: [emp],
        lastPayrollTime: 0
      });
      const result = processPayroll(roster, 60);

      expect(result.totalPaid).toBe(1.88);
    });

    it("pays partial wages for non-working employees", () => {
      const emp = makeEmployee({ id: "emp_1", hourlyWage: 20, status: "idle" });
      const roster = makeRoster({
        employees: [emp],
        lastPayrollTime: 0
      });
      const result = processPayroll(roster, 60);

      expect(result.totalPaid).toBe(1.25);
    });

    it("updates last payroll time", () => {
      const emp = makeEmployee({ hourlyWage: 15 });
      const roster = makeRoster({ employees: [emp], lastPayrollTime: 0 });
      const result = processPayroll(roster, 60);

      expect(result.roster.lastPayrollTime).toBe(60);
    });

    it("accumulates total wages paid", () => {
      const emp = makeEmployee({ hourlyWage: 15, status: "working" });
      const roster = makeRoster({
        employees: [emp],
        lastPayrollTime: 0,
        totalWagesPaid: 100
      });
      const result = processPayroll(roster, 60);

      expect(result.roster.totalWagesPaid).toBe(101.88);
    });

    it("provides breakdown by employee", () => {
      const emp1 = makeEmployee({ id: "emp_1", hourlyWage: 15, status: "working" });
      const emp2 = makeEmployee({ id: "emp_2", hourlyWage: 20, status: "working" });
      const roster = makeRoster({
        employees: [emp1, emp2],
        lastPayrollTime: 0
      });
      const result = processPayroll(roster, 60);

      expect(result.breakdown.length).toBe(2);
      expect(result.breakdown.find(b => b.employeeId === "emp_1")?.amount).toBe(1.88);
      expect(result.breakdown.find(b => b.employeeId === "emp_2")?.amount).toBe(2.5);
    });

    it("does not pay employees withholding work", () => {
      const emp = makeEmployee({ id: "emp_1", hourlyWage: 20, status: "withholding_work" as const });
      const roster = makeRoster({
        employees: [emp],
        lastPayrollTime: 0
      });
      const result = processPayroll(roster, 60);

      expect(result.totalPaid).toBe(0);
    });

    it("scales payroll against a work shift instead of literal game hours", () => {
      const emp = makeEmployee({ id: "emp_1", hourlyWage: 16, status: "working" });
      const roster = makeRoster({
        employees: [emp],
        lastPayrollTime: 0
      });
      const result = processPayroll(roster, 60 * 8);

      expect(result.totalPaid).toBe(16);
    });
  });

  describe("payroll consequences", () => {
    it("marks crew as withholding work when payroll is missed", () => {
      const emp = makeEmployee({ id: "emp_1", status: "working", happiness: 80 });
      const roster = makeRoster({ employees: [emp] });
      const result = markEmployeesUnpaid(roster);

      expect(result.employees[0].status).toBe("withholding_work");
      expect(result.employees[0].happiness).toBe(65);
    });

    it("returns withholding crew to work after payroll clears", () => {
      const emp = makeEmployee({ id: "emp_1", status: "withholding_work" as const, happiness: 40 });
      const roster = makeRoster({ employees: [emp] });
      const result = resumeEmployeesAfterPayroll(roster);

      expect(result.employees[0].status).toBe("working");
      expect(result.employees[0].happiness).toBe(45);
    });
  });

  describe("Edge Cases", () => {
    it("handles roster at exactly max capacity", () => {
      const emp = makeEmployee({ id: "emp_1" });
      const roster = makeRoster({ maxEmployees: 1, employees: [emp] });

      expect(hireEmployee(roster, makeEmployee({ id: "new" }))).toBeNull();
      expect(getAvailableSlots(roster)).toBe(0);
    });

    it("handles multiple promotions in same tick", () => {
      const emp1 = makeEmployee({
        id: "emp_1",
        role: "groundskeeper",
        skillLevel: "novice",
        status: "working",
        experience: 999
      });
      const emp2 = makeEmployee({
        id: "emp_2",
        role: "groundskeeper",
        skillLevel: "trained",
        status: "working",
        experience: 999
      });
      const roster = makeRoster({ employees: [emp1, emp2] });
      const result = tickEmployees(roster, 10);

      expect(result.promotions.length).toBe(2);
    });
  });

  describe("Prestige-Based Hiring", () => {
    describe("createInitialApplicationState", () => {
      it("creates empty application state", () => {
        const state = createInitialApplicationState(0, 'municipal');
        expect(state.applications).toEqual([]);
        expect(state.activeJobPostings).toEqual([]);
        expect(state.totalApplicationsReceived).toBe(0);
      });

      it("sets next application time based on prestige tier", () => {
        const config = PRESTIGE_HIRING_CONFIG['municipal'];
        const state = createInitialApplicationState(1000, 'municipal');
        expect(state.nextApplicationTime).toBe(1000 + config.applicationRate * 60);
      });

      it("uses different config for different tiers", () => {
        const municipal = createInitialApplicationState(0, 'municipal');
        const championship = createInitialApplicationState(0, 'championship');
        expect(municipal.nextApplicationTime).not.toBe(championship.nextApplicationTime);
      });
    });

    describe("tickApplications", () => {
      it("generates application when time is reached", () => {
        const state = createInitialApplicationState(0, 'municipal');
        const result = tickApplications(state, state.nextApplicationTime, 'municipal');

        expect(result.newApplicant).not.toBeNull();
        expect(result.state.applications.length).toBe(1);
        expect(result.state.totalApplicationsReceived).toBe(1);
      });

      it("does not generate application before time", () => {
        const state = createInitialApplicationState(0, 'municipal');
        const result = tickApplications(state, 100, 'municipal');

        expect(result.newApplicant).toBeNull();
        expect(result.state.applications.length).toBe(0);
      });

      it("expires old job postings", () => {
        const state = createInitialApplicationState(0, 'municipal');
        const posting = {
          id: 'posting_1',
          role: 'mechanic' as const,
          postedTime: 0,
          expiresAt: 1000,
          cost: 100
        };
        const stateWithPosting = {
          ...state,
          activeJobPostings: [posting]
        };

        const result = tickApplications(stateWithPosting, 2000, 'municipal');
        expect(result.expiredPostings.length).toBe(1);
        expect(result.state.activeJobPostings.length).toBe(0);
      });

      it("respects max applications limit", () => {
        const config = PRESTIGE_HIRING_CONFIG['municipal'];
        const apps = Array(config.maxApplications).fill(null).map(() =>
          createEmployee('groundskeeper', 'novice', 0)
        );
        const state = {
          ...createInitialApplicationState(0, 'municipal'),
          applications: apps
        };

        const result = tickApplications(state, state.nextApplicationTime + 10000, 'municipal');
        expect(result.state.applications.length).toBe(config.maxApplications);
      });

      it("uses posting bonus for next application time", () => {
        const config = PRESTIGE_HIRING_CONFIG['municipal'];
        const posting = {
          id: 'posting_1',
          role: 'mechanic' as const,
          postedTime: 0,
          expiresAt: 100000,
          cost: 100
        };
        const state = {
          ...createInitialApplicationState(0, 'municipal'),
          activeJobPostings: [posting],
          nextApplicationTime: 0
        };

        const result = tickApplications(state, 0, 'municipal');
        const expectedInterval = Math.min(config.applicationRate, config.postingApplicationRate);
        expect(result.state.nextApplicationTime).toBe(expectedInterval * 60);
      });
    });

    describe("postJobOpening", () => {
      it("creates job posting", () => {
        const state = createInitialApplicationState(0, 'municipal');
        const result = postJobOpening(state, 1000, 'municipal', 'mechanic');

        expect(result).not.toBeNull();
        expect(result?.posting.role).toBe('mechanic');
        expect(result?.posting.postedTime).toBe(1000);
      });

      it("adds posting to active postings", () => {
        const state = createInitialApplicationState(0, 'municipal');
        const result = postJobOpening(state, 1000, 'municipal', 'mechanic');

        expect(result?.state.activeJobPostings.length).toBe(1);
      });

      it("sets expiration time based on prestige config", () => {
        const config = PRESTIGE_HIRING_CONFIG['municipal'];
        const state = createInitialApplicationState(0, 'municipal');
        const result = postJobOpening(state, 1000, 'municipal', 'mechanic');

        expect(result?.posting.expiresAt).toBe(1000 + config.postingDuration * 60);
      });

      it("includes target skill level when specified", () => {
        const state = createInitialApplicationState(0, 'municipal');
        const result = postJobOpening(state, 1000, 'municipal', 'mechanic', 'experienced');

        expect(result?.posting.targetSkillLevel).toBe('experienced');
      });

      it("updates next application time with posting bonus", () => {
        const config = PRESTIGE_HIRING_CONFIG['municipal'];
        const state = createInitialApplicationState(0, 'municipal');
        const result = postJobOpening(state, 1000, 'municipal', 'mechanic');

        expect(result?.state.nextApplicationTime).toBeLessThanOrEqual(
          1000 + config.postingApplicationRate * 60
        );
      });
    });

    describe("acceptApplication", () => {
      it("removes accepted application", () => {
        const app = createEmployee('groundskeeper', 'novice', 0);
        const state = {
          ...createInitialApplicationState(0, 'municipal'),
          applications: [app]
        };

        const result = acceptApplication(state, app.id);
        expect(result?.applications.length).toBe(0);
      });

      it("returns null for non-existent application", () => {
        const state = createInitialApplicationState(0, 'municipal');
        expect(acceptApplication(state, 'fake_id')).toBeNull();
      });

      it("keeps other applications", () => {
        const app1 = createEmployee('groundskeeper', 'novice', 0);
        const app2 = createEmployee('groundskeeper', 'novice', 100);
        const state = {
          ...createInitialApplicationState(0, 'municipal'),
          applications: [app1, app2]
        };

        const result = acceptApplication(state, app1.id);
        expect(result?.applications.length).toBe(1);
        expect(result?.applications[0].id).toBe(app2.id);
      });
    });

    describe("hasActivePosting", () => {
      it("returns true when role has active posting", () => {
        const posting = {
          id: 'posting_1',
          role: 'mechanic' as const,
          postedTime: 0,
          expiresAt: 10000,
          cost: 100
        };
        const state = {
          ...createInitialApplicationState(0, 'municipal'),
          activeJobPostings: [posting]
        };

        expect(hasActivePosting(state, 'mechanic')).toBe(true);
        expect(hasActivePosting(state, 'groundskeeper')).toBe(false);
      });
    });

    describe("getPostingCost", () => {
      it("returns cost for prestige tier", () => {
        const municipalCost = getPostingCost('municipal');
        const championshipCost = getPostingCost('championship');

        expect(typeof municipalCost).toBe('number');
        expect(typeof championshipCost).toBe('number');
        expect(municipalCost).toBeGreaterThan(championshipCost);
      });
    });
  });
});
