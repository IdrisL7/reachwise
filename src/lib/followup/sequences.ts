export type SequenceConfig = {
  id: string;
  maxSteps: number;
  delaysDays: number[];
  stopOnReply: boolean;
  stopOnBounce: boolean;
};

export const SEQUENCES: Record<string, SequenceConfig> = {
  "default-b2b-sequence": {
    id: "default-b2b-sequence",
    maxSteps: 3,
    delaysDays: [3, 5, 7],
    stopOnReply: true,
    stopOnBounce: true,
  },
};

export function getSequence(sequenceId: string): SequenceConfig | null {
  return SEQUENCES[sequenceId] ?? null;
}

export function getDelayForStep(sequence: SequenceConfig, step: number): number {
  if (step < 0 || step >= sequence.delaysDays.length) {
    return sequence.delaysDays[sequence.delaysDays.length - 1] ?? 7;
  }
  return sequence.delaysDays[step];
}

export function mapStepToSequenceType(
  step: number,
  maxSteps: number,
): "first" | "bump" | "breakup" {
  if (step === 0) return "first";
  if (step >= maxSteps - 1) return "breakup";
  return "bump";
}
