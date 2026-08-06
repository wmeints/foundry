import { Effect } from "effect";

/**
 * Sample workflow effect.
 * Replace this with your actual workflow logic.
 */
const myEffect = Effect.log("Hello from the implementation workflow!");

export const workflow = {
  effect: myEffect,
  schedule: 60, // Run every 60 seconds
};
