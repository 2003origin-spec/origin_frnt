---
title: "Semiconductor Electronics: Short Notes"
type: short_notes
chapter: c12.physics.semiconductor-electronics
order: 2
---

The current NCERT chapter covers semiconductors, the p-n junction, the diode and the rectifier. The Zener diode, LED, photodiode, solar cell and logic gates are no longer in the NCERT book but are in **both** the JEE Main and NEET 2026 syllabi, so they are given at the end, marked "exam extra". Transistors were removed from NCERT and are in neither syllabus, so they are left out.

## 1. Why semiconductors

Old **vacuum tubes** needed a heated cathode and a vacuum: bulky, high power, high voltage (~100 V), short life. In **semiconductor devices** the carriers are made and move **inside the solid**, so they are small, low-power, low-voltage and long-lived. Light, heat or a small voltage can change the number of mobile charges.

## 2. Metals, semiconductors, insulators

By resistivity $\rho$ (and conductivity $\sigma = 1/\rho$):

| Class | $\rho$ (Ω m) | $\sigma$ (S m⁻¹) |
| --- | --- | --- |
| Metals | $10^{-2}$ to $10^{-8}$ | $10^{2}$ to $10^{8}$ |
| Semiconductors | $10^{-5}$ to $10^{6}$ | $10^{5}$ to $10^{-6}$ |
| Insulators | $10^{11}$ to $10^{19}$ | $10^{-11}$ to $10^{-19}$ |

**Kinds of semiconductors:**
- **Elemental:** Si, Ge.
- **Compound, inorganic:** CdS, GaAs, CdSe, InP.
- **Compound, organic:** anthracene, doped phthalocyanines; **polymers:** polypyrrole, polyaniline, polythiophene.

## 3. Energy bands

In a solid, the energy levels of the many atoms spread into **bands**.
- **Valence band (VB):** holds the valence electrons. Its top is $E_V$.
- **Conduction band (CB):** the band above it. Its bottom is $E_C$.
- **Band gap** $E_g = E_C - E_V$: no allowed levels in between.

For Si or Ge with $N$ atoms: $4N$ valence electrons and $8N$ states. In the crystal these split into a VB of $4N$ states (full at 0 K) and a CB of $4N$ states (empty at 0 K).

| Material | Band picture | $E_g$ |
| --- | --- | --- |
| Metal | CB partly filled, or CB and VB overlap | ≈ 0 |
| Insulator | Wide gap, CB empty | > 3 eV |
| Semiconductor | Small gap; some electrons cross at room temperature | < 3 eV |

Values: C (diamond) 5.4 eV, Si 1.1 eV, Ge 0.7 eV, Sn 0 eV (a metal). So C is an insulator, while Si and Ge are semiconductors, even though all three have the same diamond-like structure (NCERT Example 14.1).

## 4. Intrinsic semiconductor

A **pure** semiconductor. Each Si or Ge atom shares one electron with each of its 4 neighbours (covalent bonds).

- At 0 K all bonds are intact: it behaves like an **insulator**.
- At higher temperature, thermal energy breaks a few bonds. Each break gives a **free electron** (charge $-q$) and leaves a **hole** (a vacancy with effective charge $+q$).
- So $n_e = n_h = n_i$.
- **Hole motion:** an electron from a nearby bond jumps into the hole, so the hole appears to move. It is really bound electrons moving. Holes move towards the negative potential.
- **Recombination:** electrons and holes also meet and cancel. In equilibrium, generation rate = recombination rate.

## 5. Extrinsic (doped) semiconductor

Pure Si or Ge conducts poorly at room temperature. Adding a tiny amount of impurity (a few ppm) raises the conductivity many times. This is **doping**; the impurity is the **dopant**. The dopant atom must be about the same size as the host atom, so the lattice is not distorted.

| | n-type | p-type |
| --- | --- | --- |
| Dopant | Pentavalent: P, As, Sb | Trivalent: B, Al, In |
| Name | Donor | Acceptor |
| Majority | Electrons | Holes |
| Minority | Holes | Electrons |
| Fixed ion | Positive donor ion | Negative acceptor ion |
| Extra level | $E_D$ just below $E_C$ | $E_A$ just above $E_V$ |

- **n-type:** 4 of the dopant's 5 electrons bond; the 5th is very loosely held. Only about 0.01 eV (Ge) or 0.05 eV (Si) frees it, far less than the band gap. So $n_e \gg n_h$.
- **p-type:** the dopant bonds with only 3 neighbours; the 4th bond has a **hole**. One acceptor gives one hole. So $n_h \gg n_e$.
- Once the donors (or acceptors) are ionised, as at room temperature, the carriers they give depend on the doping level, **not** on temperature. NCERT adds that the pairs made by the Si atoms themselves increase only weakly with temperature; in a doped semiconductor near room temperature they stay few compared with the dopant carriers. (In a pure semiconductor, the number of pairs rises steeply with temperature, which is why its resistivity falls.)
- More majority carriers means more recombination, so doping **lowers** the minority carriers below $n_i$. That is why $n_e n_h = n_i^2$ still holds.
- The crystal stays **electrically neutral**: the carriers' charge is balanced by the fixed ion cores.

:::example{title="Carriers in doped Si (as in NCERT Example 14.2)"}
Si has $5\times10^{28}$ atoms m⁻³, doped with 1 ppm of As; $n_i = 1.5\times10^{16}$ m⁻³. Then $n_e \approx N_D = 5\times10^{22}$ m⁻³ and $n_h = n_i^2/n_e = 2.25\times10^{32}/5\times10^{22} \approx 4.5\times10^{9}$ m⁻³.
:::

## 6. Forming a p-n junction

