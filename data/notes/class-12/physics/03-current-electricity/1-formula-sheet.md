---
title: "Current Electricity: Formula Sheet"
type: formula_sheet
chapter: c12.physics.current-electricity
order: 1
---

## Current and current density

:::formula{title="Electric current"}
$$I = \frac{q}{t}$$
$$I(t) = \lim_{\Delta t \to 0}\frac{\Delta Q}{\Delta t}$$
$q$ = net charge crossing the area in time $t$ (C), $I$ in ampere (A). The first form is only for a **steady** current; the second works always.
:::

:::formula{title="Current density"}
$$j = \frac{I}{A}$$
$A$ = area **normal** to the current (m²), $j$ in A/m². $\vec j$ is a vector along $\vec E$, but the current $I$ is a scalar.
:::

## Ohm's law and resistivity

:::formula{title="Ohm's law"}
$$V = IR$$
$V$ = potential difference (V), $R$ = resistance (Ω), $1\ \Omega = 1$ V/A. Ohm's law says $R$ stays **constant** as $V$ changes. The ratio $V/I$ defines $R$ for any device, ohmic or not.
:::

:::formula{title="Resistance of a uniform conductor"}
$$R = \frac{\rho\, l}{A}$$
$l$ = length (m), $A$ = cross-section area (m²), $\rho$ = resistivity (Ω m). $\rho$ depends on the material and its temperature, not on its size or shape.
:::

:::formula{title="Stretching a wire (derived from R = ρl/A)"}
$$R' = n^2 R$$
When a wire is stretched to $n$ times its length with the **same volume**, $A$ falls to $A/n$, so $R$ becomes $n^2$ times. $\rho$ does not change.
:::

:::formula{title="Ohm's law in vector form"}
$$\vec E = \rho\,\vec j$$
$$\vec j = \sigma \vec E$$
$$\sigma = \frac{1}{\rho}$$
$\sigma$ = conductivity (S/m, where $1$ S $= 1\ \Omega^{-1}$). $E$ in V/m. For a uniform wire, $E = V/l$.
:::

## Drift of electrons

:::formula{title="Drift velocity"}
$$\vec v_d = -\frac{e\vec E}{m}\,\tau$$
$e = 1.6 \times 10^{-19}$ C, $m$ = electron mass (kg), $\tau$ = relaxation time, the average time between collisions (s). The minus sign: electrons drift **opposite** to $\vec E$. Magnitude $v_d = eE\tau/m$.
:::

:::formula{title="Current and drift speed"}
$$I = n e A v_d$$
$$j = n e v_d$$
$n$ = number of free electrons per m³. For copper, $n \approx 8.5 \times 10^{28}$ m⁻³. $v_d$ is of the order of mm/s (NCERT Example 3.1: 1.1 mm/s for 1.5 A in a wire of area $1.0 \times 10^{-7}$ m²).
:::

:::formula{title="Conductivity and resistivity from drift"}
$$\sigma = \frac{n e^2 \tau}{m}$$
$$\rho = \frac{m}{n e^2 \tau}$$
These assume $n$ and $\tau$ do not depend on $E$.
:::

:::formula{title="Mobility"}
$$\mu = \frac{|v_d|}{E}$$
$$\mu = \frac{e\tau}{m}$$
SI unit m²/(V s), which is $10^4$ times the practical unit cm²/(V s). Mobility is always positive. Putting it together: $\sigma = n e \mu$ (this last step is a derived result, not printed in NCERT).
:::

## Temperature dependence

:::formula{title="Resistivity and temperature"}
$$\rho_T = \rho_0\,[1 + \alpha (T - T_0)]$$
$\rho_0$ = resistivity at the reference temperature $T_0$. $\alpha$ = temperature coefficient of resistivity, unit °C⁻¹ or K⁻¹ (same size). Only for a **limited range** of temperature (a straight-line graph). For metals $\alpha > 0$.
:::

:::formula{title="Resistance and temperature"}
$$R_T = R_0\,[1 + \alpha (T - T_0)]$$
NCERT uses this form in its examples. It ignores the small change in the wire's size on heating.
:::

:::formula{title="Platinum resistance thermometer"}
$$t = \frac{R_t - R_0}{R_{100} - R_0} \times 100$$
$t$ in °C, $R_0$ at the ice point (0 °C), $R_{100}$ at the steam point (100 °C). It follows from $R_t = R_0(1 + \alpha t)$.
:::

## Electrical energy and power

:::formula{title="Power dissipated in a resistor"}
$$P = VI$$
$$P = I^2 R = \frac{V^2}{R}$$
$P$ in watt (W). Energy in time $t$: $W = VIt$ (J). $P = VI$ is the power taken by any device. $I^2R$ and $V^2/R$ give the heat in a **resistor**; for a motor or a cell being charged, $I^2R$ is only the heat part of $VI$.
:::

