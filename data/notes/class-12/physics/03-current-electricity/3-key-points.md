---
title: "Current Electricity: Important Points and Traps"
type: key_points
chapter: c12.physics.current-electricity
order: 3
---

## Current and drift

- Current is a **scalar**, even though we draw it with an arrow. Current density $\vec j$ is a vector.
- Electrons drift **opposite** to $\vec E$, from lower to higher potential. Conventional current points along $\vec E$.
- Drift is **superposed** on fast random motion. The free electrons are not all moving the same way.
- Between collisions the path is a straight line with no field, and in general **curved** with a field.

:::trap
In a wire of **non-uniform** cross-section carrying a steady current, $I$ is the **same** at every section. But $j = I/A$ and $v_d = I/(neA)$ are **larger where the wire is thinner**. The field $E = \rho j$ is also larger there.
:::

:::trap
$v_d$ does **not** depend on the length of the wire alone. For a fixed **voltage** $V$ across a wire of length $l$, $E = V/l$, so $v_d = e\tau V/(ml)$: doubling the length halves $v_d$. For a fixed **current**, $v_d = I/(neA)$ does not change with length.
:::

- Doubling the potential difference across a given wire doubles $E$, so it doubles $v_d$ (and the current).
- Mobility depends on $\tau$ and on the carrier's charge and mass, not on the field (as long as Ohm's law holds).

## Resistance and resistivity

:::remember
- Resistance depends on **size, shape, material and temperature**.
- Resistivity depends only on the **material and temperature** (and pressure), not on size or shape.
- Cutting a wire in half halves $R$ but does **not** change $\rho$.
:::

:::trap
**Stretched wire (same volume):** stretching to $n$ times the length makes $R$ become $n^2$ times, not $n$ times, because the area also falls to $1/n$. In terms of radius: if the radius becomes $1/n$ times, the length becomes $n^2$ times and $R$ becomes $n^4$ times.
:::

- Folding a wire of resistance $R$ into two equal halves side by side gives $R/4$ (half the length, double the area).
- Units: resistivity in **Ω m** (not Ω/m); conductivity in S/m; mobility in m²/(V s).

## Ohm's law

:::trap
"$V = IR$" is **not** Ohm's law by itself; it defines $R$ for any device. Ohm's law says $R$ stays **constant**: the $I$–$V$ graph is a straight line through the origin.
:::

- For an ohmic conductor, the **slope** of an $I$–$V$ graph is $1/R$ and of a $V$–$I$ graph is $R$. Read the axes first. For a non-ohmic device, $R = V/I$ at a point, not the slope.
- Non-ohmic examples from NCERT: a **diode** (depends on the sign of $V$) and **GaAs** (more than one $V$ for the same $I$).
- Even good conductors depart from Ohm's law if the field is too strong.

## Temperature

:::remember
- Metals: $\rho$ **rises** with temperature ($\alpha > 0$) because $\tau$ falls; $n$ hardly changes.
- Semiconductors and insulators: $\rho$ **falls** with temperature because $n$ rises fast.
- Nichrome, manganin, constantan: $\rho$ changes very little, so they make standard resistors.
:::

:::trap
$R_T = R_0[1 + \alpha(T - T_0)]$ is only for a **limited** range. Do not use it to find, say, the temperature at which $R$ doubles over a very large range unless the question tells you to. Also, $T - T_0$ is the same in °C and K, so $\alpha$ in °C⁻¹ equals $\alpha$ in K⁻¹.
:::

- A heater draws a slightly **larger** current at switch-on, because its cold resistance is lower (NCERT Example 3.3).

## Power

:::trap
Choose the power formula by what is **the same**:
- In **series** (same $I$), use $P = I^2R$: the **larger** $R$ gets more power.
- In **parallel** (same $V$), use $P = V^2/R$: the **smaller** $R$ gets more power.
:::

:::tip
A bulb rated $P_0$ at $V_0$ has $R = V_0^2/P_0$. On another voltage $V$ (with $R$ unchanged), $P = P_0 (V/V_0)^2$. Half the voltage gives a quarter of the power.
:::

- Transmission loss is proportional to $1/V^2$ for a fixed power delivered. High voltage cuts the loss; transformers bring the voltage down for use.

## Cells

:::trap
Terminal voltage is **less** than emf while the cell gives current ($\varepsilon - Ir$), but **more** than emf while it is being **charged** ($\varepsilon + Ir$). It equals the emf only when no current flows.
:::

:::trap
A cell connected the **wrong way** in a series string: subtract its emf, but still **add** its internal resistance. Internal resistances never cancel.
:::

- In a short circuit ($R = 0$), the terminal voltage is zero and $I = \varepsilon/r$.
- (Beyond the syllabus, but often used) For a given cell, the load gets the most power when $R = r$; then $P = \varepsilon^2/4r$ and only half the cell's power reaches the load.
- (From NCERT Chapter 4, Moving Charges and Magnetism) An ideal voltmeter has infinite resistance and an ideal ammeter has zero resistance. An **ideal** voltmeter across a cell reads its emf; a real one draws a little current, so it reads slightly less.

## Kirchhoff's rules and bridges

:::remember
- Junction rule: **conservation of charge**.
- Loop rule: potential has one value at each point (**conservation of energy**).
- NCERT: bending or reorienting a wire does not change the junction rule.
:::

:::trap
Keep one sign rule for the whole loop. Going **along** your current arrow through a resistor: $-IR$. A negative answer for a current only means it flows **opposite** to your arrow; do not change the arrow halfway through the working.
:::

:::tip
**Balanced bridge shortcut:** if the four arms satisfy the balance condition, the products of **opposite arms** are equal ($R_{AB} \times R_{CD} = R_{BC} \times R_{DA}$). Then no current flows in BD, and any resistor in BD can be **removed** while you find the equivalent resistance.
:::

- The balance condition does **not** depend on the emf of the cell or on the galvanometer's resistance.
- A Wheatstone bridge is most sensitive when all four arms are of similar size (beyond the syllabus).

## NCERT lines to know

:::remember
- Emf is a potential difference, not a force; it is the voltage between the terminals in open circuit.
- Drift speed is of the order of mm/s; the electric field travels along the wire at the speed of light.
- $j$ = (charge density) × (velocity) must be applied to each type of carrier separately. A wire carrying current is still electrically neutral.
- Ohm's law is obeyed by many substances, but it is not a fundamental law of nature.
:::
