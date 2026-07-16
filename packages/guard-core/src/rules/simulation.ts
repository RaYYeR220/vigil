import type { RuleFailure, SimulationResult } from "../types.js";
export function checkSimulation(sim: SimulationResult): RuleFailure | null {
  if (!sim.ok) return { rule: "simulation", reason: sim.revertReason ?? "simulation failed" };
  return null;
}