:::formula{title="Power lost in transmission cables"}
$$P_c = I^2 R_c = \frac{P^2 R_c}{V^2}$$
$P$ = power delivered to the device, $V$ = voltage across it, $R_c$ = resistance of the cables. For a fixed $P$, the loss falls as $1/V^2$. This is why power is sent at very high voltage.
:::

## Cells, emf and internal resistance

:::formula{title="Terminal voltage (cell giving current)"}
$$V = \varepsilon - I r$$
$\varepsilon$ = emf (V), $r$ = internal resistance (Ω), $I$ = current flowing **out of the + terminal**. In open circuit ($I = 0$), $V = \varepsilon$.
:::

:::formula{title="Terminal voltage (cell being charged)"}
$$V = \varepsilon + I r$$
Here the current enters the cell at its **+ terminal** (it flows from P to N inside the cell).
:::

:::formula{title="Current from a cell"}
$$I = \frac{\varepsilon}{R + r}$$
$$V_{ext} = IR = \frac{\varepsilon R}{R + r}$$
Maximum current (short circuit, $R = 0$): $I_{max} = \varepsilon / r$.
:::

:::formula{title="Cells in series"}
$$\varepsilon_{eq} = \varepsilon_1 + \varepsilon_2$$
$$r_{eq} = r_1 + r_2$$
If one cell is connected the **wrong way** (current leaves it from its − terminal), its emf is subtracted: $\varepsilon_{eq} = \varepsilon_1 - \varepsilon_2$. The internal resistances **still add**.
:::

:::formula{title="Cells in parallel (+ to +)"}
$$\begin{aligned} \varepsilon_{eq} &= \frac{\varepsilon_1 r_2 + \varepsilon_2 r_1}{r_1 + r_2} \end{aligned}$$
$$r_{eq} = \frac{r_1 r_2}{r_1 + r_2}$$
For $n$ cells in parallel:
$$\frac{1}{r_{eq}} = \sum_i \frac{1}{r_i}$$
$$\varepsilon_{eq} = r_{eq}\sum_i \frac{\varepsilon_i}{r_i}$$
If a cell is joined the other way round, replace its $\varepsilon$ by $-\varepsilon$.
:::

:::formula{title="Identical cells (derived)"}
$n$ identical cells ($\varepsilon$, $r$) in series with a load $R$:
$$I = \frac{n\varepsilon}{R + nr}$$
$m$ identical cells in parallel with a load $R$:
$$I = \frac{\varepsilon}{R + r/m}$$
:::

## Kirchhoff's rules and the Wheatstone bridge

:::formula{title="Junction rule"}
$$\sum I_{in} = \sum I_{out}$$
At any junction. Comes from **conservation of charge** (no charge piles up in steady state).
:::

:::formula{title="Loop rule"}
$$\sum \Delta V = 0$$
Around any closed loop. Potential has one value at each point, so a round trip brings no net change (energy is conserved).
:::

:::formula{title="Wheatstone bridge balance"}
$$\frac{R_2}{R_1} = \frac{R_4}{R_3}$$
NCERT labels: $R_2$ (A to B), $R_4$ (B to C), $R_1$ (A to D), $R_3$ (D to C). Cell across A and C, galvanometer across B and D. At balance $I_g = 0$. Unknown $R_4 = R_3 R_2 / R_1$.
:::

## Exam extras (not in this NCERT chapter)

:::formula{title="Resistors in series and parallel"}
$$R_s = R_1 + R_2 + \dots$$
$$\frac{1}{R_p} = \frac{1}{R_1} + \frac{1}{R_2} + \dots$$
Two in parallel: $R_p = \dfrac{R_1 R_2}{R_1 + R_2}$. NCERT derives these in the Class 10 Science chapter "Electricity"; this chapter only uses them.
:::

:::formula{title="Current divider (two resistors in parallel)"}
$$I_1 = I\,\frac{R_2}{R_1 + R_2}$$
$I$ = total current. The **smaller** resistor takes the **larger** current.
:::

:::formula{title="Metre bridge"}
$$\frac{R}{S} = \frac{l}{100 - l}$$
$R$ = known resistance in the left gap, $S$ = unknown in the right gap, $l$ = balance length in cm from the left end of the 100 cm wire. Assumes a **uniform** wire and ignores the resistance of the end strips. Resistivity of a wire $S$ of length $L$ and area $A$: $\rho = S A / L$. NCERT only names the metre bridge; it is in both syllabi and in their experimental skills.
:::

:::formula{title="Maximum power to the load (beyond the syllabus)"}
$$P_{max} = \frac{\varepsilon^2}{4r}$$
Not in NCERT or either syllabus, but it follows from $P = I^2R$ with $I = \varepsilon/(R + r)$. For a cell of fixed $\varepsilon$ and $r$, the power in the load $R$ is largest when $R = r$. At that point the efficiency is only 50%.
:::
