---
title: "Kinetic Theory: Short Notes"
type: short_notes
chapter: c11.physics.kinetic-theory
order: 2
---

## 1. What kinetic theory does

Kinetic theory explains how a gas behaves by treating it as a huge number of **rapidly moving molecules**. Forces between molecules act only at short range, so in a gas they can be ignored except during collisions. It was developed by Maxwell, Boltzmann and others.

It gives:
- a molecular meaning for **pressure** and **temperature**;
- the gas laws and Avogadro's hypothesis;
- correct **specific heats** of many gases;
- molecular sizes, through viscosity, conduction and diffusion.

## 2. Molecular nature of matter

- **Atomic hypothesis** (Feynman): all things are made of atoms in perpetual motion. They attract when a little distance apart and repel when squeezed together.
- **Dalton** proposed atomic theory to explain the laws of **definite proportions** and **multiple proportions**.
- **Gay Lussac's law** (as NCERT uses the name): when gases combine to give another gas, their **volumes** are in ratios of small integers.
- **Avogadro's law:** equal volumes of all gases at the same temperature and pressure contain the **same number of molecules**.

| Quantity | Typical size |
| --- | --- |
| Size of an atom | about 1 Å ($10^{-10}$ m) |
| Spacing in solids and liquids | about 2 Å |
| Spacing in gases | tens of Å |
| Mean free path in a gas | thousands of Å |

A gas only looks still. Its molecules keep colliding and changing speed. This is a **dynamic equilibrium**: only the average properties stay constant.

## 3. Behaviour of gases

At **low pressure and high temperature** (far above the point where it liquefies), a gas obeys
$$PV = \mu RT$$
- $\mu$ = number of moles $= M/M_0 = N/N_A$.
- In molecular form, $PV = Nk_BT$ or $P = nk_BT$, where $k_B = R/N_A$.
- Since $k_B$ is the same for all gases, equal $P$, $V$ and $T$ mean equal $N$. This is Avogadro's hypothesis.
- One mole of any gas at STP (273 K, 1 atm) fills **22.4 L** and contains $6.02\times10^{23}$ molecules.

An **ideal gas** obeys $PV = \mu RT$ exactly at all pressures and temperatures. No real gas is truly ideal. Real gases come close when molecules are far apart, so that their interactions are negligible.

| Law | Kept fixed | Result |
| --- | --- | --- |
| Boyle's law | $\mu$, $T$ | $PV$ = constant |
| Charles' law | $\mu$, $P$ | $V \propto T$ |
| Dalton's law | $V$, $T$ | $P = P_1 + P_2 + \dots$ |

**Partial pressure** of a gas in a mixture is the pressure it would exert if it alone filled the vessel at the same temperature. Dalton's law is for **non-reacting** ideal gases.

:::example{title="How empty is a gas? (NCERT idea)"}
Water: 1000 kg/m³. Water vapour at 100 °C, 1 atm: 0.6 kg/m³. The same mass of vapour fills $1000/0.6 \approx 1.67\times10^3$ times more space. So molecules take up only about $6\times10^{-4}$ of the vapour's volume.
:::

## 4. Assumptions of the kinetic theory of an ideal gas

