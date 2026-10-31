---
title: "Kinetic Theory: Formula Sheet"
type: formula_sheet
chapter: c11.physics.kinetic-theory
order: 1
---

Symbols follow NCERT: $\mu$ = number of moles, $N$ = number of molecules, $n$ = number density (molecules per m³), $m$ = mass of one molecule, $M_0$ = molar mass, $T$ = absolute temperature in **kelvin**.

## Constants (NCERT values)

:::formula{title="Gas constant and Boltzmann constant"}
$$R = 8.314 \text{ J mol}^{-1}\text{K}^{-1}$$
$$k_B = \frac{R}{N_A}$$
$$k_B = 1.38\times10^{-23}\text{ J K}^{-1}$$
$N_A = 6.02\times10^{23}$ mol⁻¹ (Avogadro number). Many NCERT examples round $R$ to 8.31.
:::

:::formula{title="Molar volume"}
$$V_m = 22.4 \text{ L} = 22.4\times10^{-3}\text{ m}^3$$
Volume of 1 mol of any ideal gas at STP (273 K and 1 atm $= 1.01\times10^5$ Pa).
:::

## Ideal gas equation

:::formula{title="Perfect gas equation"}
$$PV = \mu RT$$
$$\mu = \frac{M}{M_0} = \frac{N}{N_A}$$
$P$ in Pa, $V$ in m³, $T$ in K. $M$ = mass of the gas, $M_0$ = molar mass. Holds exactly only for an ideal gas; real gases follow it at **low pressure and high temperature**.
:::

:::formula{title="Molecular form"}
$$PV = N k_B T$$
$$P = n k_B T$$
$n = N/V$ = number density (m⁻³).
:::

:::formula{title="Density form"}
$$P = \frac{\rho RT}{M_0}$$
$\rho$ = mass density (kg/m³), $M_0$ in **kg/mol**.
:::

:::formula{title="Fixed amount of gas"}
$$\frac{P_1V_1}{T_1} = \frac{P_2V_2}{T_2}$$
Only if no gas leaks in or out ($\mu$ fixed).
- Boyle's law ($T$ fixed): $PV$ = constant.
- Charles' law ($P$ fixed): $V \propto T$.
:::

:::formula{title="Dalton's law of partial pressures"}
$$P = P_1 + P_2 + \dots$$
$$P_1 = \frac{\mu_1 RT}{V}$$
For a mixture of **non-reacting** ideal gases. $P_1$ is the pressure gas 1 would exert if it alone filled the vessel at the same $T$.
:::

## Pressure from kinetic theory

:::formula{title="Pressure of an ideal gas"}
$$P = \frac{1}{3}\,n m \overline{v^2}$$
$\overline{v^2}$ = mean of the squared speeds (also written $\langle v^2\rangle$). The shape of the vessel does not matter.
:::