Made by adding a pentavalent impurity to part of one p-type wafer. Two slabs pressed together will **not** work: their surfaces are rough on the atomic scale (NCERT Example 14.3).

- **Diffusion:** holes diffuse p → n and electrons n → p, from high to low concentration. This is the **diffusion current**.
- Each electron leaving the n-side leaves a fixed **positive** donor ion; each hole leaving the p-side leaves a fixed **negative** acceptor ion.
- These fixed charges form the **depletion region** (no mobile carriers), about 0.1 µm thick.
- The ions set up an electric field from the n-side to the p-side. It pushes minority carriers across: the **drift current**, opposite to the diffusion current.
- Equilibrium: diffusion current = drift current, so **no net current**.
- The n-side ends up **positive** relative to the p-side. This **barrier potential** $V_0$ opposes further diffusion.

## 7. The junction diode

A p-n junction with metal contacts: a two-terminal device. In the symbol, the arrow points from p to n, the direction of conventional current in forward bias.

**Forward bias** (p to $+$, n to $-$):
- Applied voltage opposes $V_0$; barrier falls to $V_0 - V$; depletion layer **narrows**.
- Electrons cross into p and holes into n (**minority carrier injection**), then diffuse away. Current is in **mA**.

**Reverse bias** (n to $+$, p to $-$):
- Barrier rises to $V_0 + V$; depletion layer **widens**; diffusion almost stops.
- Only minority carriers drift across: a tiny current in **µA**, nearly independent of voltage (**reverse saturation current**), limited by how many minority carriers there are.
- At the **breakdown voltage** $V_{br}$ the reverse current rises sharply. Unless the current is limited, the diode overheats and is destroyed.

In both cases almost all the applied voltage drops across the depletion region, which has a much higher resistance than the p and n regions.

**V-I characteristic:** in forward bias the current stays tiny until the **threshold (cut-in) voltage** (~0.7 V Si, ~0.2 V Ge), then rises steeply (exponentially). A milliammeter is used for forward current and a microammeter for reverse current.

## 8. Rectifiers

A diode conducts only in forward bias, so it can turn ac into one-way (pulsating) dc.

- **Half-wave** (one diode): output only in the half-cycles when the diode is forward biased. Output frequency = input frequency.
- **Full-wave, centre-tap** (two diodes): the secondary has a centre tap. Each diode conducts in alternate half-cycles and gets **half** the secondary voltage. Output in both halves; output frequency = **twice** the input.
- **Full-wave, bridge** (four diodes, no centre tap): NCERT only mentions it. (Exam extra: two diodes conduct, in series, in each half-cycle.)
- The diode's reverse breakdown voltage must be well above the peak ac voltage.

**Filters:** the output is one-way but not steady. A **capacitor across** the load (or an **inductor in series** with it) smooths it. The capacitor charges to the peak and discharges slowly through $R_L$; a large $C R_L$ gives a steadier output, close to the peak voltage. Capacitor-input filters are the most common in power supplies.

## 9. Special-purpose diodes (exam extra: in both syllabi, not in NCERT)

| Device | Bias | Use |
| --- | --- | --- |
| Zener diode | Reverse (in breakdown) | Voltage regulator |
| Photodiode | Reverse | Detecting light |
| LED | Forward | Giving light |
| Solar cell | None | Light → electric power |

- **Zener diode:** both sides heavily doped, so the depletion layer is very thin and the field is very strong. Breakdown comes at a definite, low reverse voltage $V_Z$. In breakdown, a large change in current gives almost **no change in voltage**.
- **Zener regulator:** an unregulated dc input feeds a series resistor $R_s$, with the Zener (reverse biased) in **parallel** with the load. If the input rises, the extra voltage drops across $R_s$; the load voltage stays $V_Z$.
- **Photodiode:** light with $h\nu > E_g$ makes electron-hole pairs near the junction; the junction field separates them. The reverse current rises with light intensity. It is used in reverse bias because the change in the small minority current is easy to notice.
- **LED:** heavily doped, forward biased. Electrons and holes **recombine** at the junction and give out photons of energy about $E_g$. Visible light needs $E_g$ of about 1.8 to 3 eV. Threshold voltages are higher than for a Si diode, and the reverse breakdown voltage is low (around 5 V). Low power, long life, fast switching.
- **Solar cell:** a large-area junction with no external bias; light makes an emf. Three steps: generation of pairs, separation by the junction field, collection at the contacts. Its V-I curve is drawn in the **fourth quadrant**; it gives an open-circuit voltage $V_{oc}$ and a short-circuit current $I_{sc}$. Materials with $E_g$ near 1.5 eV suit sunlight best (GaAs, CdTe); Si (1.1 eV) is the most used.

## 10. Logic gates (exam extra: in both syllabi, not in NCERT)

A gate takes inputs that are 0 or 1 and gives one output by a fixed rule.

**NOT** (one input): $Y = \overline{A}$. 0 gives 1, 1 gives 0.

| A | B | AND | OR |
| --- | --- | --- | --- |
| 0 | 0 | 0 | 0 |
| 0 | 1 | 0 | 1 |
| 1 | 0 | 0 | 1 |
| 1 | 1 | 1 | 1 |

| A | B | NAND | NOR |
| --- | --- | --- | --- |
| 0 | 0 | 1 | 1 |
| 0 | 1 | 1 | 0 |
| 1 | 0 | 1 | 0 |
| 1 | 1 | 0 | 0 |

- **AND** is 1 only when **all** inputs are 1. **OR** is 1 when **any** input is 1.
- **NAND** = AND then NOT. **NOR** = OR then NOT. A small circle (bubble) on a gate symbol means NOT.
- NAND and NOR are **universal gates**: any gate can be built from NANDs alone, or from NORs alone.
