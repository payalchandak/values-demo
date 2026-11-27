export type Value = 'A' | 'B' | 'N' | 'J';
export type Tag = -1 | 0 | 1; // violates, neutral, promotes
export interface StudyCase {
  id: string;
  vignette: string;
  choices: [string, string];
  tags: [Record<Value, Tag>, Record<Value, Tag>];
  physicianVotesChoice1: number; // out of 25
  modelChoice1Counts: Record<string, number>; // profile key -> count out of 10
}
export type Delta = Record<Value, -2 | -1 | 0 | 1 | 2>; // tags[0] minus tags[1]
export interface Profile {
  key: string;
  kind: 'model' | 'physician' | 'pooled-physician';
  family?: 'openai' | 'anthropic' | 'google' | 'other';
  displayName: string;   // no version numbers, e.g. "GPT"
  sourceVersion?: string; // e.g. "openai/gpt-5.2", never shown in the main animation
  weights: Record<Value, number>;    // raw regression coefficients
  priorities: Record<Value, number>; // softmax(weights / 0.262)
}