:::formula{title="Pressure and density"}
$$P = \frac{1}{3}\rho\,\overline{v^2}$$
Since $\rho = nm$. (Exam form, follows directly from NCERT's equation.)
:::

:::formula{title="Pressure and kinetic energy"}
$$PV = \frac{2}{3}E$$
$E$ = total **translational** kinetic energy of all the molecules. So pressure $= \tfrac23 \times$ translational KE per unit volume.
:::

## Temperature and molecular speeds

:::formula{title="Average kinetic energy of a molecule"}
$$\frac12 m\overline{v^2} = \frac32 k_B T$$
Translational KE only. Same for **every** ideal gas at the same $T$. It depends on nothing else.
:::

:::formula{title="Total translational KE"}
$$E = \frac32 N k_B T$$
$$E = \frac32 \mu RT$$
$E$ = translational KE of all $N$ molecules ($\mu$ moles).
:::

:::formula{title="Root mean square speed"}
$$v_{rms} = \sqrt{\overline{v^2}}$$
$$v_{rms} = \sqrt{\frac{3k_BT}{m}}$$
$$v_{rms} = \sqrt{\frac{3RT}{M_0}}$$
$$v_{rms} = \sqrt{\frac{3P}{\rho}}$$
$M_0$ in **kg/mol** (N₂: 0.028, not 28). NCERT: $v_{rms}$ of N₂ at 300 K is about 516 m/s.
:::

:::formula{title="Mean and most probable speed (exam extra, not in NCERT)"}
$$v_{avg} = \sqrt{\frac{8RT}{\pi M_0}}$$
$$v_{mp} = \sqrt{\frac{2RT}{M_0}}$$
Order: $v_{rms} > v_{avg} > v_{mp}$, in the ratio about $1.22 : 1.13 : 1$.
:::

:::formula{title="Speed and mass at the same temperature"}
$$\frac{v_{rms,1}}{v_{rms,2}} = \sqrt{\frac{M_2}{M_1}}$$
Two gases at the **same** $T$; $M$ = molecular (or molar) mass. Lighter molecules move faster. NCERT: rates of diffusion follow the same rule (inversely as the square root of the mass). The name "Graham's law" is not used in NCERT.
:::

## Equipartition of energy

:::formula{title="Energy per degree of freedom"}
$$\varepsilon = \frac12 k_B T$$
For **each** quadratic (squared) term in the energy, in thermal equilibrium. A vibrational mode has two such terms (KE and PE), so it gets $k_BT$.
:::

:::formula{title="Energy of a molecule and of a gas (general form)"}
$$\bar\varepsilon = \frac{D}{2}k_BT$$
$$U = \frac{D}{2}\mu RT$$
$D$ = **total** number of degrees of freedom (quadratic terms), with each vibrational mode counted as 2. NCERT has no symbol for this total; we use $D$ so it cannot be confused with NCERT's $f$, which means the number of **vibrational modes** (see the polyatomic box below). Many exam books write this total as $f$.
:::

| Gas | $D$ |
| --- | --- |
| Monatomic (He, Ar) | 3 |
| Rigid diatomic (O₂, N₂) | 5 |
| Diatomic with vibration (CO) | 7 |
| Rigid non-linear polyatomic | 6 |
| Non-linear polyatomic, $f$ modes | $6 + 2f$ |

## Specific heats of gases (molar)

:::formula{title="From the total degrees of freedom"}
$$C_v = \frac{D}{2}R$$
$$C_p = C_v + R$$
$$\gamma = 1 + \frac{2}{D}$$
$D$ = total degrees of freedom (as above), $\gamma = C_p/C_v$. For an ideal gas, using equipartition.
:::

:::formula{title="Mayer's relation (name not used in NCERT)"}
$$C_p - C_v = R$$
For **molar** specific heats of any ideal gas (mono, di or polyatomic). Per unit mass it is $c_p - c_v = R/M_0$.
:::

| Gas | $C_v$ | $C_p$ | $\gamma$ |
| --- | --- | --- | --- |
| Monatomic | $\tfrac32R$ | $\tfrac52R$ | $\tfrac53$ |
| Rigid diatomic | $\tfrac52R$ | $\tfrac72R$ | $\tfrac75$ |
| Diatomic + vibration | $\tfrac72R$ | $\tfrac92R$ | $\tfrac97$ |

:::formula{title="Polyatomic gas (NCERT form)"}
$$C_v = (3 + f)R$$
$$C_p = (4 + f)R$$
$$\gamma = \frac{4 + f}{3 + f}$$
Here $f$ = number of **vibrational modes** (NCERT's symbol), **not** the total degrees of freedom. The molecule has 3 translational + 3 rotational degrees of freedom, and each vibrational mode adds $k_BT$. With no vibration ($f = 0$): $C_v = 3R$, $\gamma = 4/3$. (3 rotational is for a non-linear molecule; a linear one such as CO₂ has only 2. Exam extra.)
:::

:::formula{title="Mixture of gases (exam extra)"}
$$C_v = \frac{\mu_1 C_{v1} + \mu_2 C_{v2}}{\mu_1 + \mu_2}$$
$\mu_1, \mu_2$ = moles; $C_{v1}, C_{v2}$ = molar $C_v$ of each gas. Non-reacting ideal gases. Then $C_p = C_v + R$ and $\gamma = C_p/C_v$ for the mixture. Never average the $\gamma$ values directly.
:::

## Specific heat of solids

:::formula{title="Molar specific heat of a solid"}
$$C = 3R \approx 25 \text{ J mol}^{-1}\text{K}^{-1}$$
Each atom vibrates in 3 dimensions: $3 \times k_BT$, so $U = 3RT$ per mole. Holds at **ordinary temperatures**; carbon is an exception (NCERT). This is the Dulong–Petit law (name not used in NCERT).
:::

## Mean free path

:::formula{title="Mean free path"}
$$l = \frac{1}{\sqrt2\, n\pi d^2}$$
$d$ = diameter of a molecule (m), $n$ = number density (m⁻³). The $\sqrt2$ comes from the motion of the other molecules.
:::

:::formula{title="Mean free path from P and T"}
$$l = \frac{k_BT}{\sqrt2\,\pi d^2 P}$$
Using $n = P/k_BT$. At fixed $T$, $l \propto 1/P$; at fixed $P$, $l \propto T$.
:::

:::formula{title="Time between collisions"}
$$\tau = \frac{l}{\bar v}$$
Collision frequency $= 1/\tau$. NCERT's first estimate (others at rest): $\tau = \dfrac{1}{n\pi \bar v d^2}$, $l = \dfrac{1}{n\pi d^2}$.
:::
