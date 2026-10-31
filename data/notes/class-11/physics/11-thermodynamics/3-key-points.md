---
title: "Thermodynamics: Important Points and Traps"
type: key_points
chapter: c11.physics.thermodynamics
order: 3
---

## Signs and the first law

:::trap
**Two sign conventions.** Physics (NCERT Physics): $\Delta Q = \Delta U + \Delta W$, with $\Delta W$ = work done **by** the gas. Chemistry (NCERT Chemistry): $\Delta U = q + w$, with $w$ = work done **on** the gas. "500 J of work done on the gas" means $\Delta W = -500$ J in Physics but $w = +500$ J in Chemistry.
:::

- Heat **given out** by the gas: $\Delta Q$ is negative. Gas **compressed**: $\Delta W$ is negative.
- $\Delta U$ is a state function: going from A to B by any path gives the same $\Delta U$. $Q$ and $W$ change with the path.
- For an ideal gas, $\Delta U = \mu C_v \Delta T$ in **every** process. Students wrongly use $C_p$ for $\Delta U$ in isobaric problems.

:::trap
Temperature in kelvin, always. $\Delta T$ is the same in °C and K, but $T$ itself in $PV = \mu RT$, in $\ln$ formulas and in Carnot efficiency must be in **kelvin**.
:::

## Heat capacities

- $C_p > C_v$ for a gas, because at constant pressure part of the heat does work.
- For solids and liquids, $C_p$ and $C_v$ are nearly equal (very little expansion).
- $C_p - C_v = R$ is for **molar** specific heats. For specific heats per kg, $c_p - c_v = R/M$.

:::remember
Fraction of heat that goes into each part at **constant pressure** (ideal gas):
- into $\Delta U$: $\dfrac{C_v}{C_p} = \dfrac{1}{\gamma}$
- into work: $1 - \dfrac{1}{\gamma}$

Monatomic: $\tfrac35$ and $\tfrac25$. Diatomic: $\tfrac57$ and $\tfrac27$.
:::

- Molar heat capacity of a gas can take any value, depending on the process: zero for adiabatic, infinite for isothermal ($\Delta T = 0$ while $Q \ne 0$), and even negative for some processes (exam extra).

## Processes

:::trap
**Adiabatic is not the same as isothermal.** In an adiabatic process the temperature **changes** (no heat flows). In an isothermal process heat **does** flow (temperature stays fixed). "No heat" and "no temperature change" are different things.
:::

- Isothermal process: $\Delta U = 0$ for an ideal gas only. When water boils at constant temperature, $\Delta U \ne 0$ (energy goes into changing the phase).
- Adiabatic expansion **cools** a gas. This is why air cools as it rises and expands. A bicycle pump gets warm because of (nearly) adiabatic compression.
- A fast process is nearly adiabatic, since heat has no time to flow. A slow process in a conducting container is nearly isothermal.
- $PV^\gamma$ = constant holds only for a **quasi-static** adiabatic process of an ideal gas. It does not apply to sudden free expansion.

:::trap
**Free expansion** (a gas rushing into a vacuum in an insulated box): $\Delta Q = 0$ and $\Delta W = 0$ (no piston is pushed), so $\Delta U = 0$. For an ideal gas the temperature does not change. It is **not** quasi-static, so $PV^\gamma$ = constant does **not** apply, and it is irreversible.
:::

:::tip
**Area rules on a P–V graph** ($P$ up, $V$ across):
- Work = area **under** the curve, down to the $V$-axis.
- Cycle: net work = area **inside** the loop. Clockwise loop: work done by the gas is positive (engine). Anticlockwise: negative (refrigerator).
:::

- Vertical line on a P–V graph (isochoric): zero work. Horizontal line (isobaric): work $= P\Delta V$.
- From the same starting point and expanding to the same final volume: $W_{\text{isobaric}} > W_{\text{isothermal}} > W_{\text{adiabatic}}$.
- In isothermal expansion the gas absorbs heat and $\Delta U = 0$, so $Q = W > 0$.

## Second law, reversibility and Carnot

:::trap
Carnot efficiency $1 - \dfrac{T_2}{T_1}$ is the **upper limit**. A real engine between the same temperatures always has a **lower** efficiency. An engine claiming more than the Carnot value is impossible.
:::

- Efficiency of 100% would need $T_2 = 0$ K, which cannot be reached. So every heat engine rejects some heat ($Q_2 \ne 0$), as the Kelvin–Planck statement says.
- Carnot efficiency depends **only** on the two reservoir temperatures, not on the working substance.
- Lowering the sink temperature $T_2$ by some amount raises $\eta$ more than raising the source temperature $T_1$ by the same amount.
- Heat flowing from a hot to a cold body by itself is **irreversible**. So is friction, and so is free expansion.

:::remember
- A reversible process must be **quasi-static** and have **no dissipation** (friction, viscosity).
- A quasi-static process with friction is still irreversible.
:::

## NCERT lines to know

:::remember
- Zeroth law: two systems in thermal equilibrium with a third system separately are in thermal equilibrium with each other.
- Heat and work are not state variables. They are modes of energy transfer to a system that change its internal energy, which is a state variable.
- The first law is the law of conservation of energy applied to a system that exchanges heat and work with its surroundings.
- Internal energy is an **extensive** variable; temperature and pressure are **intensive**.
:::

:::tip
**Carnot cycle order: "Iso-Adi-Iso-Adi" (I-A-I-A)**: isothermal expansion, adiabatic expansion, isothermal compression, adiabatic compression. Both expansions come first, and heat is taken in only during the first step.
:::
