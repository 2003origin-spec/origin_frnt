---
title: "Semiconductor Electronics: Important Points and Traps"
type: key_points
chapter: c12.physics.semiconductor-electronics
order: 3
---

## Materials and doping

:::trap
A **p-type** crystal is **not** positively charged, and an n-type crystal is not negatively charged. Every doped crystal is **electrically neutral**: the charge of the extra carriers is balanced by the fixed ion cores. "p" and "n" name the majority carrier, not the net charge.
:::

:::trap
$n_e n_h = n_i^2$ means doping **lowers** the minority carriers below $n_i$. In n-type Si, $n_h$ is far **less** than $n_i$, not equal to it.
:::

- A hole is not a real particle. Hole motion is the movement of **bound** valence electrons from bond to bond. The free electron that left the hole takes no part.
- Holes move towards the **negative** potential; the electron and hole currents add.
- A few **ppm** of dopant raises the conductivity many times. The dopant must be about the **same size** as the host atom.
- Donor electrons do not depend on temperature (once ionised); intrinsic pairs increase with temperature.
- (NCERT, Current Electricity chapter) A semiconductor's resistivity **falls** as the temperature rises; a metal's rises.

:::tip
**"PAS 5, BAI 3":** pentavalent donors are **P**, **As**, **Sb** (5 electrons, give n-type); trivalent acceptors are **B**, **Al**, **In** (3 electrons, give p-type).
:::

:::remember
- $E_g$: C (diamond) 5.4 eV > Si 1.1 eV > Ge 0.7 eV. Sn: 0 eV, a metal.
- Insulator $E_g > 3$ eV; semiconductor about 0.2 to 3 eV.
- Donor level $E_D$ is just **below** $E_C$; acceptor level $E_A$ is just **above** $E_V$.
- A pure semiconductor at 0 K is an **insulator**.
:::

:::trap
Don't mix up two pairs of numbers. **Band gap:** Si 1.1 eV, Ge 0.7 eV. **Cut-in voltage of a diode:** Si about 0.7 V, Ge about 0.2 V. The 0.7 belongs to Ge in the first pair and to Si in the second.
:::

## p-n junction

- The depletion region has **no mobile carriers**, but it is **not** uncharged: it holds fixed positive ions on the n-side and fixed negative ions on the p-side.
- The junction field points from **n to p**. The n-side is at the **higher** potential.
- In equilibrium the diffusion and drift currents are equal and opposite, so the net current is **zero**.
- Pressing a p-slab against an n-slab does **not** make a junction: the surfaces are rough on the atomic scale.

:::trap
**Forward current is diffusion**: majority carriers cross the junction and diffuse on as injected minority carriers (mA). **Reverse current is drift** of minority carriers (µA). Reverse saturation current hardly changes with voltage (until breakdown), because it is limited by the number of minority carriers. (Exam extra: it rises with temperature, since heat makes more minority carriers.)
:::

| Bias | Barrier | Depletion layer |
| --- | --- | --- |
| Forward | Falls to $V_0 - V$ | Narrows |
| Reverse | Rises to $V_0 + V$ | Widens |

- Almost all the applied voltage drops across the **depletion region**, not across the p and n regions.
- The arrow in the diode symbol points from **p to n**: the direction of conventional current in forward bias.
- Dynamic resistance $\Delta V/\Delta I$ is **not** a constant; read it at the working point.

## Rectifiers and filters

:::trap
A full-wave rectifier **doubles the frequency** of the output (50 Hz → 100 Hz), not the voltage. In a centre-tap rectifier each diode gets only **half** the secondary voltage.
:::

- Half-wave: 1 diode; full-wave centre-tap: 2 diodes; bridge: 4 diodes, no centre tap.
- In a centre-tap rectifier only **one** diode conducts at a time; in a bridge, **two** (exam extra).
- Capacitor filter goes **in parallel** with the load; an inductor filter goes **in series**. A larger $C R_L$ gives a smoother output, close to the peak voltage.
- The diode's breakdown voltage must be more than the peak reverse voltage it sees (exam extra: $V_m$ for half-wave; $2V_m$ per diode for centre-tap, where $V_m$ is the peak of each half of the secondary).

## Special diodes (exam extra: in both syllabi, not in NCERT)

:::remember
- **Zener:** reverse bias. **Photodiode:** reverse bias. **LED:** forward bias. **Solar cell:** no bias.
- Zener: heavily doped, thin depletion layer, used as a **voltage regulator**, in parallel with the load.
- LED photon energy ≈ $E_g$: its colour is set by the **material**, not by the applied voltage.
- Solar cell V-I curve is in the **fourth quadrant**.
:::

:::trap
A photodiode only responds if $h\nu \ge E_g$. This gives a **largest** wavelength, $\lambda_{max} = hc/E_g$. Light of longer wavelength is not detected however bright it is.
:::

:::trap
In a Zener regulator problem, first check that the Zener is really in breakdown: without it, the voltage across the load must be at least $V_Z$. Then $I_Z = I_s - I_L$, not $I_s + I_L$.
:::

## Logic gates (exam extra: in both syllabi, not in NCERT)

- In Boolean algebra $1 + 1 = 1$ (OR), not 2.
- A NAND or NOR gate with its two inputs joined acts as a **NOT** gate.
- NOT on each input, then NAND, gives **OR**. NOT on each input, then NOR, gives **AND** (De Morgan).

:::tip
**AND** needs **All** inputs 1. **OR** needs **One or more**. NAND and NOR are just the opposite (inverted) outputs of AND and OR.
:::

## NCERT lines to know

:::remember
- In an intrinsic semiconductor $n_e = n_h = n_i$; in every case (thermal equilibrium) $n_e n_h = n_i^2$.
- p-n junction is the "key" to all semiconductor devices.
- The depletion layer is about one-tenth of a micrometre thick.
- In forward bias the barrier decreases; in reverse bias it increases.
:::