- A gas is a very large number of identical molecules in **incessant random motion**.
- The size of a molecule is very small compared with the distance between molecules.
- Between collisions, molecules move in **straight lines** (no forces act: Newton's first law).
- All collisions, with each other and with the walls, are **perfectly elastic**: total KE is conserved, and momentum is conserved as usual.
- Collisions take very little time compared with the time between them.
- The gas is **isotropic**: no direction is special.

## 5. Pressure of an ideal gas

Think of a molecule hitting a wall at right angles to the $x$-axis. It bounces back with $v_x$ reversed, so it gives the wall momentum $2mv_x$.

- In time $\Delta t$, the molecules that hit a wall of area $A$ are those within $v_x\Delta t$ of it and moving towards it: $\tfrac12 nAv_x\Delta t$.
- Momentum given per unit time per unit area gives $P = nm\overline{v_x^2}$.
- By symmetry $\overline{v_x^2} = \overline{v_y^2} = \overline{v_z^2} = \tfrac13\overline{v^2}$.

$$P = \frac13 nm\overline{v^2}$$

- The shape of the vessel does not matter. By Pascal's law the pressure is the same everywhere in the gas, not only at the walls.
- Collisions between molecules do not change the result, because the gas is in a steady state.

## 6. Kinetic meaning of temperature

From $P = \tfrac13 nm\overline{v^2}$ we get $PV = \tfrac23 E$, where $E$ is the total translational KE. Comparing with $PV = Nk_BT$:
$$\frac12 m\overline{v^2} = \frac32 k_BT$$

- The **average KE of a molecule is proportional to the absolute temperature**. It does not depend on pressure, volume or the kind of gas.
- So the internal energy of an ideal gas depends only on its temperature.
- **rms speed:** $v_{rms} = \sqrt{3k_BT/m}$. At the same $T$, lighter molecules move faster.
- N₂ at 300 K: $v_{rms} \approx 516$ m/s, of the same order as the speed of sound in air.
- In a mixture at one temperature, every gas has the same average KE per molecule. Then $P = (n_1 + n_2 + \dots)k_BT$, which is Dalton's law again.

**Isotope separation (NCERT):** in UF₆ gas, molecules with ²³⁵U (mass 349 u) move about 0.44% faster than those with ²³⁸U (352 u). Diffusing the gas through a porous wall many times enriches ²³⁵U. Rates of diffusion vary inversely as the square root of the mass.

## 7. Degrees of freedom and equipartition

A **degree of freedom** here is each independent squared (quadratic) term in a molecule's energy.

- **Translational:** 3 for a molecule moving in space ($\tfrac12mv_x^2$, $\tfrac12mv_y^2$, $\tfrac12mv_z^2$).
- **Rotational:** a diatomic molecule has 2, about the two axes at right angles to its length. Rotation about its own axis does not count (very small moment of inertia; a quantum effect).
- **Vibrational:** each vibrational mode has KE **and** PE, so it gives **two** squared terms.

:::remember
**Law of equipartition of energy:** in thermal equilibrium at temperature $T$, the energy is shared equally among all modes. Each translational and rotational degree of freedom gets $\tfrac12k_BT$; each vibrational mode gets $2\times\tfrac12k_BT = k_BT$.
:::

- O₂ at moderate temperatures acts as a **rigid rotator** (no vibration).
- CO vibrates even at moderate temperatures.

## 8. Specific heats

| Gas | Degrees of freedom | $C_v$ | $\gamma$ |
| --- | --- | --- | --- |
| Monatomic | 3 tr | $\tfrac32R$ | 1.67 |
| Rigid diatomic | 3 tr + 2 rot | $\tfrac52R$ | 1.40 |
| Diatomic + vibration | 3 tr + 2 rot + 1 mode | $\tfrac72R$ | 1.29 |
| Polyatomic | 3 tr + 3 rot + $f$ modes | $(3 + f)R$ | $\tfrac{4+f}{3+f}$ |

(tr = translational, rot = rotational, mode = vibrational mode.) In the polyatomic row, $f$ is NCERT's symbol for the number of **vibrational modes**, not the total degrees of freedom. For every ideal gas, $C_p - C_v = R$.

- Predictions match measured values for many gases. For gases like Cl₂ and C₂H₆, measured values are **higher**, because vibration also takes up energy.
- **Solids:** each atom is a 3-D oscillator with average energy $3k_BT$. So $U = 3RT$ per mole and $C = 3R$. ($\Delta V$ is tiny, so $C_p \approx C_v$.) This matches most solids at room temperature; **carbon** is an exception.

:::example{title="Heating helium in a fixed cylinder (NCERT idea)"}
44.8 L of helium at STP is 2 mol. The volume is fixed, so use $C_v = \tfrac32R$. To raise it by 15 °C: $Q = 2\times1.5R\times15 = 45R \approx 374$ J.
:::

## 9. Mean free path

Molecules move at hundreds of m/s, yet a smell takes time to spread. That is because they keep **colliding** and their paths keep bending.

- A molecule of diameter $d$ hits any molecule whose centre comes within $d$ of its own. In time $\Delta t$ it sweeps a volume $\pi d^2\bar v\Delta t$.
- Mean free path (average distance between two collisions):
$$l = \frac{1}{\sqrt2\,n\pi d^2}$$
- $l$ is smaller for a denser gas (larger $n$) and bigger molecules (larger $d$).
- NCERT's estimate for air at STP: $n \approx 2.7\times10^{25}$ m⁻³, $d = 2\times10^{-10}$ m, $\bar v = 485$ m/s. It gets $l \approx 2.9\times10^{-7}$ m (about $1500\,d$) and time between collisions about $6\times10^{-10}$ s. These numbers come from the simpler formula $l = 1/(n\pi d^2)$; with the $\sqrt2$ the same data give about $2.1\times10^{-7}$ m. Either way, $l$ is about 1000 times the size of a molecule.
- In a highly evacuated tube, $l$ can be as long as the tube.
- Viscosity, heat conduction and diffusion depend on $l$. Measuring them gave the first estimates of molecular size.
