// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors
// TEMP workflow-loop probe fixture — command injection for the semgrep gate.
// This branch is a throwaway; it never merges to main.
/* eslint-disable */
import { exec } from "child_process"
export function runCmd(userInput: string): void {
  exec("ls -la " + userInput, (err, stdout) => {
    console.log(stdout)
  })
}
