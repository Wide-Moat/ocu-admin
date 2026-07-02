// SPDX-License-Identifier: FSL-1.1-Apache-2.0
// Copyright (c) 2025 Open Computer Use Contributors

// Where the console dials the control operator plane. The plane is a Unix-domain
// socket (ADR-0004); the console is a second client of the same fleet convention
// the control CLI uses, /run/ocu-control/operator.sock. Unlike the auth secrets
// in auth/config.ts, this path has a safe default — a stock deployment needs no
// extra env — and an operator overrides it with OCU_ADMIN_CONTROL_SOCKET only
// when the socket lives elsewhere.
//
// Deployment note (not a code dependency): control accepts any peer the kernel
// attests (SO_PEERCRED, accept-any-uid mapper). The real gate is OS-level — the
// socket sits in a 0700 directory, so the console's Node server must run as that
// directory's owner uid to connect at all. There is nothing to place in a header
// or token; identity is the connecting process's kernel-attested uid.

export const DEFAULT_CONTROL_SOCKET = "/run/ocu-control/operator.sock"

export type ControlConfig = {
  socketPath: string
}

type Env = Record<string, string | undefined>

export function loadControlConfig(env: Env = process.env): ControlConfig {
  const override = env.OCU_ADMIN_CONTROL_SOCKET
  const socketPath =
    override && override.length > 0 ? override : DEFAULT_CONTROL_SOCKET
  return { socketPath }
}
